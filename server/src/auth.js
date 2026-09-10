import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "8h";

export async function verifyAdminCredentials(username, password) {
  if (username !== process.env.ADMIN_USER) {
    return false;
  }
  // ADMIN_PASSWORD_HASH se genera con "npm run hash-password", nunca se guarda en texto plano.
  return bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
}

export function issueToken(username) {
  return jwt.sign({ sub: username, role: "admin" }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token invalido o expirado" });
  }
}
