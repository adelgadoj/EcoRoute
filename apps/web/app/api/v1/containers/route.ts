import { pool } from "@/lib/db";
import { fail, isUnique, json, staffSession } from "@/lib/session";

const validPoint = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export async function GET() {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { rows } = await pool.query(
    `SELECT id, code, address, container_type, active,
            ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM containers WHERE organization_id = $1 ORDER BY code`, [s.orgId]);
  return json(rows);
}

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
  const code = String(b.code ?? "").trim().toUpperCase(), lat = Number(b.lat), lng = Number(b.lng);
  const address = String(b.address ?? "").trim() || null;
  if (!code) return fail("Escribe el código del contenedor");
  if (!validPoint(lat, lng)) return fail("Toca el mapa para elegir la ubicación");
  try {
    const { rows } = await pool.query(
      `INSERT INTO containers(organization_id, code, location, address)
       VALUES($1,$2,ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5) RETURNING id`,
      [s.orgId, code, lat, lng, address]);
    return json(rows[0], 201);
  } catch (e) { return isUnique(e) ? fail("Ya existe un contenedor con ese código", 409) : fail("No se pudo guardar", 500); }
}
