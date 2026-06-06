import { sincronizarLoteBoletasConSheet } from "@/lib/apps-script-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = {
  vendedor_nombre?: string;
  numeros?: string[];
};

function normalizarNumero(valor: string) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function extraerNumeroEscaneado(valor: string, proyectoId: string) {
  const texto = String(valor || "").trim();

  if (texto.includes("|")) {
    const [proyectoEscaneado, numeroEscaneado] = texto.split("|");

    if (proyectoEscaneado && proyectoEscaneado !== proyectoId) {
      return {
        numero: "",
        error: `El código pertenece a otro proyecto: ${proyectoEscaneado}`,
      };
    }

    return {
      numero: normalizarNumero(numeroEscaneado || ""),
      error: "",
    };
  }

  return {
    numero: normalizarNumero(texto),
    error: "",
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function POST(req: Request, { params }: PageProps) {
  const errores: string[] = [];

  try {
    const { proyectoId } = await params;
    const body = (await req.json()) as Payload;

    const vendedor_nombre = String(body.vendedor_nombre || "").trim();
    const numerosRaw = Array.isArray(body.numeros) ? body.numeros : [];

    if (!vendedor_nombre) {
      return Response.json(
        {
          success: false,
          message: "El nombre del vendedor es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (numerosRaw.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Debes enviar al menos un número.",
        },
        { status: 400 }
      );
    }

    const numeros = Array.from(
      new Set(
        numerosRaw
          .map((item) => {
            const resultado = extraerNumeroEscaneado(item, proyectoId);
            if (resultado.error) errores.push(resultado.error);
            return resultado.numero;
          })
          .filter(Boolean)
      )
    );

    if (numeros.length === 0) {
      return Response.json(
        {
          success: false,
          message: errores[0] || "No se encontraron números válidos.",
          errores,
        },
        { status: 400 }
      );
    }

    const { data: boletas, error: boletasError } = await supabaseAdmin
      .from("boletas")
      .select("id,empresa_id,proyecto_id,numero,estado")
      .eq("proyecto_id", proyectoId)
      .in("numero", numeros);

    if (boletasError) {
      return Response.json(
        {
          success: false,
          message: `Error consultando boletas: ${boletasError.message}`,
        },
        { status: 500 }
      );
    }

    const encontradasLista = boletas || [];
    const idsEncontradas = encontradasLista.map((boleta) => boleta.id);

    if (idsEncontradas.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("boletas")
        .update({
          estado: "No disponible",
          canal: "Vendedor",
          vendedor_nombre,
          updated_at: new Date().toISOString(),
        })
        .in("id", idsEncontradas);

      if (updateError) {
        return Response.json(
          {
            success: false,
            message: `Error actualizando boletas: ${updateError.message}`,
          },
          { status: 500 }
        );
      }
    }

    if (encontradasLista.length > 0) {
      const empresaId = encontradasLista[0].empresa_id;
      const ordenadas = [...encontradasLista].sort((a, b) => a.numero.localeCompare(b.numero));

      const { error: historialError } = await supabaseAdmin
        .from("asignaciones_vendedores")
        .insert({
          empresa_id: empresaId,
          proyecto_id: proyectoId,
          vendedor_nombre,
          numero_desde: ordenadas[0].numero,
          numero_hasta: ordenadas[ordenadas.length - 1].numero,
          cantidad: encontradasLista.length,
          boleta_inicial_id: ordenadas[0].id,
        });

      if (historialError) {
        errores.push(`Historial: ${historialError.message}`);
      }

      const { data: empresa, error: empresaError } = await supabaseAdmin
        .from("empresas")
        .select("apps_script_url")
        .eq("id", empresaId)
        .maybeSingle();

      if (empresaError) {
        errores.push(`Apps Script URL: ${empresaError.message}`);
      }

      if (empresa?.apps_script_url) {
        try {
          await sincronizarLoteBoletasConSheet(
            empresa.apps_script_url,
            encontradasLista.map((boleta) => ({
              proyecto: proyectoId,
              numero: boleta.numero,
              estado: "No disponible",
              canal: "Vendedor",
              vendedor: vendedor_nombre,
              valor_pagado: "",
            }))
          );
        } catch (error) {
          errores.push(`Google Sheets: ${getErrorMessage(error)}`);
        }
      }
    }

    const encontradas = encontradasLista.length;
    const noEncontradas = numeros.filter(
      (numero) => !encontradasLista.some((boleta) => boleta.numero === numero)
    );

    return Response.json({
      success: true,
      message: "Asignación por lote procesada correctamente.",
      vendedor_nombre,
      solicitadas: numeros.length,
      encontradas,
      asignadas: encontradas,
      omitidas: 0,
      no_encontradas: noEncontradas,
      errores,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
