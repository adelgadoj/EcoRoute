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
  if (b.code !== undefined) { const c = String(b.code).trim().toUpperCase(); if (!c) return fail("El código no puede estar vacío"); add("code", c); }
  if (b.plate !== undefined) { const p = String(b.plate).trim().toUpperCase(); if (!p) return fail("La placa no puede estar vacía"); add("plate", p); }
  if (b.capacity_kg !== undefined) {
    const v = b.capacity_kg === "" || b.capacity_kg === null ? null : Number(b.capacity_kg);
    if (v !== null && (!Number.isFinite(v) || v <= 0)) return fail("La capacidad debe ser un número mayor que 0");
    add("capacity_kg", v);
  }
  if (!sets.length) return fail("Nada que cambiar");
  vals.push(id, s.orgId);
  try {
    const r = await pool.query(`UPDATE vehicles SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND organization_id = $${vals.length}`, vals);
    return r.rowCount ? json({ ok: true }) : fail("No encontrado", 404);
  } catch (e) { return isUnique(e) ? fail("Ya existe un camión con ese código o placa", 409) : fail("No se pudo guardar", 500); }
}
