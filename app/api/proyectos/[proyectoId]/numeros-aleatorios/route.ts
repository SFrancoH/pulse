import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Boleta = {
  numero: string;
};

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const CANTIDAD_DEFAULT = 50;
const CANTIDAD_MAXIMA = 100;

function normalizarCantidad(value: string | null) {
  const cantidad = Number.parseInt(value || "", 10);

  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return CANTIDAD_DEFAULT;
  }

  return Math.min(cantidad, CANTIDAD_MAXIMA);
}

function mezclar<T>(items: T[]) {
  const copia = [...items];

  for (let index = copia.length - 1; index > 0; index--) {
    const aleatorio = Math.floor(Math.random() * (index + 1));
    [copia[index], copia[aleatorio]] = [copia[aleatorio], copia[index]];
  }

  return copia;
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
      .in("estado", ESTADOS_DISPONIBLES)
      .order("numero", { ascending: true })
      .limit(10000);

    if (error) throw error;

    const disponibles = (data || []) as Boleta[];
    const numeros = mezclar(disponibles)
      .slice(0, cantidadSolicitada)
      .map((boleta) => boleta.numero);

    const numerosTexto = numeros.join(" - ");

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

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
