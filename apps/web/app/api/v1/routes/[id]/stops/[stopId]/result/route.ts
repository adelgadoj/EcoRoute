import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { clientTime, fail, guard, readJson } from "@/lib/driver";

// Confirma un contenedor: "collected" o "unable_to_collect" (con motivo).
// idempotency_key: si el celular reintenta con la misma clave, no se registra dos veces.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const { id, stopId } = await params;
  if (!UUID.test(id) || !UUID.test(stopId)) return fail("Contenedor no encontrado", 404);

  const body = await readJson(req);
  const result = body.result;
  const key = body.idempotency_key;
  if (result !== "collected" && result !== "unable_to_collect") return fail("Resultado inválido");
  if (typeof key !== "string" || !UUID.test(key)) return fail("Falta la clave de la operación");
  let reason: string | null = null;
  if (result === "unable_to_collect") {
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 200) return fail("Indica el motivo (de 3 a 200 caracteres)");
  }
  const when = clientTime(body.recorded_at);

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const stop = async (res: Response) => { await c.query("ROLLBACK"); return res; };

    // Bloquea la ruta: dos pulsaciones simultáneas se atienden una detrás de otra.
    const r = await c.query(
      `SELECT status FROM routes WHERE id = $1 AND organization_id = $2 AND driver_id = $3 FOR UPDATE`,
      [id, s.orgId, s.userId]);
    if (!r.rowCount) return await stop(fail("Ruta no encontrada", 404));

    const dup = await c.query(`SELECT route_stop_id FROM collection_events WHERE idempotency_key = $1`, [key]);
    if (dup.rowCount)
      return await stop(dup.rows[0].route_stop_id === stopId
        ? Response.json({ ok: true, repeated: true })
        : fail("Clave de operación repetida", 409));

    if (r.rows[0].status !== "active") return await stop(fail("La ruta no está en curso", 409));

    const st = await c.query(
      `SELECT status, sequence,
              (SELECT min(sequence) FROM route_stops WHERE route_id = $1 AND status = 'pending') AS next
         FROM route_stops WHERE id = $2 AND route_id = $1 AND organization_id = $3 FOR UPDATE`,
      [id, stopId, s.orgId]);
    if (!st.rowCount) return await stop(fail("Ese contenedor no pertenece a esta ruta", 404));
    const row = st.rows[0];
    if (row.status !== "pending") return await stop(fail("Este contenedor ya fue registrado", 409));
    if (row.sequence !== row.next) return await stop(fail("Registra primero el contenedor anterior", 409));

    await c.query(
      `INSERT INTO collection_events (organization_id, route_stop_id, driver_id, result, reason, recorded_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [s.orgId, stopId, s.userId, result, reason, when, key]);
    await c.query(
      `UPDATE route_stops SET status = $2, arrived_at = COALESCE(arrived_at, now()), completed_at = now() WHERE id = $1`,
      [stopId, result === "collected" ? "collected" : "skipped"]);
    await c.query("COMMIT");
    return Response.json({ ok: true });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
