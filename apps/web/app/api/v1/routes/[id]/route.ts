import { pool } from "@/lib/db";
import { SERVICE_S, routeInfo } from "@/lib/routing";
import { UUID, loadStops } from "@/lib/stops";
import { fail, json, staffSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// Datos de la ruta y sus contenedores en orden (para editarla o volver a asignarla).
export async function GET(_: Request, { params }: Ctx) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { id } = await params;
  if (!UUID.test(id)) return fail("No encontrada", 404);
  const r = await pool.query(
    `SELECT id, name, status, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date, vehicle_id, driver_id
       FROM routes WHERE id = $1 AND organization_id = $2`, [id, s.orgId]);
  if (!r.rowCount) return fail("No encontrada", 404);
  const st = await pool.query(
    "SELECT container_id FROM route_stops WHERE route_id = $1 AND organization_id = $2 ORDER BY sequence", [id, s.orgId]);
  return json({ ...r.rows[0], container_ids: st.rows.map((x) => x.container_id) });
}

// Cancelar una ruta, o editarla (nombre, fecha, camión, conductor y contenedores) mientras no haya empezado.
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!UUID.test(id)) return fail("No encontrada", 404);

  if (b.status === "cancelled") {
    const r = await pool.query(
      "UPDATE routes SET status = 'cancelled' WHERE id = $1 AND organization_id = $2 AND status IN ('planned','assigned')", [id, s.orgId]);
    return r.rowCount ? json({ ok: true }) : fail("La ruta no existe o ya no se puede cancelar", 404);
  }

  const cur = await pool.query("SELECT status FROM routes WHERE id = $1 AND organization_id = $2", [id, s.orgId]);
  if (!cur.rowCount) return fail("No encontrada", 404);
  if (!["planned", "assigned"].includes(cur.rows[0].status))
    return fail("Solo se puede editar una ruta que aún no empezó. Para repetirla usa “Volver a asignar”.", 409);

  const name = String(b.name ?? "").trim(), date = String(b.scheduled_date ?? "");
  const vid = String(b.vehicle_id ?? ""), did = String(b.driver_id ?? "");
  if (!name) return fail("Escribe el nombre de la ruta");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Elige la fecha");
  if (!UUID.test(vid) || !UUID.test(did)) return fail("Elige un camión y un conductor");
  const v = await pool.query("SELECT 1 FROM vehicles WHERE id = $1 AND organization_id = $2 AND active", [vid, s.orgId]);
  if (!v.rowCount) return fail("El camión no existe o está desactivado");
  const d = await pool.query(
    `SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.user_id = $1 AND m.organization_id = $2 AND m.role = 'driver' AND u.active`, [did, s.orgId]);
  if (!d.rowCount) return fail("El conductor no existe o está desactivado");
  const r = await loadStops(s.orgId, b.container_ids);
  if ("error" in r) return fail(r.error);

  const info = await routeInfo(r.stops);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const lock = await c.query("SELECT status FROM routes WHERE id = $1 AND organization_id = $2 FOR UPDATE", [id, s.orgId]);
    if (!["planned", "assigned"].includes(lock.rows[0]?.status)) { await c.query("ROLLBACK"); return fail("La ruta ya empezó y no se puede editar", 409); }
    await c.query("DELETE FROM route_stops WHERE route_id = $1 AND organization_id = $2", [id, s.orgId]);
    await c.query(
      `UPDATE routes SET name = $3, scheduled_date = $4, vehicle_id = $5, driver_id = $6,
              planned_distance_m = $7, planned_duration_s = $8, path = $9::jsonb
        WHERE id = $1 AND organization_id = $2`,
      [id, s.orgId, name, date, vid, did, info.distance_m, info.duration_s + SERVICE_S * r.stops.length,
       info.path ? JSON.stringify(info.path) : null]);
    for (const [i, stop] of r.stops.entries())
      await c.query("INSERT INTO route_stops(organization_id, route_id, container_id, sequence) VALUES($1,$2,$3,$4)", [s.orgId, id, stop.id, i + 1]);
    await c.query("COMMIT");
    return json({ ok: true, distance_m: info.distance_m, estimated: info.estimated });
  } catch {
    await c.query("ROLLBACK");
    return fail("No se pudo guardar los cambios", 500);
  } finally { c.release(); }
}
