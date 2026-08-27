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

function aliasesConsecutivo(index: number) {
  return [
    `consecutivo_${index}`,
    `Consecutivo_${index}`,
    `consecutivo ${index}`,
    `Consecutivo ${index}`,
    `contact.consecutivo_${index}`,
    `customData.consecutivo_${index}`,
    `custom_data.consecutivo_${index}`,
    `custom_fields.consecutivo_${index}`,
  ];
}

function extraerConsecutivos(payload: Payload) {
  const numeros: string[] = [];

  for (let index = 1; index <= 10; index += 1) {
    const numero = normalizarNumero(texto(payload, aliasesConsecutivo(index)));
    if (numero) numeros.push(numero);
  }

  return Array.from(new Set(numeros));
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const payload = await leerPayload(req);
    const numeros = extraerConsecutivos(payload);

    if (!numeros.length) {
      return Response.json({
        success: true,
        code: "CONSECUTIVOS_VACIOS",
        message: "Webhook recibido, pero los 10 consecutivos llegaron vacíos.",
        consecutivos_recibidos: 0,
        oportunidades_actualizadas: 0,
        received_keys: Object.keys(payload),
      });
    }

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .update({ oportunidad_creada: true })
      .eq("proyecto_id", proyectoId)
      .in("numero", numeros)
      .in("canal", ["Oficina", "Creacion Manual"])
      .not("reserva_grupo", "is", null)
      .select("numero,oportunidad_creada,reserva_grupo,canal");

    if (error) throw error;

    const actualizadas = (data || []).map((item) => item.numero);
    const noActualizadas = numeros.filter((numero) => !actualizadas.includes(numero));

    return Response.json({
      success: true,
      message: "Webhook de oportunidades procesado correctamente.",
      consecutivos_recibidos: numeros.length,
      oportunidades_actualizadas: actualizadas.length,
      numeros_actualizados: actualizadas,
      numeros_no_actualizados: noActualizadas,
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
