import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  getSessionCookieName,
  verifyAdminSessionToken,
  type AdminRole,
  type AdminSession,
} from "@/lib/auth-token";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type { AdminRole };

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!password || !passwordHash) return false;
  return compare(password, passwordHash);
}

export const getCurrentAdminSession = cache(async (): Promise<AdminSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const session = verifyAdminSessionToken(token);

  if (!session) return null;

  // La cookie permite una verificación optimista. La base de datos confirma
  // estado, rol y empresa en cada operación protegida. Para cookies antiguas
  // sin user_id se conserva temporalmente la resolución por email.
  let userQuery = supabaseAdmin
    .from("admin_users")
    .select("id,email,role,empresa_id,estado");

  userQuery = session.user_id
    ? userQuery.eq("id", session.user_id)
    : userQuery.eq("email", session.email);

  const { data: user, error } = await userQuery.maybeSingle();

  if (error || !user || user.estado !== "activo") return null;

  return {
    ...session,
    user_id: user.id,
    email: user.email,
    rol: user.role as AdminRole,
    empresa_id: user.empresa_id,
  };
});

export function requireSuperAdmin(session: Awaited<ReturnType<typeof getCurrentAdminSession>>) {
  if (!session || session.rol !== "super_admin") {
    throw new Error("No autorizado.");
  }
}
