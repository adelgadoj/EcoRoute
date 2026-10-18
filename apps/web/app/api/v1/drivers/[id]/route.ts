import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { fail, isUnique, json, staffSession } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { id } = await params;
  if (!UUID.test(id)) return fail("No encontrado", 404);
  const b = await req.json().catch(() => ({}));
  const sets: string[] = [], vals: unknown[] = [];
  const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (typeof b.active === "boolean") add("active", b.active);
  if (b.full_name !== undefined) { const n = String(b.full_name).trim(); if (!n) return fail("El nombre no puede estar vacío"); add("full_name", n); }
  if (b.email !== undefined) {
    const e = String(b.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return fail("Escribe un correo válido");
    add("email", e);
  }
  if (b.password !== undefined && String(b.password) !== "") {
    const p = String(b.password);
    if (p.length < 10) return fail("La contraseña debe tener al menos 10 caracteres");
    add("password_hash", await bcrypt.hash(p, 12));
  }
  if (!sets.length) return fail("Nada que cambiar");
  vals.push(id, s.orgId);
  try {
    // Solo conductores de esta organización.
    const r = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND EXISTS (
         SELECT 1 FROM memberships m WHERE m.user_id = users.id AND m.organization_id = $${vals.length} AND m.role = 'driver')`, vals);
    return r.rowCount ? json({ ok: true }) : fail("No encontrado", 404);
  } catch (e) { return isUnique(e) ? fail("Ese correo ya está registrado", 409) : fail("No se pudo guardar", 500); }
}
