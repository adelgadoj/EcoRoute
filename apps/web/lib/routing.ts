// Orden de paradas con heurística (vecino más cercano + 2-opt) y trazado por calles con OSRM.
// Si OSRM no responde, se usa una estimación propia con distancias en línea recta.
export type Pt = { lat: number; lng: number };
export type Path = [number, number][];
export type Stats = { distance_m: number; duration_s: number; estimated: boolean };
export type Plan = Stats & { order: number[]; path: Path | null };

const BASE = process.env.OSRM_URL ?? "https://router.project-osrm.org";
export const SERVICE_S = 60; // tiempo supuesto por contenedor (segundos)

const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: Pt, b: Pt) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
const coords = (p: Pt[]) => p.map((x) => `${x.lng},${x.lat}`).join(";");
const fallbackSeconds = (a: Pt, b: Pt) => (haversine(a, b) * 1.3) / 6.9; // calles no son línea recta

async function osrm(path: string) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "EcoRoute/0.1" } });
  if (!r.ok) throw new Error("osrm " + r.status);
  const d = await r.json();
  if (d.code !== "Ok") throw new Error("osrm " + d.code);
  return d;
}

// Matriz de tiempos de manejo entre todas las paradas.
async function matrix(p: Pt[]): Promise<{ m: number[][]; estimated: boolean }> {
  try {
    const d = await osrm(`/table/v1/driving/${coords(p)}?annotations=duration`);
    const m = d.durations as (number | null)[][];
    if (m.some((row) => row.some((v) => v === null))) throw new Error("sin ruta entre algunos puntos");
    return { m: m as number[][], estimated: false };
  } catch {
    return { m: p.map((a) => p.map((b) => fallbackSeconds(a, b))), estimated: true };
  }
}

const pathCost = (order: number[], m: number[][]) => {
  let c = 0;
  for (let k = 1; k < order.length; k++) c += m[order[k - 1]][order[k]];
  return c;
};

// Vecino más cercano desde la primera parada y luego 2-opt: invierte tramos mientras baje el tiempo total.
function heuristic(m: number[][]): number[] {
  const n = m.length, left = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1)), order = [0];
  while (left.size) {
    const last = order[order.length - 1];
    let best = -1, bd = Infinity;
    for (const j of left) if (m[last][j] < bd) { bd = m[last][j]; best = j; }
    order.push(best); left.delete(best);
  }
  let cost = pathCost(order, m), improved = true, passes = 0;
  while (improved && passes++ < 30) {
    improved = false;
    for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
      const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
      const c = pathCost(cand, m);
      if (c < cost - 1e-6) { order.splice(0, n, ...cand); cost = c; improved = true; }
    }
  }
  return order;
}

// Distancia, tiempo y trazado por calles de las paradas, en el orden dado.
export async function routeInfo(p: Pt[]): Promise<Stats & { path: Path | null }> {
  if (p.length < 2) return { distance_m: 0, duration_s: 0, estimated: false, path: p.length ? [[p[0].lat, p[0].lng]] : null };
  try {
    const d = await osrm(`/route/v1/driving/${coords(p)}?overview=full&geometries=geojson`);
    const line = d.routes[0].geometry.coordinates as [number, number][];
    const step = Math.max(1, Math.ceil(line.length / 3000));
    const path = line.filter((_, i) => i % step === 0 || i === line.length - 1).map(([lng, lat]) => [lat, lng] as [number, number]);
    return { distance_m: Math.round(d.routes[0].distance), duration_s: Math.round(d.routes[0].duration), estimated: false, path };
  } catch {
    let m = 0;
    for (let i = 1; i < p.length; i++) m += haversine(p[i - 1], p[i]) * 1.3;
    return { distance_m: Math.round(m), duration_s: Math.round(m / 6.9), estimated: true, path: null };
  }
}

export async function stats(p: Pt[]): Promise<Stats> {
  const { distance_m, duration_s, estimated } = await routeInfo(p);
  return { distance_m, duration_s, estimated };
}

// Ordena las paradas (la primera es el punto de partida; la ruta no vuelve al inicio).
export async function optimize(p: Pt[]): Promise<Plan> {
  if (p.length < 2) return { order: p.map((_, i) => i), distance_m: 0, duration_s: 0, estimated: false, path: null };
  const { m, estimated } = await matrix(p);
  const order = heuristic(m);
  const info = await routeInfo(order.map((i) => p[i]));
  return { order, ...info, estimated: info.estimated || estimated };
}
