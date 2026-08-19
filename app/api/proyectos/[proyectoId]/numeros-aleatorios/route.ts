import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Boleta = {
  numero: string;
};

const ESTADO_DISPONIBLE = "Disponible";
const CANTIDAD_DEFAULT = 50;
const CANTIDAD_MAXIMA = 150;
const TOTAL_GRUPOS_TEXTO = 3;

function normalizarCantidad(value: string | null) {
  const cantidad = Number.parseInt(value || "", 10);

  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return CANTIDAD_DEFAULT;
  }

  return Math.min(cantidad, CANTIDAD_MAXIMA);
}

function normalizarNumero(numero: unknown) {
  return String(numero ?? "").trim().padStart(4, "0");
}

function mezclar<T>(items: T[]) {
  const copia = [...items];

  for (let index = copia.length - 1; index > 0; index--) {
    const aleatorio = Math.floor(Math.random() * (index + 1));
    [copia[index], copia[aleatorio]] = [copia[aleatorio], copia[index]];
  }

  return copia;
}

function dividirEnTresGrupos(numeros: string[]) {
  const grupos: string[][] = Array.from({ length: TOTAL_GRUPOS_TEXTO }, () => []);

  numeros.forEach((numero, index) => {
    grupos[index % TOTAL_GRUPOS_TEXTO].push(numero);
  });

  return grupos;
}

function crearTextoPorGrupos(numeros: string[]) {
  return dividirEnTresGrupos(numeros)
    .map((grupo) => grupo.join(" - "))
    .join(" | ");
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const url = new URL(req.url);
    const cantidadSolicitada = normalizarCantidad(url.searchParams.get("cantidad"));
    const formato = url.searchParams.get("formato") || "json";

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("numero")
      .eq("proyecto_id", proyectoId)
      .eq("estado", ESTADO_DISPONIBLE)
      .eq("vendedor_nombre", "Oficina")
      .is("vendedor_user_id", null)
      .order("numero", { ascending: true })
      .limit(10000);

    if (error) throw error;

    const disponibles = (data || []) as Boleta[];
    const numeros = mezclar(disponibles)
      .slice(0, cantidadSolicitada)
      .map((boleta) => normalizarNumero(boleta.numero));

    const grupos = dividirEnTresGrupos(numeros);
    const numerosTexto = crearTextoPorGrupos(numeros);

    if (formato === "texto" || formato === "text") {
      return new Response(numerosTexto, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json(
      {
        success: true,
        proyecto_id: proyectoId,
        cantidad_solicitada: cantidadSolicitada,
        cantidad_encontrada: numeros.length,
        numeros,
        grupos,
        numeros_texto: numerosTexto,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";

    return Response.json({ success: false, message }, { status: 500 });
  }
}
