import { SERVICE_S, optimize } from "@/lib/routing";
import { loadStops } from "@/lib/stops";
import { fail, json, staffSession } from "@/lib/session";

export async function POST(req: Request) {
  const s = await staffSession(); if (!s) return fail("No autorizado", 403);
  const b = await req.json().catch(() => ({}));
  const r = await loadStops(s.orgId, b.container_ids);
  if ("error" in r) return fail(r.error);
  const plan = await optimize(r.stops);
  return json({
    container_ids: plan.order.map((i) => r.stops[i].id),
    distance_m: plan.distance_m,
    duration_s: plan.duration_s + SERVICE_S * r.stops.length,
    estimated: plan.estimated,
    path: plan.path,
  });
}
