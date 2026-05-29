import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug,estado")
      .eq("estado", "activa")
      .order("nombre", { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      empresas: data || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
