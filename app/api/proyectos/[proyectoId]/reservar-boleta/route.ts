import { sincronizarDisponibilidadGoogleSheet } from "@/lib/google-sheets-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = Record<string, unknown>;

function texto(payload: Payload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizarNumero(value: unknown) {
  const limpio = String(value || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function limpiarTexto(value: unknown) {
  const textoLimpio = String(value || "").trim();
  return textoLimpio || null;
}

function normalizarValor(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;

  const numero = Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : undefined;
}

function flattenPayload(value: unknown, prefix = "", output: Payload = {}) {
  if (!value || typeof value !== "object") return output;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (item && typeof item === "object" && !Array.isArray(item)) {
      flattenPayload(item, nextKey, output);
    } else {
      output[nextKey] = item;
      output[key] = item;
    }
  }

  return output;
}

async function leerPayload(req: Request): Promise<Payload> {
  const contentType = req.headers.get("content-type") || "";
  const raw = await req.text();

  if (!raw) return {};

  try {
    const json = JSON.parse(raw) as Payload;
    return flattenPayload(json);
  } catch {
    // Continúa con otros formatos.
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const payload: Payload = {};

    for (const [key, value] of params.entries()) {
      payload[key] = value;
    }

    return flattenPayload(payload);
  }

  const payload: Payload = {};

  raw.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (!key) return;
    payload[decodeURIComponent(key)] = decodeURIComponent(value || "");
  });

  return flattenPayload(payload);
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const payload = await leerPayload(req);

    const empresaId = texto(payload, [
      "empresa_id",
      "empresaId",
      "customData.empresa_id",
      "custom_data.empresa_id",
      "custom_fields.empresa_id",
    ]);

    const numero = normalizarNumero(
      texto(payload, [
        "numero",
        "Numero",
        "número",
        "boleta",
        "Boleta",
        "consecutivo",
        "consecutivo_1",
        "Consecutivo_1",
        "contact.consecutivo_1",
        "customData.numero",
        "custom_data.numero",
        "custom_fields.numero",
      ])
    );

    if (!empresaId || !numero) {
      return Response.json(
        {
          success: false,
          message: "empresa_id y numero son obligatorios.",
          received_keys: Object.keys(payload),
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      estado: "Debe",
      updated_at: new Date().toISOString(),
    };

    const nombreCliente = limpiarTexto(
      texto(payload, [
        "nombre_cliente",
        "nombre",
        "name",
        "contact_name",
        "full_name",
        "first_name",
        "customData.nombre_cliente",
        "custom_data.nombre_cliente",
      ])
    );
    const telefonoCliente = limpiarTexto(
      texto(payload, [
        "telefono_cliente",
        "telefono",
        "phone",
        "contact_phone",
        "customData.telefono_cliente",
        "custom_data.telefono_cliente",
      ])
    );
    const emailCliente = limpiarTexto(
      texto(payload, [
        "email_cliente",
        "email",
        "contact_email",
        "customData.email_cliente",
        "custom_data.email_cliente",
      ])
    );
    const vendedorNombre = limpiarTexto(
      texto(payload, [
        "vendedor_nombre",
        "vendedor",
        "seller_name",
        "customData.vendedor_nombre",
        "custom_data.vendedor_nombre",
      ])
    );
    const canal = limpiarTexto(
      texto(payload, [
        "canal",
        "channel",
        "origen",
        "customData.canal",
        "custom_data.canal",
      ])
    );
    const valorPagado = normalizarValor(
      texto(payload, [
        "valor_pagado",
        "valor",
        "amount",
        "valor_a_pagar",
        "customData.valor_pagado",
        "custom_data.valor_pagado",
      ])
    );

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
