import { sincronizarDisponibilidadGoogleSheet } from "@/lib/google-sheets-sync";
import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = {
  numero?: string;
  destino?: "oficina" | "vendedor";
  vendedor_user_id?: string;
};

type Vendedor = {
  id: string;
  nombre: string | null;
  email: string;
};

function normalizarNumero(valor: unknown) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

async function buscarBoleta(proyectoId: string, empresaId: string, numero: string) {
  const { data, error } = await supabaseAdmin
    .from("boletas")
    .select("id,numero,estado,canal,vendedor_nombre,vendedor_user_id,nombre_cliente,telefono_cliente")
    .eq("empresa_id", empresaId)
    .eq("proyecto_id", proyectoId)
    .eq("numero", numero)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function buscarVendedor(empresaId: string, vendedorUserId: string): Promise<Vendedor | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,nombre,email")
    .eq("id", vendedorUserId)
    .eq("empresa_id", empresaId)
    .eq("role", "vendedor")
    .eq("estado", "activo")
    .maybeSingle();

  if (error) throw error;
  return data as Vendedor | null;
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto) return auth.error;

    const url = new URL(req.url);
    const numero = normalizarNumero(url.searchParams.get("numero"));

    if (!numero) {
      return Response.json(
        { success: false, message: "Debes indicar un número válido." },
        { status: 400 }
      );
    }

    const boleta = await buscarBoleta(proyectoId, auth.proyecto.empresa_id, numero);

    if (!boleta) {
      return Response.json(
        { success: false, message: `El número ${numero} no existe en este proyecto.` },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      boleta: {
        ...boleta,
        puede_reasignar: String(boleta.estado || "").toLowerCase() === "disponible",
      },
    });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto || !auth.session) return auth.error;

    const body = (await req.json()) as Payload;
    const numero = normalizarNumero(body.numero);
    const destino = body.destino;

    if (!numero) {
      return Response.json(
        { success: false, message: "Debes indicar un número válido." },
        { status: 400 }
      );
    }

    if (destino !== "oficina" && destino !== "vendedor") {
      return Response.json(
        { success: false, message: "Debes seleccionar Oficina o un vendedor." },
        { status: 400 }
      );
    }

    const empresaId = auth.proyecto.empresa_id;
    const boleta = await buscarBoleta(proyectoId, empresaId, numero);

    if (!boleta) {
      return Response.json(
        { success: false, message: `El número ${numero} no existe en este proyecto.` },
        { status: 404 }
      );
    }

    if (String(boleta.estado || "").toLowerCase() !== "disponible") {
      return Response.json(
        {
          success: false,
          message: `El número ${numero} está en estado ${boleta.estado || "sin estado"}. Solo se pueden reasignar números Disponibles.`,
        },
        { status: 409 }
      );
    }

    let vendedor: Vendedor | null = null;
    let nuevaAsignacion: {
      canal: string;
      vendedor_nombre: string;
      vendedor_user_id: string | null;
    };

    if (destino === "oficina") {
      nuevaAsignacion = {
        canal: "Oficina",
        vendedor_nombre: "Oficina",
        vendedor_user_id: null,
      };
    } else {
      const vendedorUserId = String(body.vendedor_user_id || "").trim();

      if (!vendedorUserId) {
        return Response.json(
          { success: false, message: "Debes seleccionar un vendedor." },
          { status: 400 }
        );
      }

      vendedor = await buscarVendedor(empresaId, vendedorUserId);

      if (!vendedor) {
        return Response.json(
          {
            success: false,
            message: "El vendedor no existe, no está activo o no pertenece a la empresa del proyecto.",
          },
          { status: 400 }
        );
      }

      nuevaAsignacion = {
        canal: "Vendedores",
        vendedor_nombre: vendedor.nombre?.trim() || vendedor.email,
        vendedor_user_id: vendedor.id,
      };
    }

    const anterior = {
      canal: boleta.canal || null,
      vendedor_nombre: boleta.vendedor_nombre || null,
      vendedor_user_id: boleta.vendedor_user_id || null,
    };

    const sinCambios =
      String(boleta.canal || "") === nuevaAsignacion.canal &&
      String(boleta.vendedor_nombre || "") === nuevaAsignacion.vendedor_nombre &&
      (boleta.vendedor_user_id || null) === nuevaAsignacion.vendedor_user_id;

    let boletaActualizada = boleta;

    if (!sinCambios) {
      const { data, error } = await supabaseAdmin
        .from("boletas")
        .update({
          ...nuevaAsignacion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", boleta.id)
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", proyectoId)
        .in("estado", ["Disponible", "disponible"])
        .select("id,numero,estado,canal,vendedor_nombre,vendedor_user_id,nombre_cliente,telefono_cliente")
        .maybeSingle();

      if (error) {
        return Response.json(
          { success: false, message: `No se pudo actualizar el número: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data) {
        return Response.json(
          {
            success: false,
            message: "El número cambió de estado mientras se procesaba la solicitud. Vuelve a consultarlo antes de reasignarlo.",
          },
          { status: 409 }
        );
      }

      boletaActualizada = data;

      if (destino === "vendedor" && vendedor) {
        const { error: historialError } = await supabaseAdmin
          .from("asignaciones_vendedores")
          .insert({
            empresa_id: empresaId,
            proyecto_id: proyectoId,
            vendedor_user_id: vendedor.id,
            asignado_por_user_id: auth.session.user_id || null,
            vendedor_nombre: nuevaAsignacion.vendedor_nombre,
            numero_desde: numero,
            numero_hasta: numero,
            cantidad: 1,
            boleta_inicial_id: boleta.id,
          });

        if (historialError) {
          console.error("[Reasignar número] No se pudo guardar historial.", {
            proyectoId,
            numero,
            message: historialError.message,
          });
        }
      }
    }

    const sync = await sincronizarDisponibilidadGoogleSheet(
      numero,
      destino === "oficina" ? "Disponible" : "No disponible"
    );

    return Response.json({
      success: true,
      message: sinCambios
        ? `El número ${numero} ya estaba asignado a ${destino === "oficina" ? "Oficina" : nuevaAsignacion.vendedor_nombre}.`
        : `El número ${numero} fue ${destino === "oficina" ? "liberado a Oficina" : `reasignado a ${nuevaAsignacion.vendedor_nombre}`} correctamente.`,
      updated: !sinCambios,
      anterior,
      boleta: boletaActualizada,
      sheet_sync: {
        success: sync.success,
        skipped: sync.skipped || false,
        warning: sync.success
          ? null
          : sync.message || sync.error || "La reasignación se guardó, pero no se pudo sincronizar Google Sheets.",
      },
    });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
