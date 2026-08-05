import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { requireProjectAccess } from "@/lib/require-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Boleta = {
  id: string;
  numero: string;
};

const PAGE_SIZE = 1000;
const CONTAINS_LIMIT = 1000;
const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const ESTADOS_ASIGNADOS_A_VENDEDOR = ["Disponible", "disponible", "No disponible", "no disponible"];

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

function aplicarFiltroDeVendedor<T extends { eq: (column: string, value: string) => T }>(query: T, vendedorUserId?: string | null) {
  return vendedorUserId ? query.eq("vendedor_user_id", vendedorUserId) : query;
}

function estadosVisibles(vendedorUserId?: string | null) {
  return vendedorUserId ? ESTADOS_ASIGNADOS_A_VENDEDOR : ESTADOS_DISPONIBLES;
}

async function cargarTodasLasDisponibles(proyectoId: string, vendedorUserId?: string | null) {
  const boletas: Boleta[] = [];

  for (let desde = 0; desde < 10000; desde += PAGE_SIZE) {
    let query = supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("proyecto_id", proyectoId)
      .order("numero", { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);

    query = aplicarFiltroDeVendedor(query, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
    const { data, error } = await query;

    if (error) throw error;

    const lote = (data || []) as Boleta[];
    boletas.push(...lote);

    if (lote.length < PAGE_SIZE) break;
  }

  return boletas;
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const session = await getCurrentAdminSession();
    const vendedorUserId = session?.rol === "vendedor" ? session.user_id : null;

    if (session?.rol === "vendedor") {
      if (!vendedorUserId) {
        return Response.json({ success: false, message: "No fue posible identificar al vendedor." }, { status: 403 });
      }

      const access = await requireProjectAccess(proyectoId);
      if (access.error) return access.error;
    }

    const url = new URL(req.url);
    const numero = normalizarNumero(url.searchParams.get("numero"));
    const contiene = normalizarContiene(url.searchParams.get("contiene"));
    const aleatorio = url.searchParams.get("aleatorio") === "1";
    const todas = url.searchParams.get("todas") === "1";

    if (todas) {
      const boletas = await cargarTodasLasDisponibles(proyectoId, vendedorUserId);

      return Response.json({
        success: true,
        mode: "all",
        boletas,
      });
    }

    if (aleatorio) {
      let countQuery = supabaseAdmin
        .from("boletas")
        .select("id", { count: "exact", head: true })
        .eq("proyecto_id", proyectoId);

      countQuery = aplicarFiltroDeVendedor(countQuery, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
      const { count, error: countError } = await countQuery;

      if (countError) throw countError;

      const total = count || 0;

      if (total === 0) {
        return Response.json({ success: true, mode: "search", search_type: "random", page: 0, boletas: [] });
      }

      const offset = Math.floor(Math.random() * total);
      let randomQuery = supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .order("numero", { ascending: true })
        .range(offset, offset);

      randomQuery = aplicarFiltroDeVendedor(randomQuery, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
      const { data, error } = await randomQuery;

      if (error) throw error;

      const boleta = data?.[0];
      return Response.json({
        success: true,
        mode: "search",
        search_type: "random",
        numero: boleta?.numero,
        page: boleta?.numero ? Math.floor(Number(boleta.numero) / PAGE_SIZE) : 0,
        boletas: boleta ? [boleta] : [],
      });
    }

    if (contiene) {
      let containsQuery = supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .like("numero", `%${contiene}%`)
        .order("numero", { ascending: true })
        .limit(CONTAINS_LIMIT);

      containsQuery = aplicarFiltroDeVendedor(containsQuery, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
      const { data, error } = await containsQuery;

      if (error) throw error;

      return Response.json({ success: true, mode: "search", search_type: "contains", contiene, page: 0, boletas: data || [], limit: CONTAINS_LIMIT });
    }

    if (numero) {
      let exactQuery = supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("proyecto_id", proyectoId)
        .eq("numero", numero)
        .order("numero", { ascending: true });

      exactQuery = aplicarFiltroDeVendedor(exactQuery, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
      const { data, error } = await exactQuery;

      if (error) throw error;

      return Response.json({ success: true, mode: "search", search_type: "exact", numero, page: Math.floor(Number(numero) / PAGE_SIZE), boletas: data || [] });
    }

    const page = clampPage(url.searchParams.get("page"));
    const desde = page * PAGE_SIZE;
    const hasta = desde + PAGE_SIZE - 1;
    const desdeTexto = String(desde).padStart(4, "0");
    const hastaTexto = String(hasta).padStart(4, "0");

    let pageQuery = supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("proyecto_id", proyectoId)
      .gte("numero", desdeTexto)
      .lte("numero", hastaTexto)
      .order("numero", { ascending: true });

    pageQuery = aplicarFiltroDeVendedor(pageQuery, vendedorUserId).in("estado", estadosVisibles(vendedorUserId));
    const { data, error } = await pageQuery;

    if (error) throw error;

    return Response.json({ success: true, mode: "page", page, desde, hasta, desde_texto: desdeTexto, hasta_texto: hastaTexto, boletas: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
