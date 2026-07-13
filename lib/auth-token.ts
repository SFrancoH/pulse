import { createHmac, timingSafeEqual } from "crypto";

export type AdminRole = "super_admin" | "empresa_admin" | "vendedor";

export type AdminSession = {
  email: string;
  rol: AdminRole;
  empresa_id?: string | null;
  exp: number;
};

const COOKIE_NAME = "pulse_session";
const SESSION_HOURS = 8;

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("Falta ADMIN_SESSION_SECRET o ADMIN_SECRET con mínimo 24 caracteres.");
  }

  return secret;
}

function signPayload(payload: string) {
  return base64url(createHmac("sha256", getSecret()).update(payload).digest());
}

export function createAdminSessionToken(input: Omit<AdminSession, "exp">) {
  const payload: AdminSession = {
    ...input,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string | null): AdminSession | null {
  try {
    if (!token || !token.includes(".")) return null;

    const [encodedPayload, signature] = token.split(".");
    const expected = signPayload(encodedPayload);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(fromBase64url(encodedPayload)) as AdminSession;

    if (!payload.email || !payload.rol || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
