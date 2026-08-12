import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/ghl-reserva
 *
 * Webhook que recibe reservas desde GHL.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-webhook-secret");

    if (secret !== process.env.GHL_WEBHOOK_SECRET) {
      return Response.json({ success: false, message: "No autorizado" }, { status: 401 });
    }

    const data = await req.json();
    const empresa_id = data.empresa_id;
    const proyecto_id = data.proyecto_id;
    const nombre = data.first_name || data.nombre || data.name;
    const telefono = data.phone || data.telefono;

    const numeros = [
      data.numero_1,
      data.numero_2,
      data.numero_3,
      data.numero_4,
      data.numero_5,
      data.numero_6,
      data.numero_7,
      data.numero_8,
      data.numero_9,
      data.numero_10,
    ]
      .filter(Boolean)
      .map((numero) => String(numero).trim().padStart(4, "0"));

    if (!empresa_id || !proyecto_id || !nombre || !telefono || numeros.length === 0) {
      return Response.json({ success: false, message: "Faltan datos obligatorios" }, { status: 400 });
    }

    if (numeros.length > 10) {
      return Response.json({ success: false, message: "Máximo 10 números por reserva" }, { status: 400 });
    }

    const numerosUnicos = Array.from(new Set(numeros));

    const { data: boletasEncontradas, error: errorConsulta } = await supabaseAdmin
      .from("boletas")
      .select("id, numero, estado")
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id)
      .in("numero", numerosUnicos);

    if (errorConsulta) throw errorConsulta;

    const numerosEncontrados = (boletasEncontradas || []).map((b) => b.numero);
    const numerosNoEncontrados = numerosUnicos.filter((numero) => !numerosEncontrados.includes(numero));

    if (numerosNoEncontrados.length > 0) {
      return Response.json(
        {
          success: false,
          message: "Uno o más números no existen",
          numeros_no_encontrados: numerosNoEncontrados,
        },
        { status: 404 }
      );
    }

    const noDisponibles = (boletasEncontradas || [])
      .filter((boleta) => String(boleta.estado).toLowerCase() !== "disponible")
      .map((boleta) => boleta.numero);

    if (noDisponibles.length > 0) {
      return Response.json(
        {
          success: false,
          message: "Uno o más números ya no están disponibles",
          numeros_no_disponibles: noDisponibles,
        },
        { status: 409 }
      );
    }

    const cliente_id = "cli_" + crypto.randomUUID();

    const { error: errorCliente } = await supabaseAdmin.from("clientes").insert({
      id: cliente_id,
      empresa_id,
      nombre,
      telefono,
      ciudad: data.city || data.ciudad || null,
      email: data.email || null,
      ghl_contact_id: data.contact_id || data.ghl_contact_id || null,
    });

    if (errorCliente) throw errorCliente;

    const { data: boletasActualizadas, error: errorUpdate } = await supabaseAdmin
      .from("boletas")
      .update({
        estado: "Debe",
        cliente_id,
        fecha_reserva: new Date().toISOString(),
      })
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id)
      .in("numero", numerosUnicos)
      .in("estado", ["Disponible", "disponible"])
      .select("id, numero");

    if (errorUpdate) throw errorUpdate;

    if (!boletasActualizadas || boletasActualizadas.length !== numerosUnicos.length) {
      return Response.json(
        { success: false, message: "Uno o más números no pudieron reservarse" },
        { status: 409 }
      );
    }

    const movimientos = boletasActualizadas.map((boleta) => ({
      id: "mov_" + crypto.randomUUID(),
      boleta_id: boleta.id,
      estado_anterior: "Disponible",
      estado_nuevo: "Debe",
      descripcion: `Reserva creada desde webhook GHL para ${nombre}`,
      usuario: "GHL Workflow",
    }));

    await supabaseAdmin.from("movimientos_boletas").insert(movimientos);

    return Response.json({
      success: true,
      message: "Reserva registrada correctamente",
      cliente_id,
      numeros: numerosUnicos,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";

    return Response.json({ success: false, message }, { status: 500 });
  }
}
