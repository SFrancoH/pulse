import { requireCompanyManagerSession, requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AsignarPayload = {
  boleta_id?: string;
  vendedor_nombre?: string;
  numero_hasta?: string;
};

function limpiarTexto(valor: unknown) {
  if (typeof valor !== "string") return "";
  return valor.trim();
}

function normalizarNumero(valor: string) {
  const soloNumeros = valor.replace(/\D/g, "");
  if (!soloNumeros) return "";
  return soloNumeros.padStart(4, "0").slice(-4);
}

async function leerPayload(req: Request): Promise<AsignarPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await req.json()) as AsignarPayload;
  }

  const formData = await req.formData();

  return {
    boleta_id: String(formData.get("boleta_id") || ""),
    vendedor_nombre: String(formData.get("vendedor_nombre") || ""),
    numero_hasta: String(formData.get("numero_hasta") || ""),
  };
}

export async function POST(req: Request) {
  try {
    const manager = await requireCompanyManagerSession();
    if (manager.error) return manager.error;

    const body = await leerPayload(req);

    const boleta_id = limpiarTexto(body.boleta_id);
    const vendedor_nombre = limpiarTexto(body.vendedor_nombre);
    const numero_hasta_raw = limpiarTexto(body.numero_hasta);

    if (!boleta_id || !vendedor_nombre) {
      return Response.json(
        {
          success: false,
          message: "boleta_id y vendedor_nombre son obligatorios.",
        },
        { status: 400 }
      );
    }

    const { data: boletaInicial, error: boletaError } = await supabaseAdmin
      .from("boletas")
      .select("id,empresa_id,proyecto_id,numero,estado")
      .eq("id", boleta_id)
      .single();

    if (boletaError || !boletaInicial) {
      return Response.json(
        {
          success: false,
          message: "Boleta inicial no encontrada.",
        },
        { status: 404 }
      );
    }

    const auth = await requireProjectManagerAccess(boletaInicial.proyecto_id);
    if (auth.error || !auth.session) return auth.error;

    const { data: vendedores, error: vendedorError } = await supabaseAdmin
      .from("admin_users")
      .select("id,nombre,email")
      .eq("empresa_id", boletaInicial.empresa_id)
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .eq("nombre", vendedor_nombre)
      .limit(2);

    if (vendedorError) throw vendedorError;
    if ((vendedores || []).length !== 1) {
      return Response.json(
        { success: false, message: "Selecciona un vendedor activo y con nombre único en la empresa." },
        { status: 400 }
      );
    }

    const vendedor = vendedores![0];
    const vendedorNombre = vendedor.nombre?.trim() || vendedor.email;

    const numeroDesde = normalizarNumero(boletaInicial.numero || "");
    const numeroHasta = numero_hasta_raw ? normalizarNumero(numero_hasta_raw) : numeroDesde;

    if (!numeroDesde || !numeroHasta) {
      return Response.json(
        {
          success: false,
          message: "Número inicial o número hasta inválido.",
        },
        { status: 400 }
      );
    }

    const desde = Number(numeroDesde);
    const hasta = Number(numeroHasta);

    if (hasta < desde) {
      return Response.json(
        {
          success: false,
          message: "El número final no puede ser menor al número inicial.",
        },
        { status: 400 }
      );
    }

    const { data: candidatas, error: candidatasError } = await supabaseAdmin
      .from("boletas")
      .select("id,numero,estado")
      .eq("empresa_id", boletaInicial.empresa_id)
      .eq("proyecto_id", boletaInicial.proyecto_id)
      .gte("numero", numeroDesde)
      .lte("numero", numeroHasta)
      .order("numero", { ascending: true });

    if (candidatasError) {
      throw candidatasError;
    }

    const disponibles = (candidatas || []).filter(
      (item) => String(item.estado || "").toLowerCase() === "disponible"
    );
    const idsDisponibles = disponibles.map((item) => item.id);

    if (idsDisponibles.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("boletas")
        .update({
          estado: "No disponible",
          canal: "Vendedores",
          vendedor_nombre: vendedorNombre,
          vendedor_user_id: vendedor.id,
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", boletaInicial.empresa_id)
        .eq("proyecto_id", boletaInicial.proyecto_id)
        .in("id", idsDisponibles);

      if (updateError) {
        throw updateError;
      }
    }

    const { error: historialError } = await supabaseAdmin
      .from("asignaciones_vendedores")
      .insert({
        empresa_id: boletaInicial.empresa_id,
        proyecto_id: boletaInicial.proyecto_id,
        vendedor_user_id: vendedor.id,
        asignado_por_user_id: auth.session.user_id || null,
        vendedor_nombre: vendedorNombre,
        numero_desde: numeroDesde,
        numero_hasta: numeroHasta,
        cantidad: idsDisponibles.length,
        boleta_inicial_id: boletaInicial.id,
      });

    if (historialError) {
      throw historialError;
    }

    const url = new URL(req.url);
    url.pathname = `/asignar/${boleta_id}`;
    url.search = `?ok=1&asignadas=${idsDisponibles.length}&omitidas=${(candidatas?.length || 0) - idsDisponibles.length}`;

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return Response.redirect(url, 303);
    }

    return Response.json({
      success: true,
      message: "Asignación realizada correctamente.",
      vendedor_user_id: vendedor.id,
      vendedor_nombre: vendedorNombre,
      numero_desde: numeroDesde,
      numero_hasta: numeroHasta,
      solicitadas: candidatas?.length || 0,
      asignadas: idsDisponibles.length,
      omitidas: (candidatas?.length || 0) - idsDisponibles.length,
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
