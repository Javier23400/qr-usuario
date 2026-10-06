import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool, sql } from "./db.js";

const TOKEN_TTL = "8h";

export async function verifyCredentials(username, password) {
  if (username !== process.env.ADMIN_USER) {
    const pool = await getPool();
    const result = await pool.request()
      .input("username", sql.NVarChar(100), String(username).trim().toLowerCase())
      .query(`SELECT TOP 1
                c.UsuarioId,
                c.NombreUsuario,
                c.PasswordHash,
                c.DebeCambiarClave,
                u.Nombre,
                u.Apellido
              FROM dbo.CredencialesUsuarios c
              INNER JOIN dbo.Usuarios u ON u.Id = c.UsuarioId
              WHERE c.NombreUsuario = @username AND c.Activo = 1`);

    const collaborator = result.recordset[0];
    if (!collaborator || !await bcrypt.compare(password, collaborator.PasswordHash)) {
      return null;
    }

    await pool.request()
      .input("userId", sql.Int, collaborator.UsuarioId)
      .query("UPDATE dbo.CredencialesUsuarios SET UltimoAcceso = SYSUTCDATETIME() WHERE UsuarioId = @userId");

    return {
      role: "collaborator",
      username: collaborator.NombreUsuario,
      userId: collaborator.UsuarioId,
      name: `${collaborator.Nombre} ${collaborator.Apellido || ""}`.trim(),
      mustChangePassword: collaborator.DebeCambiarClave
    };
  }

  const isAdmin = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
  return isAdmin ? { role: "admin", username } : null;
}

export function issueToken(session) {
  return jwt.sign({
    sub: session.username,
    role: session.role,
    userId: session.userId || null
  }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAuthenticated(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token invalido o expirado" });
  }
}

export function requireAdmin(req, res, next) {
  requireAuthenticated(req, res, () => {
    if (req.auth.role !== "admin") {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    next();
  });
}
