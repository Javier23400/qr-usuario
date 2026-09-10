import sql from "mssql";

const config = {
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_CERT === "true"
  }
};

let poolPromise;

// Reutiliza una sola conexion en vez de abrir una nueva por cada peticion.
export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

export { sql };
