import { cookies } from "next/headers";
import { COOKIE, readSession } from "@/lib/auth";

export type Sess = { userId: string; orgId: string };

export async function currentSession(): Promise<Sess | null> {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  return s ? { userId: s.userId, orgId: s.orgId } : null;
}

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

// Rechaza POST que vengan de otro origen (protección básica contra CSRF).
function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(o).host === host; } catch { return false; }
}

// Devuelve la sesión o la respuesta de error que hay que enviar.
export async function guard(req: Request): Promise<Sess | Response> {
  if (!sameOrigin(req)) return fail("Origen no permitido", 403);
  return (await currentSession()) ?? fail("Tu sesión venció. Entra de nuevo.", 401);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try { const b = await req.json(); return b && typeof b === "object" ? (b as Record<string, unknown>) : {}; }
  catch { return {}; }
}

// Hora que manda el celular; si es absurda (futuro o más de 24 h atrás) se usa la del servidor.
export function clientTime(v: unknown): Date {
  const d = typeof v === "string" ? new Date(v) : new Date(NaN);
  const now = Date.now();
  const t = d.getTime();
  return Number.isNaN(t) || t > now + 5 * 60e3 || t < now - 24 * 3600e3 ? new Date(now) : d;
}
