import { supabaseAdmin } from "@/lib/supabase-admin";
import { extraerActualizacionBoleta, validarBearerBoleta } from "@/lib/ghl-boleta-update-payload";

// Contrato fijo para TODAS las empresas y proyectos.
// Autoriza primero; empresa_id + proyecto_id + numero identifican una sola boleta.
export async function POST(req: Request) {
  if (!validarBearerBoleta(req, process.env.PULSE_CALLBACK_SECRET || "")) {
    return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({
      success: false, message: "JSON inválido.", campos_invalidos: ["body"],
    }, { status: 400 });
  }

  const campos = extraerActualizacionBoleta(body);
  if (campos.campos_invalidos.length) {
    return Response.json({
      success: false, message: "Datos inválidos.", campos_invalidos: campos.campos_invalidos,
    }, { status: 400 });
  }

  const {
    empresa_id, proyecto_id, numero, estado, valor_pagado,
    nombre_cliente, telefono_cliente, email_cliente, canal, metodo_pago, comprobante_url,
  } = campos;
  // El parser rechaza valores vacíos, estados desconocidos y montos inválidos.
  const cambios: Record<string, unknown> = {
    estado,
    valor_pagado,
    updated_at: new Date().toISOString(),
  };
  if (nombre_cliente) cambios.nombre_cliente = nombre_cliente;
  if (telefono_cliente) cambios.telefono_cliente = telefono_cliente;
  if (email_cliente) cambios.email_cliente = email_cliente;
  if (canal) cambios.canal = canal;
  if (metodo_pago) cambios.metodo_pago = metodo_pago;
  if (comprobante_url) cambios.comprobante_url = comprobante_url;
  if (estado === "Pagado") cambios.pagado_en = new Date().toISOString();
  if (estado === "No disponible") cambios.reservado_en = new Date().toISOString();

  try {
    if (estado === "Disponible") {
      // Liberar una boleta implica retirar la reserva y sus datos de ocupación.
      // Una boleta abonada, pagada o asignada a vendedor NO puede liberarse así.
      const { data: existente, error: consultaError } = await supabaseAdmin
        .from("boletas")
        .select("id,estado,valor_pagado,vendedor_nombre,vendedor_user_id")
        .eq("empresa_id", empresa_id)
        .eq("proyecto_id", proyecto_id)
        .eq("numero", numero)
        .maybeSingle();

      if (consultaError) throw consultaError;
      if (!existente) {
        return Response.json({
          success: false, message: "Boleta no encontrada en esa empresa y proyecto.",
        }, { status: 404 });
      }
      if (["Abonado", "Pagado"].includes(existente.estado) ||
          Number(existente.valor_pagado || 0) > 0) {
        return Response.json({
          success: false, code: "BOLETA_CON_ABONOS",
          message: "No se puede liberar una boleta abonada o pagada.",
        }, { status: 409 });
      }
      if (existente.vendedor_user_id ||
          (existente.vendedor_nombre && existente.vendedor_nombre !== "Oficina")) {
        return Response.json({
          success: false, code: "BOLETA_ASIGNADA_VENDEDOR",
          message: "No se puede liberar una boleta asignada a un vendedor.",
        }, { status: 409 });
      }

      // No modificar el comprobante_url: identifica a la boleta, no al comprador.
      // No enviar la disponibilidad al Google Sheet heredado: solo identifica
      // numero, sin empresa/proyecto, y podría liberar otro sorteo.
      const { data: liberada, error: liberarError } = await supabaseAdmin
        .from("boletas")
        .update({
          estado: "Disponible",
          nombre_cliente: null,
          telefono_cliente: null,
          email_cliente: null,
          ciudad_cliente: null,
          valor_pagado: 0,
          pagado_en: null,
          reserva_grupo: null,
          canal: "Oficina",
          vendedor_nombre: "Oficina",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id)
        .eq("empresa_id", empresa_id)
        .eq("proyecto_id", proyecto_id)
        .eq("numero", numero)
        .in("estado", ["Disponible", "No disponible", "Debe"])
        .or("valor_pagado.is.null,valor_pagado.eq.0")
        .is("vendedor_user_id", null)
        .or('vendedor_nombre.is.null,vendedor_nombre.eq."Oficina"')
        .select("id,empresa_id,proyecto_id,numero,estado,valor_pagado")
        .maybeSingle();
      if (liberarError) throw liberarError;
      if (!liberada) {
        return Response.json({
          success: false, code: "BOLETA_CAMBIO_DURANTE_LIBERACION",
          message: "La boleta cambió de estado; no se liberó.",
        }, { status: 409 });
      }
      return Response.json({
        success: true, message: "Boleta liberada correctamente.",
        boleta: liberada,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .update(cambios)
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id)
      .eq("numero", numero)
      .select("id,empresa_id,proyecto_id,numero,estado,valor_pagado")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({
        success: false, message: "Boleta no encontrada en esa empresa y proyecto.",
      }, { status: 404 });
    }

    // Esta ruta no sincroniza Google Sheets: el sincronizador heredado solo
    // recibe "numero" y podría afectar a otro sorteo con el mismo consecutivo.
    // La actualización financiera queda confirmada en Supabase.
    return Response.json({
      success: true, message: "Boleta actualizada correctamente.",
      modo_valor: "total_acumulado", boleta: data,
    });
  } catch {
    // No filtrar detalles internos ni cuerpos del webhook.
    return Response.json({
      success: false, message: "No fue posible actualizar la boleta.",
    }, { status: 500 });
  }
}
