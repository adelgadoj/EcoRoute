import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { fail, guard } from "@/lib/driver";

// Finaliza la ruta. Exige que todos los contenedores estén registrados (recogidos o con motivo).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Ruta no encontrada", 404);

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const stop = async (res: Response) => { await c.query("ROLLBACK"); return res; };
    const r = await c.query(
      `SELECT status FROM routes WHERE id = $1 AND organization_id = $2 AND driver_id = $3 FOR UPDATE`,
      [id, s.orgId, s.userId]);
    if (!r.rowCount) return await stop(fail("Ruta no encontrada", 404));
    if (r.rows[0].status === "completed") return await stop(Response.json({ ok: true, repeated: true }));
    if (r.rows[0].status !== "active") return await stop(fail("La ruta no está en curso", 409));

    const p = await c.query(
      `SELECT count(*)::int AS n FROM route_stops WHERE route_id = $1 AND organization_id = $2 AND status = 'pending'`,
      [id, s.orgId]);
    if (p.rows[0].n > 0)
      return await stop(fail(`Quedan ${p.rows[0].n} contenedores sin registrar. Márcalos como recogidos o "No se pudo".`, 409));

    await c.query(`UPDATE routes SET status = 'completed', completed_at = now() WHERE id = $1`, [id]);
    await c.query("COMMIT");
    return Response.json({ ok: true });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
