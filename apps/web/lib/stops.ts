import { pool } from "./db";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Stop = { id: string; code: string; address: string | null; lat: number; lng: number };

// Carga contenedores activos de la organización, respetando el orden recibido.
export async function loadStops(orgId: string, ids: unknown): Promise<{ error: string } | { stops: Stop[] }> {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) return { error: "Elige entre 1 y 100 contenedores" };
  if (!ids.every((x) => typeof x === "string" && UUID.test(x)) || new Set(ids).size !== ids.length)
    return { error: "Lista de contenedores inválida" };
  const { rows } = await pool.query(
    `SELECT id, code, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM containers WHERE organization_id = $1 AND active AND id = ANY($2::uuid[])`, [orgId, ids]);
  const by = new Map<string, Stop>(rows.map((r) => [r.id, r]));
  if (by.size !== ids.length) return { error: "Algún contenedor no existe o está desactivado" };
  return { stops: (ids as string[]).map((id) => by.get(id)!) };
}
