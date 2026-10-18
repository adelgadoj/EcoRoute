import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { fail, guard } from "@/lib/driver";

// Iniciar (o reanudar) la ruta. Los índices únicos de 002 impiden dos rutas en curso por conductor o camión.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Ruta no encontrada", 404);
  try {
    const r = await pool.query(
      `UPDATE routes SET status = 'active', started_at = COALESCE(started_at, now())
        WHERE id = $1 AND organization_id = $2 AND driver_id = $3
          AND status IN ('assigned','paused')
          AND scheduled_date <= (now() AT TIME ZONE 'America/Lima')::date`,
      [id, s.orgId, s.userId]);
    if (!r.rowCount) return fail("Esta ruta no se puede iniciar ahora (no está asignada o es de otra fecha)", 409);
    return Response.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return fail("Ya tienes otra ruta en curso, o ese camión está en uso en otra ruta", 409);
    throw e;
  }
}
