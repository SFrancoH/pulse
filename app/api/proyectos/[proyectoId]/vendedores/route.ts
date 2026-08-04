import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{ proyectoId: string }>;
};

export async function GET(_req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto) return auth.error;

    const { data: vendedores, error } = await supabaseAdmin
      .from("admin_users")
      .select("id,nombre,telefono,email")
      .eq("empresa_id", auth.proyecto.empresa_id)
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .order("nombre", { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, vendedores: vendedores || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
