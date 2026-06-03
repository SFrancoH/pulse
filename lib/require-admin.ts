import { cookies } from "next/headers";
import { getSessionCookieName, verifyAdminSessionToken, type AdminSession } from "@/lib/auth-token";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function requireProjectAccess(proyectoId: string) {
  const { session, error } = await requireAdminSession();

  if (error) {
    return {
      session: null,
      proyecto: null,
      error,
    };
  }

  const { data: proyecto, error: proyectoError } = await supabaseAdmin
    .from("proyectos")
    .select("id,empresa_id,nombre,slug")
    .eq("id", proyectoId)
    .maybeSingle();

  if (proyectoError || !proyecto) {
    return {
      session: null,
      proyecto: null,
      error: Response.json(
        {
          success: false,
          message: "Proyecto no encontrado.",
        },
        { status: 404 }
      ),
    };
  }

  if (!session || !canAccessEmpresa(session, proyecto.empresa_id)) {
    return {
      session: null,
      proyecto: null,
      error: Response.json(
        {
          success: false,
          message: "Acceso denegado.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    session,
    proyecto,
    error: null,
  };
}
