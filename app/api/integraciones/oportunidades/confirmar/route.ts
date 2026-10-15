import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Payload = Record<string, unknown>;

function autorizado(req: Request) {
  const secret = process.env.PULSE_CALLBACK_SECRET || "";
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return secret.length >= 32 &&
    secret.length === token.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(token));
}

function objeto(valor: unknown): Payload {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Payload
    : {};
}

// La acción Webhook puede envolver sus CUSTOM DATA bajo customData.
// Se conserva compatibilidad con el JSON plano y el nombre anterior consecutivo_1.
function campo(payload: Payload, clave: string): string {
  const fuentes = [objeto(payload.customData), objeto(payload.custom_data), payload];
  for (const fuente of fuentes) {
    const valor = fuente[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  }
  return "";
}

export async function POST(req: Request) {
  if (!autorizado(req)) {
    return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  try {
    const body = objeto(await req.json());
    const empresa = campo(body, "empresa_id");
    const proyecto = campo(body, "proyecto_id");
    const grupo = campo(body, "reserva_grupo");
    const numero = campo(body, "numero") || campo(body, "consecutivo_1");
    const estado = campo(body, "estado").toLowerCase();

    const camposInvalidos = [
      ...(!empresa ? ["empresa_id"] : []),
      ...(!proyecto ? ["proyecto_id"] : []),
      ...(!grupo ? ["reserva_grupo"] : []),
      ...(!/^\d{4}$/.test(numero) ? ["numero"] : []),
      ...(!["creada", "fallida"].includes(estado) ? ["estado"] : []),
    ];

    if (camposInvalidos.length) {
      // Solo se informan nombres de campos, nunca datos personales ni el token.
      return Response.json(
        { success: false, message: "Datos inválidos.", campos_invalidos: camposInvalidos },
        { status: 400 }
      );
    }

    const { data: boleta, error } = await supabaseAdmin
      .from("boletas")
      .select("id,oportunidad_creada")
      .eq("empresa_id", empresa)
      .eq("proyecto_id", proyecto)
      .eq("reserva_grupo", grupo)
      .eq("numero", numero)
      .in("canal", ["Oficina", "Creacion Manual"])
      .maybeSingle();

    if (error) throw error;
    if (!boleta) {
      return Response.json({ success: false, message: "Reserva no encontrada." }, { status: 404 });
    }

    if (estado === "creada") {
      const { error: e1 } = await supabaseAdmin
        .from("boletas")
        .update({ oportunidad_creada: true, oportunidad_error_at: null })
        .eq("id", boleta.id)
        .eq("empresa_id", empresa)
        .eq("proyecto_id", proyecto)
        .eq("reserva_grupo", grupo);
      if (e1) throw e1;

      const { error: e2 } = await supabaseAdmin
        .from("pulse_alertas_oportunidades")
        .update({ estado: "confirmada_automatica", resuelto_at: new Date().toISOString() })
        .eq("empresa_id", empresa)
        .eq("proyecto_id", proyecto)
        .eq("reserva_grupo", grupo)
        .eq("boleta_id", boleta.id)
        .in("estado", ["esperando", "pendiente"]);
      if (e2) throw e2;
    } else if (!boleta.oportunidad_creada) {
      const { error: e1 } = await supabaseAdmin
        .from("pulse_alertas_oportunidades")
        .update({ estado: "pendiente", motivo: "La oportunidad no se creó correctamente." })
        .eq("empresa_id", empresa)
        .eq("proyecto_id", proyecto)
        .eq("reserva_grupo", grupo)
        .eq("boleta_id", boleta.id)
        .eq("estado", "esperando");
      if (e1) throw e1;
    }

    return Response.json({ success: true, numero });
  } catch {
    return Response.json(
      { success: false, message: "Error al registrar la confirmación." },
      { status: 500 }
    );
  }
}
