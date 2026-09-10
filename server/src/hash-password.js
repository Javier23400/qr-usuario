// Uso: node src/hash-password.js TuContraseñaSegura
// Copia el resultado como valor de ADMIN_PASSWORD_HASH en las variables de entorno del hosting.
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Uso: node src/hash-password.js TuContraseña");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
