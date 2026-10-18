import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { fail, guard, readJson } from "@/lib/driver";

const CATEGORIES = ["vehicle", "blocked_road", "container", "safety", "other"];

// El conductor reporta una incidencia; el administrador la ve en el panel en vivo.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Ruta no encontrada", 404);

  const body = await readJson(req);
  const category = typeof body.category === "string" ? body.category : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!CATEGORIES.includes(category)) return fail("Tipo de incidencia inválido");
  if (description.length < 3 || description.length > 500) return fail("Describe la incidencia (de 3 a 500 caracteres)");

  // No inserta si hay otra idéntica de hace menos de 30 s (doble pulsación).
  const r = await pool.query(
    `INSERT INTO incidents (organization_id, route_id, driver_id, category, description)
     SELECT r.organization_id, r.id, r.driver_id, $4, $5 FROM routes r
      WHERE r.id = $1 AND r.organization_id = $2 AND r.driver_id = $3 AND r.status IN ('active','paused')
        AND NOT EXISTS (SELECT 1 FROM incidents i WHERE i.route_id = r.id AND i.description = $5
                         AND i.created_at > now() - interval '30 seconds')
      RETURNING id`,
    [id, s.orgId, s.userId, category, description]);
  if (r.rowCount) return Response.json({ ok: true });

  const chk = await pool.query(
    `SELECT 1 FROM routes WHERE id = $1 AND organization_id = $2 AND driver_id = $3 AND status IN ('active','paused')`,
    [id, s.orgId, s.userId]);
  return chk.rowCount ? Response.json({ ok: true, repeated: true }) : fail("La ruta no está en curso", 409);
}
