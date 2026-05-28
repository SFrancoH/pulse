import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/boletas-disponibles
 *
 * Retorna todas las boletas disponibles.
 *
 * Query params:
 * - empresa_id
 * - proyecto_id
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const empresa_id = searchParams.get("empresa_id");
    const proyecto_id = searchParams.get("proyecto_id");

    if (!empresa_id || !proyecto_id) {
      return Response.json(
        {
          success: false,
          message: "Faltan empresa_id o proyecto_id",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("numero")
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id)
      .eq("estado", "disponible")
      .order("numero", { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      total: data?.length || 0,
      numeros: data || [],
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
