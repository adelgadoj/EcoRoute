// Uso (desde apps/web):
// node --env-file=../../.env scripts/create-user.mjs --org "Municipalidad Demo" \
//   --email admin@demo.pe --name "Admin Demo" --role admin --password "TuClaveSegura123"
import bcrypt from "bcryptjs";
import pg from "pg";

const args = process.argv.slice(2);
const a = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) a[args[i].slice(2)] = args[i + 1];
for (const k of ["org", "email", "name", "role", "password"]) if (!a[k]) { console.error("Falta --" + k); process.exit(1); }
if (!["owner", "admin", "dispatcher", "driver"].includes(a.role)) { console.error("Rol inválido"); process.exit(1); }
if (a.password.length < 10) { console.error("La contraseña debe tener al menos 10 caracteres"); process.exit(1); }

const slug = a.org.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query("BEGIN");
  const org = await c.query("INSERT INTO organizations(name,slug) VALUES($1,$2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id", [a.org, slug]);
  const hash = await bcrypt.hash(a.password, 12);
  const u = await c.query("INSERT INTO users(email,full_name,password_hash) VALUES($1,$2,$3) RETURNING id", [a.email.toLowerCase(), a.name, hash]);
  await c.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,$3)", [org.rows[0].id, u.rows[0].id, a.role]);
  await c.query("COMMIT");
  console.log("Usuario creado:", a.email, "(" + a.role + ")");
} catch (e) { await c.query("ROLLBACK"); console.error(e.message); process.exitCode = 1; } finally { await c.end(); }
