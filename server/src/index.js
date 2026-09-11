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
    await pool.request()
      .input("codigo", sql.VarChar(20), String(codigo).slice(0, 20))
      .input("nombre", sql.NVarChar(200), String(nombre).slice(0, 200))
      .input("ciudad", sql.VarChar(50), ciudadUpper)
      .input("userAgent", sql.NVarChar(500), String(req.get("user-agent") || "").slice(0, 500))
      .query(`INSERT INTO dbo.QrOpens (Codigo, Nombre, Ciudad, UserAgent)
              VALUES (@codigo, @nombre, @ciudad, @userAgent)`);
    res.status(204).end();
  } catch (err) {
    console.error("track error", err);
    res.status(500).json({ error: "No se pudo registrar" });
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

// Protegido: solo con token de administrador valido.
app.get("/api/stats", requireAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Codigo, Nombre, Ciudad, CAST(OpenedAt AS DATE) AS Dia, COUNT(*) AS Aperturas
      FROM dbo.QrOpens
      GROUP BY Codigo, Nombre, Ciudad, CAST(OpenedAt AS DATE)
      ORDER BY Dia DESC, Aperturas DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("stats error", err);
    res.status(500).json({ error: "No se pudo consultar" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor escuchando en puerto ${port}`));
