import { getActiveProjectSalesLink } from "@/lib/project-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];

function normalizarNumero(value: string | null) {
  const limpio = String(value || "").replace(/\D/g, "");
  return limpio ? limpio.padStart(4, "0").slice(-4) : "";
}

export async function GET(req: Request, { params }: Props) {
  try {
    const { token } = await params;
    const proyecto = await getActiveProjectSalesLink(token);

    if (!proyecto) {
      return Response.json({ success: false, message: "Enlace no disponible." }, { status: 404 });
    }

    const numero = normalizarNumero(new URL(req.url).searchParams.get("numero"));
    const query = supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("empresa_id", proyecto.empresa_id)
      .eq("proyecto_id", proyecto.id)
      .eq("vendedor_nombre", "Oficina")
      .is("vendedor_user_id", null)
      .in("estado", ESTADOS_DISPONIBLES)
      .order("numero", { ascending: true });

    if (numero) {
      const { data, error } = await query.eq("numero", numero);
      if (error) throw error;
      return Response.json({
        success: true,
        boletas: data || [],
        search_status: data?.length ? "allowed" : "not_found",
      });
    }

    const { data, error } = await query.range(0, 9999);
    if (error) throw error;
    return Response.json({ success: true, boletas: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
