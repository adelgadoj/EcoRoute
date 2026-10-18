import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { COOKIE, Role, isStaff, signSession } from "@/lib/auth";

// Hash falso para que el tiempo de respuesta no revele si el correo existe.
const DUMMY = bcrypt.hashSync("no-existe", 10);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "Escribe tu correo y tu contraseña" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, m.organization_id, m.role
       FROM users u JOIN memberships m ON m.user_id = u.id
      WHERE u.email = $1 AND u.active LIMIT 1`,
    [email]
  );
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY);
  if (!u || !ok) return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });

  const role = u.role as Role;
  const token = await signSession({ userId: u.id, orgId: u.organization_id, role });
  const res = NextResponse.json({ redirect: isStaff(role) ? "/dashboard" : "/driver" });
  res.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
    secure: process.env.COOKIE_SECURE === "true",
  });
  return res;
}
