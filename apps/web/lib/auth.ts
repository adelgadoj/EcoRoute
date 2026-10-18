import { SignJWT, jwtVerify } from "jose";

export type Role = "owner" | "admin" | "dispatcher" | "driver";
export type Session = { userId: string; orgId: string; role: Role };
export const COOKIE = "ecoroute_session";
export const isStaff = (r: Role) => r !== "driver";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session) {
  return new SignJWT({ org: s.orgId, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function readSession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: String(payload.sub), orgId: String(payload.org), role: payload.role as Role };
  } catch {
    return null;
  }
}
