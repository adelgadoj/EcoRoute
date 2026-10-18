import { pool } from "@/lib/db";
import { fail, json, staffSession } from "@/lib/session";

type Row = { code?: unknown; lat?: unknown; lng?: unknown; address?: unknown };

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
  const rows: Row[] = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return fail("El archivo no tiene filas");
  if (rows.length > 2000) return fail("Máximo 2000 contenedores por archivo");

  const seen = new Set<string>(), clean: [string, number, number, string | null][] = [];
  for (const [i, r] of rows.entries()) {
    const code = String(r.code ?? "").trim().toUpperCase(), lat = Number(r.lat), lng = Number(r.lng);
    if (!code) return fail(`Fila ${i + 1}: falta el código`);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return fail(`Fila ${i + 1} (${code}): coordenadas inválidas`);
    if (seen.has(code)) return fail(`El código ${code} está repetido en el archivo`);
    seen.add(code);
    clean.push([code, lat, lng, String(r.address ?? "").trim() || null]);
  }
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const [code, lat, lng, address] of clean)
      await c.query(
        `INSERT INTO containers(organization_id, code, location, address)
         VALUES($1,$2,ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5)`, [s.orgId, code, lat, lng, address]);
    await c.query("COMMIT");
    return json({ imported: clean.length }, 201);
  } catch (e) {
    await c.query("ROLLBACK");
    return (e as { code?: string }).code === "23505"
      ? fail("Algún código ya existe en el sistema. No se importó nada.", 409) : fail("No se pudo importar", 500);
  } finally { c.release(); }
}
