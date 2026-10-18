import { pool } from "@/lib/db";
import { fail, isUnique, json, staffSession } from "@/lib/session";

export async function GET() {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const { rows } = await pool.query(
    "SELECT id, code, plate, capacity_kg, active FROM vehicles WHERE organization_id = $1 ORDER BY code", [s.orgId]);
  return json(rows);
}

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
  const code = String(b.code ?? "").trim().toUpperCase(), plate = String(b.plate ?? "").trim().toUpperCase();
  const cap = b.capacity_kg === "" || b.capacity_kg == null ? null : Number(b.capacity_kg);
  if (!code || !plate) return fail("Escribe el código y la placa");
  if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) return fail("La capacidad debe ser un número mayor que 0");
  try {
    const { rows } = await pool.query(
      "INSERT INTO vehicles(organization_id, code, plate, capacity_kg) VALUES($1,$2,$3,$4) RETURNING id",
      [s.orgId, code, plate, cap]);
    return json(rows[0], 201);
  } catch (e) { return isUnique(e) ? fail("Ya existe un camión con ese código o placa", 409) : fail("No se pudo guardar", 500); }
}
