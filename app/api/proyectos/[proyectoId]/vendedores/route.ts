import { getCurrentAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{ proyectoId: string }>;
};

export async function GET(_req: Request, { params }: PageProps) {
  try {
    const session = await getCurrentAdminSession();
    if (!session) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
    }

    const { proyectoId } = await params;
    const { data: proyecto, error: proyectoError } = await supabaseAdmin
      .from("proyectos")
      .select("empresa_id")
      .eq("id", proyectoId)
      .maybeSingle();

    if (proyectoError || !proyecto) {
      return Response.json({ success: false, message: "Proyecto no encontrado." }, { status: 404 });
    }

    if (session.rol !== "super_admin" && session.empresa_id !== proyecto.empresa_id) {
      return Response.json({ success: false, message: "No autorizado para este proyecto." }, { status: 403 });
    }

    const { data: vendedores, error } = await supabaseAdmin
      .from("admin_users")
      .select("email")
      .eq("empresa_id", proyecto.empresa_id)
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .order("email", { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, vendedores: vendedores || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
