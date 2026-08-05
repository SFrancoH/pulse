import { getActiveSellerSalesLink } from "@/lib/seller-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_VENTA = ["Disponible", "disponible", "No disponible", "no disponible"];

function normalizarNumero(value: string | null) {
  const limpio = String(value || "").replace(/\D/g, "");
  return limpio ? limpio.padStart(4, "0").slice(-4) : "";
}

export async function GET(req: Request, { params }: Props) {
  try {
    const { token } = await params;
    const link = await getActiveSellerSalesLink(token);

    if (!link) return Response.json({ success: false, message: "Enlace no disponible." }, { status: 404 });

    const numero = normalizarNumero(new URL(req.url).searchParams.get("numero"));
    const query = supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("empresa_id", link.empresa_id)
      .eq("proyecto_id", link.proyecto_id)
      .eq("vendedor_user_id", link.vendedor_user_id)
      .in("estado", ESTADOS_VENTA)
      .order("numero", { ascending: true });

    if (numero) {
      const { data, error } = await query.eq("numero", numero);
      if (error) throw error;
      if (data?.length) return Response.json({ success: true, boletas: data, search_status: "allowed" });

      const { data: externa, error: externaError } = await supabaseAdmin
        .from("boletas")
        .select("id,estado,vendedor_user_id")
        .eq("empresa_id", link.empresa_id)
        .eq("proyecto_id", link.proyecto_id)
        .eq("numero", numero)
        .maybeSingle();

      if (externaError) throw externaError;
      const mostrarOficina = Boolean(externa && ESTADOS_VENTA.includes(String(externa.estado)) && externa.vendedor_user_id !== link.vendedor_user_id);
      return Response.json({ success: true, boletas: [], search_status: mostrarOficina ? "office" : "not_found" });
    }

    const { data, error } = await query.range(0, 9999);
    if (error) throw error;
    return Response.json({ success: true, boletas: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
