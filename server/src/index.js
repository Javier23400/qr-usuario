import "dotenv/config";
import express from "express";
import cors from "cors";
import { getPool, sql } from "./db.js";
import { verifyCredentials, issueToken, requireAdmin, requireAuthenticated } from "./auth.js";

const VALID_CITIES = new Set(["QUITO", "GUAYAQUI", "MANTA", "CUENCA"]);

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "https://javier23400.github.io"
}));
app.use(express.json({ limit: "10kb" }));

// Limite simple en memoria para evitar que alguien inunde /api/track con peticiones.
const rateLimitByIp = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 10_000;
  const maxRequests = 5;
  const entry = rateLimitByIp.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateLimitByIp.set(ip, entry);
  return entry.count > maxRequests;
}

const loginAttemptsByIp = new Map();
function isLoginRateLimited(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;
  const entry = loginAttemptsByIp.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  loginAttemptsByIp.set(ip, entry);
  return entry.count > maxAttempts;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Publico: registra cada apertura de QR. No requiere autenticacion.
app.post("/api/track", async (req, res) => {
  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: "Demasiadas solicitudes" });
  }

  const { codigo, nombre, ciudad } = req.body || {};
  const ciudadUpper = String(ciudad || "").toUpperCase();

  if (!codigo || !nombre || !VALID_CITIES.has(ciudadUpper)) {
    return res.status(400).json({ error: "Datos invalidos" });
  }

  try {
    const pool = await getPool();
    const qrResult = await pool.request()
      .input("codigo", sql.VarChar(50), String(codigo).slice(0, 50))
      .query(`SELECT TOP 1 q.Id, q.UsuarioId, u.Nombre, u.Apellido, q.Ciudad
              FROM dbo.QRs q
              LEFT JOIN dbo.Usuarios u ON u.Id = q.UsuarioId
              WHERE q.Codigo = @codigo`);

    const qr = qrResult.recordset[0];

    if (!qr) {
      return res.status(404).json({ error: "QR no encontrado" });
    }

    const qrOwner = `${qr.Nombre || ""} ${qr.Apellido || ""}`.trim().toUpperCase();
    const scannedName = String(nombre).trim().toUpperCase();
    if (qrOwner !== scannedName || qr.Ciudad !== ciudadUpper) {
      return res.status(400).json({ error: "El código QR no corresponde al usuario" });
    }

    await pool.request()
      .input("qrId", sql.Int, qr.Id)
      .input("userAgent", sql.NVarChar(500), String(req.get("user-agent") || "").slice(0, 500))
      .input("ipCliente", sql.NVarChar(100), String(req.ip || "").slice(0, 100))
      .query(`INSERT INTO dbo.Escaneos (QRId, UserAgent, IpCliente)
              VALUES (@qrId, @userAgent, @ipCliente)`);

    res.status(204).end();
  } catch (err) {
    console.error("track error", err);
    res.status(500).json({ error: "No se pudo registrar" });
  }
});

// Protegido: lista de usuarios con QR y total de escaneos.
app.get("/api/admin/usuarios", requireAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Id,
        u.Nombre,
        u.Apellido,
        u.Ciudad,
        r.Nombre AS Rol,
        q.Codigo,
        q.Ciudad AS CiudadQR,
        COUNT(e.Id) AS TotalEscaneos
      FROM dbo.Usuarios u
      INNER JOIN dbo.Roles r ON r.Id = u.RolId
      LEFT JOIN dbo.QRs q ON q.UsuarioId = u.Id
      LEFT JOIN dbo.Escaneos e ON e.QRId = q.Id
      GROUP BY u.Id, u.Nombre, u.Apellido, u.Ciudad, r.Nombre, q.Codigo, q.Ciudad
      ORDER BY u.Nombre, u.Apellido
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("admin usuarios error", err);
    res.status(500).json({
      error: "No se pudo consultar usuarios",
      code: err.code || "SQL_UNKNOWN"
    });
  }
});

app.post("/api/login", async (req, res) => {
  if (isLoginRateLimited(req.ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Intenta más tarde" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contrasena requeridos" });
  }

  const session = await verifyCredentials(username, password);
  if (!session) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  res.json({ token: issueToken(session), session });
});

