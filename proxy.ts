import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieName, verifyAdminSessionToken } from "@/lib/auth-token";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/bootstrap")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getSessionCookieName())?.value;
  const session = verifyAdminSessionToken(token);

  if (!session) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(getSessionCookieName());
    return response;
  }

  if ((session.rol === "empresa_admin" || session.rol === "vendedor") && !session.empresa_id) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(getSessionCookieName());
    return response;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-admin-email", session.email);
  requestHeaders.set("x-admin-role", session.rol);
  if (session.empresa_id) requestHeaders.set("x-admin-empresa-id", session.empresa_id);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
