import { NextRequest, NextResponse } from "next/server";
import { COOKIE, isStaff, readSession } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (!s) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/dashboard") && !isStaff(s.role)) return NextResponse.redirect(new URL("/driver", req.url));
  if (pathname.startsWith("/driver") && isStaff(s.role)) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

// Añade aquí cada endpoint privado nuevo (excepto /api/v1/auth/*).
export const config = {
  matcher: ["/dashboard/:path*", "/driver/:path*", "/api/v1/me", "/api/v1/vehicles/:path*",
    "/api/v1/drivers/:path*", "/api/v1/containers/:path*", "/api/v1/routes/:path*"],
};
