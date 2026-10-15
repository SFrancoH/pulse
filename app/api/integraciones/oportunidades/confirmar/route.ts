import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extraerConfirmacionGhl } from "@/lib/ghl-callback-payload";

function autorizado(req: Request) {
  const secret = process.env.PULSE_CALLBACK_SECRET || "";
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return secret.length >= 32 &&
    secret.length === token.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(token));
}

export async function POST(req: Request) {
  if (!autorizado(req)) {
    return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  try {
    const { empresa, proyecto, grupo, numero, estado, camposInvalidos } = extraerConfirmacionGhl(await req.json());

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
