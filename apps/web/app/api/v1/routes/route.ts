import { pool } from "@/lib/db";
import { SERVICE_S, stats } from "@/lib/routing";
import { UUID, loadStops } from "@/lib/stops";
import { fail, json, staffSession } from "@/lib/session";

export async function GET() {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.status, to_char(r.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
            r.planned_distance_m, r.planned_duration_s, v.code AS vehicle, u.full_name AS driver,
            (SELECT count(*) FROM route_stops st WHERE st.route_id = r.id)::int AS stops
       FROM routes r
       JOIN vehicles v ON v.organization_id = r.organization_id AND v.id = r.vehicle_id
       JOIN users u ON u.id = r.driver_id
      WHERE r.organization_id = $1 ORDER BY r.scheduled_date DESC, r.created_at DESC LIMIT 200`, [s.orgId]);
  return json(rows);
}

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
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
  // Distancia y tiempo se calculan aquí con el orden final, no se confía en el navegador.
  const st = await stats(r.stops);
  const duration = st.duration_s + SERVICE_S * r.stops.length;

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const ins = await c.query(
      `INSERT INTO routes(organization_id, vehicle_id, driver_id, name, status, planned_distance_m, planned_duration_s, scheduled_date)
       VALUES($1,$2,$3,$4,'assigned',$5,$6,$7) RETURNING id`,
      [s.orgId, vid, did, name, st.distance_m, duration, date]);
    for (const [i, stop] of r.stops.entries())
      await c.query(
        "INSERT INTO route_stops(organization_id, route_id, container_id, sequence) VALUES($1,$2,$3,$4)",
        [s.orgId, ins.rows[0].id, stop.id, i + 1]);
    await c.query("COMMIT");
    return json({ id: ins.rows[0].id, distance_m: st.distance_m, duration_s: duration, estimated: st.estimated }, 201);
  } catch {
    await c.query("ROLLBACK");
    return fail("No se pudo guardar la ruta", 500);
  } finally { c.release(); }
}
