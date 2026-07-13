import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "pulse_session";

type AdminRole = "super_admin" | "empresa_admin" | "vendedor";

type AdminSession = {
  email: string;
  rol: AdminRole;
  empresa_id?: string | null;
  exp: number;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET;

  if (!secret || secret.length < 24) {
    return null;
  }

  return secret;
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodePayload(input: string) {
  const bytes = decodeBase64Url(input);
  return new TextDecoder().decode(bytes);
}

async function verifySessionToken(token?: string | null): Promise<AdminSession | null> {
  try {
    if (!token || !token.includes(".")) return null;

    const [encodedPayload, encodedSignature] = token.split(".");
    if (!encodedPayload || !encodedSignature) return null;

    const secret = getSecret();
    if (!secret) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload)
    );

    if (!validSignature) return null;

    const payload = JSON.parse(decodePayload(encodedPayload)) as AdminSession;
    const rolesValidos: AdminRole[] = ["super_admin", "empresa_admin", "vendedor"];

    if (!payload.email || !rolesValidos.includes(payload.rol) || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

function redirectToLogin(req: NextRequest, pathname: string) {
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/bootstrap")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return redirectToLogin(req, pathname);
  }

  if ((session.rol === "empresa_admin" || session.rol === "vendedor") && !session.empresa_id) {
    return redirectToLogin(req, pathname);
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
