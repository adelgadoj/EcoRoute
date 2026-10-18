import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import RouteRunner from "@/components/RouteRunner";

export const dynamic = "force-dynamic";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = (await readSession((await cookies()).get(COOKIE)?.value))!;
  const r = await pool.query(
    `SELECT r.id, r.name, r.status, to_char(r.scheduled_date, 'YYYY-MM-DD') AS date,
            r.planned_distance_m, r.planned_duration_s, v.code AS vehicle,
            EXTRACT(EPOCH FROM (r.completed_at - r.started_at))::int AS elapsed
       FROM routes r JOIN vehicles v ON v.organization_id = r.organization_id AND v.id = r.vehicle_id
      WHERE r.id = $1 AND r.organization_id = $2 AND r.driver_id = $3`, [id, s.orgId, s.userId]);
  if (!r.rowCount) notFound();
  const st = await pool.query(
    `SELECT st.id, st.sequence, st.status, c.code, c.address,
            ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lng
       FROM route_stops st JOIN containers c ON c.organization_id = st.organization_id AND c.id = st.container_id
      WHERE st.organization_id = $1 AND st.route_id = $2 ORDER BY st.sequence`, [s.orgId, id]);
  const x = r.rows[0];
  return (
    <RouteRunner
      route={{ id: x.id, name: x.name, status: x.status, date: x.date, vehicle: x.vehicle,
               distanceM: x.planned_distance_m ?? 0, durationS: x.planned_duration_s ?? 0, elapsed: x.elapsed }}
      stops={st.rows}
    />
  );
}
