import { cookies } from "next/headers";
import { COOKIE, isStaff, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { routeInfo } from "@/lib/routing";
import { UUID } from "@/lib/stops";
import { fail, json } from "@/lib/session";

// Trazado por calles de una ruta. Lo pueden pedir el personal de la organización y el conductor dueño de la ruta.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  if (!s) return fail("No autenticado", 401);
  const { id } = await params;
  if (!UUID.test(id)) return fail("No encontrada", 404);
  const r = await pool.query(
    "SELECT path FROM routes WHERE id = $1 AND organization_id = $2 AND ($3::boolean OR driver_id = $4)",
    [id, s.orgId, isStaff(s.role), s.userId]);
  if (!r.rowCount) return fail("No encontrada", 404);
  if (r.rows[0].path) return json({ path: r.rows[0].path });

  const st = await pool.query(
    `SELECT ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lng
       FROM route_stops s JOIN containers c ON c.organization_id = s.organization_id AND c.id = s.container_id
      WHERE s.route_id = $1 AND s.organization_id = $2 ORDER BY s.sequence`, [id, s.orgId]);
  if (st.rows.length < 2) return json({ path: null });
  const info = await routeInfo(st.rows);
  if (!info.path) return json({ path: null }); // sin servicio de rutas: el mapa dibuja líneas rectas
  await pool.query("UPDATE routes SET path = $1::jsonb WHERE id = $2 AND organization_id = $3 AND path IS NULL",
    [JSON.stringify(info.path), id, s.orgId]);
  return json({ path: info.path });
}