// Protegido: un colaborador solo puede consultar su propio QR.
app.get("/api/mi-qr", requireAuthenticated, async (req, res) => {
  if (req.auth.role !== "collaborator") {
    return res.status(403).json({ error: "Esta vista es solo para colaboradores" });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("userId", sql.Int, req.auth.userId)
      .query(`SELECT TOP 1 u.Nombre, u.Apellido, u.Ciudad, q.Codigo
              FROM dbo.Usuarios u
              INNER JOIN dbo.QRs q ON q.UsuarioId = u.Id
              WHERE u.Id = @userId`);
    const qr = result.recordset[0];
    if (!qr) {
      return res.status(404).json({ error: "No existe un QR asignado" });
    }
    res.json(qr);
  } catch (err) {
    console.error("mi qr error", err);
    res.status(500).json({ error: "No se pudo consultar el QR" });
  }
});

// Protegido: sustituye la clave temporal en el primer acceso.
app.post("/api/mi-clave", requireAuthenticated, async (req, res) => {
  if (req.auth.role !== "collaborator") {
    return res.status(403).json({ error: "Esta acción es solo para colaboradores" });
  }

  const { password } = req.body || {};
  const hasRequiredCharacters = typeof password === "string"
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
  if (typeof password !== "string" || password.length < 10 || !hasRequiredCharacters || password.toLowerCase() === "password") {
    return res.status(400).json({ error: "Usa al menos 10 caracteres, mayúscula, minúscula y número" });
  }

  try {
    const hash = await (await import("bcryptjs")).default.hash(password, 12);
    const pool = await getPool();
    await pool.request()
      .input("userId", sql.Int, req.auth.userId)
      .input("hash", sql.NVarChar(255), hash)
      .query(`UPDATE dbo.CredencialesUsuarios
              SET PasswordHash = @hash, DebeCambiarClave = 0
              WHERE UsuarioId = @userId`);
    res.status(204).end();
  } catch (err) {
    console.error("mi clave error", err);
    res.status(500).json({ error: "No se pudo actualizar la contraseña" });
  }
});

// Protegido: historial de cambios.
app.get("/api/admin/auditoria", requireAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Tabla,
        Accion,
        UsuarioSistema,
        FechaCambio,
        RegistroId,
        DatosAntes,
        DatosDespues
      FROM dbo.Auditoria
      ORDER BY FechaCambio DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("admin auditoria error", err);
    res.status(500).json({
      error: "No se pudo consultar auditoria",
      code: err.code || "SQL_UNKNOWN"
    });
  }
});

// Protegido: resumen de aperturas por usuario, incluyendo QR sin escaneos.
app.get("/api/stats", requireAdmin, async (req, res) => {
  const month = String(req.query.month || "");
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: "Mes inválido" });
  }

  try {
    const pool = await getPool();
    const request = pool.request();
    if (month) {
      request.input("startDate", sql.DateTime2, new Date(`${month}-01T00:00:00.000Z`));
      request.input("endDate", sql.DateTime2, new Date(`${month}-01T00:00:00.000Z`));
    }
    const result = await request.query(`
      SELECT
        u.Nombre,
        u.Apellido,
        u.Ciudad,
        q.Codigo,
        COUNT(e.Id) AS Aperturas
      FROM dbo.Usuarios u
      INNER JOIN dbo.QRs q ON q.UsuarioId = u.Id
      LEFT JOIN dbo.Escaneos e ON e.QRId = q.Id
        ${month ? "AND e.FechaEscaneo >= @startDate AND e.FechaEscaneo < DATEADD(MONTH, 1, @endDate)" : ""}
      GROUP BY u.Nombre, u.Apellido, u.Ciudad, q.Codigo
      ORDER BY Aperturas DESC, u.Nombre, u.Apellido
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("stats error", err);
    res.status(500).json({
      error: "No se pudo consultar",
      code: err.code || "SQL_UNKNOWN"
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor escuchando en puerto ${port}`));
