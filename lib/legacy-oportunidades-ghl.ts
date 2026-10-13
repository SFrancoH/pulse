import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = Record<string, unknown>;

type PendingOpportunity = {
  numero: string;
  reserva_grupo: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  updated_at: string;
};

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

function normalizarTelefono(value: unknown) {
  const limpio = String(value || "").replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.length === 10) return `57${limpio}`;
  return limpio;
}

function normalizarNombre(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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

  const params = new URLSearchParams(raw);
  const payload: Payload = {};
  for (const [key, value] of params.entries()) payload[key] = value;
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

async function registrarFallo(proyectoId: string, payload: Payload) {
  const phone = normalizarTelefono(
    texto(payload, ["phone", "customData.phone", "contact.phone", "custom_data.phone"])
  );
  const firstName = normalizarNombre(
    texto(payload, ["first_name", "customData.first_name", "contact.first_name", "firstName"])
  );

  if (!phone && !firstName) {
    return {
      registered: false,
      code: "CONTACTO_NO_IDENTIFICADO",
      pendingNumbers: [] as string[],
    };
  }

  const { data, error } = await supabaseAdmin
    .from("boletas")
    .select("numero,reserva_grupo,nombre_cliente,telefono_cliente,updated_at")
    .eq("proyecto_id", proyectoId)
    .eq("oportunidad_creada", false)
    .in("canal", ["Oficina", "Creacion Manual"])
    .not("reserva_grupo", "is", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const pendientes = (data || []) as PendingOpportunity[];
  const coincidenciasTelefono = phone
    ? pendientes.filter((item) => normalizarTelefono(item.telefono_cliente) === phone)
    : [];

  let candidata: PendingOpportunity | undefined = coincidenciasTelefono[0];

  if (!candidata && firstName) {
    candidata = pendientes.find((item) => normalizarNombre(item.nombre_cliente) === firstName);
  }

  if (!candidata?.reserva_grupo) {
    return {
      registered: false,
      code: "RESERVA_PENDIENTE_NO_ENCONTRADA",
      pendingNumbers: [] as string[],
    };
  }

  const errorAt = new Date().toISOString();
  const { data: marcadas, error: markError } = await supabaseAdmin
    .from("boletas")
    .update({ oportunidad_error_at: errorAt })
    .eq("proyecto_id", proyectoId)
    .eq("reserva_grupo", candidata.reserva_grupo)
    .eq("oportunidad_creada", false)
    .in("canal", ["Oficina", "Creacion Manual"])
    .select("numero");

  if (markError) throw markError;

  return {
    registered: true,
    code: "OPORTUNIDAD_ERROR_REGISTRADO",
    pendingNumbers: (marcadas || []).map((item) => item.numero),
  };
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const payload = await leerPayload(req);
    const numeros = extraerConsecutivos(payload);

    if (!numeros.length) {
      const fallo = await registrarFallo(proyectoId, payload);

      return Response.json({
        success: true,
        code: fallo.code,
        message: fallo.registered
          ? "Webhook recibido sin consecutivos. El fallo de oportunidades fue registrado."
          : "Webhook recibido sin consecutivos, pero no se encontró una reserva pendiente para registrar el fallo.",
        consecutivos_recibidos: 0,
        oportunidades_actualizadas: 0,
        fallo_registrado: fallo.registered,
        numeros_pendientes: fallo.pendingNumbers,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .update({ oportunidad_creada: true, oportunidad_error_at: null })
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
