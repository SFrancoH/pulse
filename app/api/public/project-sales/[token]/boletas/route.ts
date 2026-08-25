import { getActiveProjectSalesLink } from "@/lib/project-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { liberarReservasTemporalesExpiradas } from "@/lib/temporary-reservations";

type Props = { params: Promise<{ token: string }> };

type Boleta = {
  id: string;
  numero: string;
};

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const PAGE_SIZE = 1000;
const NUMEROS_POR_PREFIJO = 100;
const PREFIJOS = Array.from({ length: 10 }, (_, index) => String(index));

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

function hashEstable(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ordenarAleatorioEstable(boletas: Boleta[], seed: string) {
  return [...boletas].sort((a, b) => {
    const hashA = hashEstable(`${seed}:${a.numero}`);
    const hashB = hashEstable(`${seed}:${b.numero}`);
    if (hashA !== hashB) return hashA - hashB;
    return a.numero.localeCompare(b.numero);
  });
}

function construirOrdenBalanceado(grupos: Boleta[][]) {
  const orden: Boleta[] = [];
  const maximo = Math.max(0, ...grupos.map((grupo) => grupo.length));
  for (let offset = 0; offset < maximo; offset += NUMEROS_POR_PREFIJO) {
    for (const grupo of grupos) orden.push(...grupo.slice(offset, offset + NUMEROS_POR_PREFIJO));
  }
  return orden;
}

export async function GET(req: Request, { params }: Props) {
  try {
    const { token } = await params;
    const proyecto = await getActiveProjectSalesLink(token);

    if (!proyecto) {
      return Response.json({ success: false, message: "Enlace no disponible." }, { status: 404 });
    }

    await liberarReservasTemporalesExpiradas({
      empresaId: proyecto.empresa_id,
      proyectoId: proyecto.id,
      vendedorUserId: null,
    });

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
      return Response.json({ success: true, mode: "search", boletas: data || [], search_status: data?.length ? "allowed" : "not_found" });
    }

    if (contiene) {
      const { data, error } = await baseQuery().ilike("numero", `%${contiene}%`).range(0, PAGE_SIZE - 1);
      if (error) throw error;
      return Response.json({ success: true, mode: "contains", boletas: data || [], search_status: data?.length ? "allowed" : "not_found" });
    }

    const grupos = await Promise.all(
      PREFIJOS.map(async (prefijo) => {
        const { data, error } = await supabaseAdmin
          .from("boletas")
          .select("id,numero")
          .eq("empresa_id", proyecto.empresa_id)
          .eq("proyecto_id", proyecto.id)
          .eq("vendedor_nombre", "Oficina")
          .is("vendedor_user_id", null)
          .in("estado", ESTADOS_DISPONIBLES)
          .like("numero", `${prefijo}%`)
          .order("numero", { ascending: true })
          .range(0, 999);
        if (error) throw error;
        return ordenarAleatorioEstable((data || []) as Boleta[], proyecto.id);
      })
    );

    const ordenBalanceado = construirOrdenBalanceado(grupos);
    const total = ordenBalanceado.length;
    const inicio = pagina * PAGE_SIZE;
    const fin = inicio + PAGE_SIZE;

    return Response.json({
      success: true,
      mode: "page",
      page: pagina,
      page_size: PAGE_SIZE,
      total,
      has_more: fin < total,
      boletas: ordenBalanceado.slice(inicio, fin),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
