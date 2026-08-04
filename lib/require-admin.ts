import "server-only";

import { getCurrentAdminSession } from "@/lib/admin-auth";
import type { AdminSession } from "@/lib/auth-token";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProyectoAdmin = {
  id: string;
  empresa_id: string;
  nombre: string | null;
  slug: string | null;
};

function unauthorized(message = "No autorizado.", status = 403) {
  return Response.json({ success: false, message }, { status });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return getCurrentAdminSession();
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    return {
      session: null,
      error: unauthorized("No autorizado.", 401),
    };
  }

  return { session, error: null };
}

export async function requireSuperAdmin() {
  const { session, error } = await requireAdminSession();

  if (error) return { session: null, error };
  if (session?.rol !== "super_admin") {
    return { session: null, error: unauthorized("Acceso denegado.") };
  }

  return { session, error: null };
}

export function isCompanyManager(session: AdminSession) {
  return session.rol === "super_admin" || session.rol === "empresa_admin";
}

export async function requireCompanyManagerSession() {
  const { session, error } = await requireAdminSession();

  if (error) return { session: null, error };
  if (!session || !isCompanyManager(session)) {
    return { session: null, error: unauthorized("Esta operación requiere permisos de administrador.") };
  }

  return { session, error: null };
}

export function canAccessEmpresa(session: AdminSession, empresaId: string) {
  if (session.rol === "super_admin") return true;
  return Boolean(session.empresa_id && session.empresa_id === empresaId);
}

async function getProyecto(proyectoId: string): Promise<ProyectoAdmin | null> {
  const { data, error } = await supabaseAdmin
    .from("proyectos")
    .select("id,empresa_id,nombre,slug")
    .eq("id", proyectoId)
    .maybeSingle();

  if (error || !data?.empresa_id) return null;
  return data as ProyectoAdmin;
}

async function sellerHasProjectAccess(session: AdminSession, proyectoId: string) {
  if (!session.user_id || !session.empresa_id) return false;

  const { data, error } = await supabaseAdmin
    .from("boletas")
    .select("id")
    .eq("empresa_id", session.empresa_id)
    .eq("proyecto_id", proyectoId)
    .eq("vendedor_user_id", session.user_id)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data);
}

async function authorizeProject(proyectoId: string, managersOnly: boolean) {
  const { session, error } = managersOnly
    ? await requireCompanyManagerSession()
    : await requireAdminSession();

  if (error || !session) {
    return { session: null, proyecto: null, error };
  }

  const proyecto = await getProyecto(proyectoId);

  if (!proyecto) {
    return {
      session: null,
      proyecto: null,
      error: Response.json({ success: false, message: "Proyecto no encontrado." }, { status: 404 }),
    };
  }

  if (!canAccessEmpresa(session, proyecto.empresa_id)) {
    return { session: null, proyecto: null, error: unauthorized("Acceso denegado.") };
  }

  if (session.rol === "vendedor") {
    const permitido = await sellerHasProjectAccess(session, proyectoId);
    if (!permitido) {
      return { session: null, proyecto: null, error: unauthorized("No tienes números asignados en este proyecto.") };
    }
  }

  return { session, proyecto, error: null };
}

export async function requireProjectAccess(proyectoId: string) {
  return authorizeProject(proyectoId, false);
}

export async function requireProjectManagerAccess(proyectoId: string) {
  return authorizeProject(proyectoId, true);
}
