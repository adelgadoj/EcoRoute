import { cookies } from "next/headers";
import { COOKIE, isStaff, readSession } from "./auth";

// Devuelve la sesión solo si es personal de la organización (no conductor).
export async function staffSession() {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  return s && isStaff(s.role) ? s : null;
}
export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (msg: string, status = 400) => Response.json({ error: msg }, { status });
export const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";
