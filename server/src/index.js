import "dotenv/config";
import express from "express";
import cors from "cors";
import { getPool, sql } from "./db.js";
import { verifyAdminCredentials, issueToken, requireAdmin } from "./auth.js";

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

  const ok = await verifyAdminCredentials(username, password);
  if (!ok) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  res.json({ token: issueToken(username) });
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

// Protegido: resumen de aperturas por usuario y fecha.
app.get("/api/stats", requireAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Nombre,
        u.Apellido,
        u.Ciudad,
        q.Codigo,
        CAST(e.FechaEscaneo AS DATE) AS Dia,
        COUNT(*) AS Aperturas
      FROM dbo.Escaneos e
      INNER JOIN dbo.QRs q ON q.Id = e.QRId
      INNER JOIN dbo.Usuarios u ON u.Id = q.UsuarioId
      GROUP BY u.Nombre, u.Apellido, u.Ciudad, q.Codigo, CAST(e.FechaEscaneo AS DATE)
      ORDER BY Dia DESC, Aperturas DESC
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
