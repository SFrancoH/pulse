import { getActiveProjectSalesLink } from "@/lib/project-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const PAGE_SIZE = 1000;

function normalizarNumero(value: string | null) {
  const limpio = String(value || "").replace(/\D/g, "");
  return limpio ? limpio.padStart(4, "0").slice(-4) : "";
}

function normalizarContiene(value: string | null) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function normalizarPagina(value: string | null) {
  const page = Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(page) && page >= 0 ? page : 0;
}

export async function GET(req: Request, { params }: Props) {
  try {
    const { token } = await params;
    const proyecto = await getActiveProjectSalesLink(token);

    if (!proyecto) {
      return Response.json({ success: false, message: "Enlace no disponible." }, { status: 404 });
    }

    const searchParams = new URL(req.url).searchParams;
    const numero = normalizarNumero(searchParams.get("numero"));
    const contiene = normalizarContiene(searchParams.get("contiene"));
    const pagina = normalizarPagina(searchParams.get("page"));

    const baseQuery = () =>
      supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("empresa_id", proyecto.empresa_id)
        .eq("proyecto_id", proyecto.id)
        .eq("vendedor_nombre", "Oficina")
        .is("vendedor_user_id", null)
        .in("estado", ESTADOS_DISPONIBLES)
        .order("numero", { ascending: true });

    if (numero) {
      const { data, error } = await baseQuery().eq("numero", numero);
      if (error) throw error;

      return Response.json({
        success: true,
        mode: "search",
        boletas: data || [],
        search_status: data?.length ? "allowed" : "not_found",
      });
    }

    if (contiene) {
      const { data, error } = await baseQuery().ilike("numero", `%${contiene}%`).range(0, PAGE_SIZE - 1);
      if (error) throw error;

      return Response.json({
        success: true,
        mode: "contains",
        boletas: data || [],
        search_status: data?.length ? "allowed" : "not_found",
      });
    }

    const inicio = pagina * PAGE_SIZE;
    const fin = inicio + PAGE_SIZE - 1;

    const { data, error, count } = await supabaseAdmin
      .from("boletas")
      .select("id,numero", { count: "exact" })
      .eq("empresa_id", proyecto.empresa_id)
      .eq("proyecto_id", proyecto.id)
      .eq("vendedor_nombre", "Oficina")
      .is("vendedor_user_id", null)
      .in("estado", ESTADOS_DISPONIBLES)
      .order("numero", { ascending: true })
      .range(inicio, fin);

    if (error) throw error;

    const total = count || 0;

    return Response.json({
      success: true,
      mode: "page",
      page: pagina,
      page_size: PAGE_SIZE,
      total,
      has_more: fin + 1 < total,
      boletas: data || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
