import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { getSessionCookieName, verifyAdminSessionToken } from "@/lib/auth-token";

export type AdminRole = "super_admin" | "empresa_admin";

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!password || !passwordHash) return false;
  return compare(password, passwordHash);
}

export async function getCurrentAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  return verifyAdminSessionToken(token);
}

export function requireSuperAdmin(session: Awaited<ReturnType<typeof getCurrentAdminSession>>) {
  if (!session || session.rol !== "super_admin") {
    throw new Error("No autorizado.");
  }
}
