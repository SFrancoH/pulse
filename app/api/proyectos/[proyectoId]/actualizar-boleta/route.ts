import { sincronizarBoletaConSheet } from "@/lib/apps-script-sync";
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

function numeroBoleta(value: string) {
  const limpio = value.replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function normalizarEstado(value: string) {
  const estado = value.trim().toLowerCase();

  const permitidos = new Set([
    "disponible",
    "reservado",
    "reservada",
    "abonado",
    "abonada",
    "pagado",
    "pagada",
    "cancelado",
    "cancelada",
    "asignada",
    "debe",
  ]);

  if (!estado) return "reservado";
  if (!permitidos.has(estado)) return "reservado";

  if (estado === "reservada") return "reservado";
  if (estado === "abonada") return "abonado";
  if (estado === "pagada") return "pagado";
  if (estado === "cancelada") return "cancelado";
  if (estado === "debe") return "reservado";

  return estado;
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

    const numero = numeroBoleta(
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

    if (!numero) {
      return Response.json(
        {
          success: false,
          message: "Falta el número de boleta.",
          received_keys: Object.keys(payload),
          received_payload: payload,
        },
        { status: 400 }
      );
    }

    const estado = normalizarEstado(texto(payload, ["estado", "status", "etapa"]));
    const nombre_cliente = texto(payload, ["nombre_cliente", "nombre", "name", "contact_name", "full_name", "first_name"]);
    const telefono_cliente = texto(payload, ["telefono_cliente", "telefono", "phone", "contact_phone"]);
    const email_cliente = texto(payload, ["email_cliente", "email", "contact_email"]);
    const metodo_pago = texto(payload, ["metodo_pago", "metodo", "payment_method"]);
    const comprobante_url = texto(payload, ["comprobante_url", "comprobante", "receipt_url"]);
    const valorPagadoRaw = texto(payload, ["valor_pagado", "valor", "amount", "valor_a_pagar"]);
    const valor_pagado = valorPagadoRaw ? Number(valorPagadoRaw.replace(/[^0-9.]/g, "")) || 0 : undefined;

    const updateData: Record<string, unknown> = {
      estado,
      updated_at: new Date().toISOString(),
    };

    if (nombre_cliente) updateData.nombre_cliente = nombre_cliente;
    if (telefono_cliente) updateData.telefono_cliente = telefono_cliente;
    if (email_cliente) updateData.email_cliente = email_cliente;
    if (metodo_pago) updateData.metodo_pago = metodo_pago;
    if (comprobante_url) updateData.comprobante_url = comprobante_url;
    if (typeof valor_pagado === "number") updateData.valor_pagado = valor_pagado;

    if (estado === "reservado") updateData.reservado_en = new Date().toISOString();
    if (estado === "pagado") updateData.pagado_en = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .update(updateData)
      .eq("proyecto_id", proyectoId)
      .eq("numero", numero)
      .select("id,numero,estado,proyecto_id,nombre_cliente,telefono_cliente,email_cliente,valor_pagado,empresa_id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return Response.json(
        {
          success: false,
          message: "No se encontró la boleta para este proyecto.",
          proyecto_id: proyectoId,
          numero,
        },
        { status: 404 }
      );
    }

    const { data: empresa } = await supabaseAdmin
      .from("empresas")
      .select("apps_script_url")
      .eq("id", data.empresa_id)
      .maybeSingle();

    if (empresa?.apps_script_url) {
      await sincronizarBoletaConSheet(empresa.apps_script_url, {
        proyecto: proyectoId,
        numero: data.numero,
        estado: data.estado,
        nombre: data.nombre_cliente,
        telefono: data.telefono_cliente,
        email: data.email_cliente,
        valor_pagado: data.valor_pagado,
      });
    }

    return Response.json({
      success: true,
      message: "Boleta actualizada correctamente.",
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
