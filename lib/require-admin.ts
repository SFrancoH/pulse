import { cookies } from "next/headers";
import { getSessionCookieName, verifyAdminSessionToken, type AdminSession } from "@/lib/auth-token";

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  return verifyAdminSessionToken(token);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    return {
      session: null,
      error: Response.json(
        {
          success: false,
          message: "No autorizado.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    session,
    error: null,
  };
}

export async function requireSuperAdmin() {
  const { session, error } = await requireAdminSession();

  if (error) return { session: null, error };

  if (session?.rol !== "super_admin") {
    return {
      session: null,
      error: Response.json(
        {
          success: false,
          message: "Acceso denegado.",
        },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}

export function canAccessEmpresa(session: AdminSession, empresaId: string) {
  if (session.rol === "super_admin") return true;
  return Boolean(session.empresa_id && session.empresa_id === empresaId);
}
