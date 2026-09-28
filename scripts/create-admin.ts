// Crea (una sola vez) la cuenta de administrador en Supabase Auth.
// Requiere PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_EMAIL y
// ADMIN_PASSWORD en el entorno (o en un archivo .env en la raíz del
// proyecto). Después de correrlo, borra ADMIN_EMAIL/ADMIN_PASSWORD de .env:
// la contraseña ya queda hasheada dentro de Supabase Auth.
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: seguimos con las variables ya presentes en el entorno.
}

const url = process.env.PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !secretKey || !email || !password) {
  console.error(
    "Faltan PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.",
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("No se pudo crear el administrador:", error.message);
    process.exit(1);
  }
  console.log(`Administrador creado: ${data.user.email} (${data.user.id})`);
  console.log(
    "Ahora borra ADMIN_EMAIL y ADMIN_PASSWORD de tu .env: ya no hacen falta.",
  );
}

main();
