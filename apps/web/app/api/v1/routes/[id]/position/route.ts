import { pool } from "@/lib/db";
import { UUID } from "@/lib/stops";
import { clientTime, fail, guard, readJson } from "@/lib/driver";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Ubicación del camión mientras la ruta está activa (la envía el celular cada pocos segundos).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await guard(req);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Ruta no encontrada", 404);

  const b = await readJson(req);
  const lat = num(b.lat), lng = num(b.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("Ubicación inválida");
  const acc = num(b.accuracy);
  const speed = num(b.speed);

  const r = await pool.query(
    `INSERT INTO gps_positions (organization_id, route_id, location, accuracy_m, speed_mps, recorded_at)
     SELECT r.organization_id, r.id, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8
       FROM routes r
      WHERE r.id = $1 AND r.organization_id = $2 AND r.driver_id = $3 AND r.status = 'active'`,
    [id, s.orgId, s.userId, lng, lat, acc !== null && acc >= 0 ? acc : null, speed !== null && speed >= 0 ? speed : null,
     clientTime(b.recorded_at)]);
  return r.rowCount ? Response.json({ ok: true }) : fail("La ruta no está en curso", 409);
}
