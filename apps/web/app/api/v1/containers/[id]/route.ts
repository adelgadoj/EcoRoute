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
  if (b.address !== undefined) add("address", String(b.address).trim() || null);
  if (b.lat !== undefined || b.lng !== undefined) {
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("Ubicación inválida");
    vals.push(lng, lat);
    sets.push(`location = ST_SetSRID(ST_MakePoint($${vals.length - 1}::float8, $${vals.length}::float8), 4326)::geography`);
  }
  if (!sets.length) return fail("Nada que cambiar");
  vals.push(id, s.orgId);
  try {
    const r = await pool.query(`UPDATE containers SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND organization_id = $${vals.length}`, vals);
    return r.rowCount ? json({ ok: true }) : fail("No encontrado", 404);
  } catch (e) { return isUnique(e) ? fail("Ya existe un contenedor con ese código", 409) : fail("No se pudo guardar", 500); }
}
