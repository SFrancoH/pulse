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
