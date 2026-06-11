import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

const PAGE_SIZE = 1000;
const CONTAINS_LIMIT = 1000;
const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];

function clampPage(value: string | null) {
  const page = Number(value || 0);
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(9, Math.floor(page)));
}

function normalizarNumero(value: string | null) {
  const limpio = String(value || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function normalizarContiene(value: string | null) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const url = new URL(req.url);
    const numero = normalizarNumero(url.searchParams.get("numero"));
    const contiene = normalizarContiene(url.searchParams.get("contiene"));
    const aleatorio = url.searchParams.get("aleatorio") === "1";

    if (aleatorio) {
      const { count, error: countError } = await supabaseAdmin
        .from("boletas")
        .select("id", { count: "exact", head: true })
        .eq("proyecto_id", proyectoId)
        .in("estado", ESTADOS_DISPONIBLES);

      if (countError) throw countError;

      const total = count || 0;

      if (total === 0) {
        return Response.json({
          success: true,
          mode: "search",
          search_type: "random",
          page: 0,
          boletas: [],
          has_previous: false,
          has_next: false,
        });
      }

      const offset = Math.floor(Math.random() * total);

      const { data, error } = await supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .in("estado", ESTADOS_DISPONIBLES)
        .order("numero", { ascending: true })
        .range(offset, offset);

      if (error) throw error;

      const boleta = data?.[0];

      return Response.json({
        success: true,
        mode: "search",
        search_type: "random",
        numero: boleta?.numero,
        page: boleta?.numero ? Math.floor(Number(boleta.numero) / PAGE_SIZE) : 0,
        boletas: boleta ? [boleta] : [],
        has_previous: false,
        has_next: false,
      });
    }

    if (contiene) {
      const { data, error } = await supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .in("estado", ESTADOS_DISPONIBLES)
        .like("numero", `%${contiene}%`)
        .order("numero", { ascending: true })
        .limit(CONTAINS_LIMIT);

      if (error) throw error;

      return Response.json({
        success: true,
        mode: "search",
        search_type: "contains",
        contiene,
        page: 0,
        boletas: data || [],
        limit: CONTAINS_LIMIT,
        has_previous: false,
        has_next: false,
      });
    }

    if (numero) {
      const { data, error } = await supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .in("estado", ESTADOS_DISPONIBLES)
        .eq("numero", numero)
        .order("numero", { ascending: true });

      if (error) throw error;

      return Response.json({
        success: true,
        mode: "search",
        search_type: "exact",
        numero,
        page: Math.floor(Number(numero) / PAGE_SIZE),
        desde: Number(numero),
        hasta: Number(numero),
        desde_texto: numero,
        hasta_texto: numero,
        boletas: data || [],
        has_previous: true,
        has_next: true,
      });
    }

    const page = clampPage(url.searchParams.get("page"));
    const desde = page * PAGE_SIZE;
    const hasta = desde + PAGE_SIZE - 1;
    const desdeTexto = String(desde).padStart(4, "0");
    const hastaTexto = String(hasta).padStart(4, "0");

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("proyecto_id", proyectoId)
      .in("estado", ESTADOS_DISPONIBLES)
      .gte("numero", desdeTexto)
      .lte("numero", hastaTexto)
      .order("numero", { ascending: true });

    if (error) throw error;

    return Response.json({
      success: true,
      mode: "page",
      page,
      desde,
      hasta,
      desde_texto: desdeTexto,
      hasta_texto: hastaTexto,
      boletas: data || [],
      has_previous: page > 0,
      has_next: page < 9,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
