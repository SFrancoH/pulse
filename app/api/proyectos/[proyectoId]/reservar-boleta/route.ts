import { sincronizarDisponibilidadGoogleSheet } from "@/lib/google-sheets-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type ReservaPayload = {
  empresa_id?: string;
  numero?: string;
  nombre_cliente?: string;
  telefono_cliente?: string;
  email_cliente?: string;
  vendedor_nombre?: string;
  canal?: string;
  valor_pagado?: number | string;
};

function normalizarNumero(value: unknown) {
  const limpio = String(value || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function limpiarTexto(value: unknown) {
  const texto = String(value || "").trim();
  return texto || null;
}

function normalizarValor(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;

  const numero = Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : undefined;
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const body = (await req.json()) as ReservaPayload;

    const empresaId = String(body.empresa_id || "").trim();
    const numero = normalizarNumero(body.numero);

    if (!empresaId || !numero) {
      return Response.json(
        {
          success: false,
          message: "empresa_id y numero son obligatorios.",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      estado: "Debe",
      updated_at: new Date().toISOString(),
    };

    const nombreCliente = limpiarTexto(body.nombre_cliente);
    const telefonoCliente = limpiarTexto(body.telefono_cliente);
    const emailCliente = limpiarTexto(body.email_cliente);
    const vendedorNombre = limpiarTexto(body.vendedor_nombre);
    const canal = limpiarTexto(body.canal);
    const valorPagado = normalizarValor(body.valor_pagado);

    if (nombreCliente) updateData.nombre_cliente = nombreCliente;
    if (telefonoCliente) updateData.telefono_cliente = telefonoCliente;
    if (emailCliente) updateData.email_cliente = emailCliente;
    if (vendedorNombre) updateData.vendedor_nombre = vendedorNombre;
    if (canal) updateData.canal = canal;
    if (typeof valorPagado === "number") updateData.valor_pagado = valorPagado;

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .update(updateData)
      .eq("empresa_id", empresaId)
      .eq("proyecto_id", proyectoId)
      .eq("numero", numero)
      .eq("estado", "Disponible")
      .select("id,empresa_id,proyecto_id,numero,estado,nombre_cliente,telefono_cliente,email_cliente,vendedor_nombre,canal,valor_pagado,updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: existente, error: consultaError } = await supabaseAdmin
        .from("boletas")
        .select("numero,estado")
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", proyectoId)
        .eq("numero", numero)
        .maybeSingle();

      if (consultaError) throw consultaError;

      if (!existente) {
        return Response.json(
          {
            success: false,
            code: "BOLETA_NO_ENCONTRADA",
            message: `La boleta ${numero} no existe en este proyecto.`,
          },
          { status: 404 }
        );
      }

      return Response.json(
        {
          success: false,
          code: "BOLETA_NO_DISPONIBLE",
          numero,
          estado_actual: existente.estado,
          message: `La boleta ${numero} ya no está disponible.`,
        },
        { status: 409 }
      );
    }

    await sincronizarDisponibilidadGoogleSheet(data.numero, data.estado);

    return Response.json({
      success: true,
      message: `La boleta ${numero} fue reservada correctamente.`,
      boleta: data,
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
