import { supabaseAdmin } from "@/lib/supabase-admin";

const TOTAL_NUMEROS = 10000;
const TAMANO_LOTE = 1000;

type CrearBoletasPayload = {
  empresa_id?: string;
  proyecto_id?: string;
  nombre_proyecto?: string;
};

function limpiarTexto(valor: unknown) {
  if (typeof valor !== "string") return "";
  return valor.trim();
}

function crearNumeros(empresa_id: string, proyecto_id: string) {
  return Array.from({ length: TOTAL_NUMEROS }, (_, index) => ({
    empresa_id,
    proyecto_id,
    numero: String(index).padStart(4, "0"),
    estado: "disponible",
  }));
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CrearBoletasPayload;

    const empresa_id = limpiarTexto(payload.empresa_id);
    const proyecto_id = limpiarTexto(payload.proyecto_id || payload.nombre_proyecto);

    if (!empresa_id || !proyecto_id) {
      return Response.json(
        {
          success: false,
          message: "Faltan empresa_id y proyecto_id. También se acepta nombre_proyecto como proyecto_id.",
        },
        { status: 400 }
      );
    }

    const numeros = crearNumeros(empresa_id, proyecto_id);
    let creadas = 0;

    for (let inicio = 0; inicio < numeros.length; inicio += TAMANO_LOTE) {
      const lote = numeros.slice(inicio, inicio + TAMANO_LOTE);

      const { error } = await supabaseAdmin
        .from("boletas")
        .upsert(lote, {
          onConflict: "empresa_id,proyecto_id,numero",
          ignoreDuplicates: true,
        });

      if (error) {
        throw error;
      }

      creadas += lote.length;
    }

    const { count, error: countError } = await supabaseAdmin
      .from("boletas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id);

    if (countError) {
      throw countError;
    }

    return Response.json({
      success: true,
      message: "Boletas creadas o verificadas correctamente.",
      empresa_id,
      proyecto_id,
      rango: "0000-9999",
      total_esperado: TOTAL_NUMEROS,
      total_en_base_de_datos: count || 0,
      procesadas_en_solicitud: creadas,
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
