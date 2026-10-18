import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { fail, isUnique, json, staffSession } from "@/lib/session";

export async function GET() {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.active FROM users u JOIN memberships m ON m.user_id = u.id
      WHERE m.organization_id = $1 AND m.role = 'driver' ORDER BY u.full_name`, [s.orgId]);
  return json(rows);
}

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
  const name = String(b.full_name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), pw = String(b.password ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return fail("Escribe un nombre y un correo válido");
  if (pw.length < 10) return fail("La contraseña debe tener al menos 10 caracteres");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const u = await c.query("INSERT INTO users(email, full_name, password_hash) VALUES($1,$2,$3) RETURNING id",
      [email, name, await bcrypt.hash(pw, 12)]);
    await c.query("INSERT INTO memberships(organization_id, user_id, role) VALUES($1,$2,'driver')", [s.orgId, u.rows[0].id]);
    await c.query("COMMIT");
    return json({ id: u.rows[0].id }, 201);
  } catch (e) {
    await c.query("ROLLBACK");
    return isUnique(e) ? fail("Ese correo ya está registrado", 409) : fail("No se pudo guardar", 500);
  } finally { c.release(); }
}
