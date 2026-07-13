import { supabaseAdmin } from "@/lib/supabase-admin";

function parametro(url: URL, nombre: string) {
  return String(url.searchParams.get(nombre) || "").trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const empresaId = parametro(url, "id");
    const proyectoId = parametro(url, "proyecto");
    const boletaId = parametro(url, "numero");

    if (!empresaId || !proyectoId || !boletaId) {
      return Response.json({ success: false, message: "La URL de la boleta está incompleta." }, { status: 400 });
    }

    const { data: boleta, error: boletaError } = await supabaseAdmin
      .from("boletas")
      .select("id,numero,estado,nombre_cliente,valor_pagado,vendedor_nombre,vendedor_user_id,empresa_id,proyecto_id")
      .eq("id", boletaId)
      .eq("empresa_id", empresaId)
      .eq("proyecto_id", proyectoId)
      .maybeSingle();

    if (boletaError) throw boletaError;
    if (!boleta) {
      return Response.json({ success: false, message: "Boleta no encontrada." }, { status: 404 });
    }

    const { data: proyecto, error: proyectoError } = await supabaseAdmin
      .from("proyectos")
      .select("id,nombre,flyer_url,precio_boleta,estado")
      .eq("id", proyectoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (proyectoError) throw proyectoError;
    if (!proyecto) {
      return Response.json({ success: false, message: "Proyecto no encontrado." }, { status: 404 });
    }

    let vendedor: { nombre: string | null; telefono: string | null } | null = null;
    if (boleta.vendedor_user_id) {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .select("nombre,telefono")
        .eq("id", boleta.vendedor_user_id)
        .eq("empresa_id", empresaId)
        .eq("role", "vendedor")
        .maybeSingle();
      if (error) throw error;
      vendedor = data;
    }

    const valorPagado = Number(boleta.valor_pagado || 0);
    const precioBoleta = Number(proyecto.precio_boleta || 0);

    return Response.json({
      success: true,
      proyecto: {
        nombre: proyecto.nombre,
        flyer_url: proyecto.flyer_url,
        precio_boleta: precioBoleta,
      },
      boleta: {
        numero: boleta.numero,
        estado: boleta.estado,
        disponible: boleta.estado === "Disponible",
        nombre_cliente: boleta.nombre_cliente,
        valor_pagado: valorPagado,
        saldo_pendiente: Math.max(precioBoleta - valorPagado, 0),
      },
      vendedor: vendedor
        ? { nombre: vendedor.nombre || boleta.vendedor_nombre || "Vendedor", telefono: vendedor.telefono }
        : boleta.vendedor_nombre
          ? { nombre: boleta.vendedor_nombre, telefono: null }
          : null,
    });
  } catch (error: unknown) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Error interno." }, { status: 500 });
  }
}
