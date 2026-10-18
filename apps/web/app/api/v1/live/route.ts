import { pool } from "@/lib/db";
import { fail, guard } from "@/lib/driver";

export const dynamic = "force-dynamic";

// Foto del momento para el panel del administrador: rutas activas, su última ubicación, avance e incidencias abiertas.
export async function GET(req: Request) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const m = await pool.query(`SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`, [s.orgId, s.userId]);
  if (!["owner", "admin", "dispatcher"].includes(m.rows[0]?.role)) return fail("No tienes permiso para ver esto", 403);

  const routes = (await pool.query(
    `SELECT r.id, r.name, r.started_at, v.code AS vehicle, u.full_name AS driver,
            (SELECT count(*)::int FROM route_stops x WHERE x.route_id = r.id) AS total,
            (SELECT count(*)::int FROM route_stops x WHERE x.route_id = r.id AND x.status = 'collected') AS collected,
            (SELECT count(*)::int FROM route_stops x WHERE x.route_id = r.id AND x.status = 'skipped') AS skipped,
            p.lat, p.lng, p.recorded_at, p.speed_mps
       FROM routes r
       JOIN vehicles v ON v.organization_id = r.organization_id AND v.id = r.vehicle_id
       JOIN users u ON u.id = r.driver_id
       LEFT JOIN LATERAL (
            SELECT ST_Y(g.location::geometry) AS lat, ST_X(g.location::geometry) AS lng, g.recorded_at, g.speed_mps
              FROM gps_positions g WHERE g.route_id = r.id ORDER BY g.recorded_at DESC LIMIT 1) p ON true
      WHERE r.organization_id = $1 AND r.status = 'active'
      ORDER BY r.started_at`, [s.orgId])).rows;

  const ids = routes.map((r) => r.id);
  const stops = ids.length ? (await pool.query(
    `SELECT st.route_id, st.sequence, st.status, c.code, c.address,
            ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lng
       FROM route_stops st JOIN containers c ON c.organization_id = st.organization_id AND c.id = st.container_id
      WHERE st.organization_id = $1 AND st.route_id = ANY($2::uuid[]) ORDER BY st.route_id, st.sequence`,
    [s.orgId, ids])).rows : [];

  const incidents = (await pool.query(
    `SELECT i.id, i.route_id, i.category, i.description, i.created_at, u.full_name AS driver, r.name AS route_name
       FROM incidents i JOIN users u ON u.id = i.driver_id
       LEFT JOIN routes r ON r.organization_id = i.organization_id AND r.id = i.route_id
      WHERE i.organization_id = $1 AND i.status <> 'resolved' ORDER BY i.created_at DESC LIMIT 50`, [s.orgId])).rows;

  return Response.json({ routes, stops, incidents });
}
