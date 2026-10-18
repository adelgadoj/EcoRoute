import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { rows } = await pool.query(
    `SELECT u.full_name, u.email, o.name AS organization
       FROM users u JOIN organizations o ON o.id = $2 WHERE u.id = $1`,
    [s.userId, s.orgId]
  );
  return NextResponse.json({ ...rows[0], role: s.role });
}
