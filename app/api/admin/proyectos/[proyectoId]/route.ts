import { CONFIRMACION_ELIMINAR, solicitudMismoOrigen } from "@/lib/project-deletion";
import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ proyectoId: string }> };

export async function DELETE(req: Request, { params }: Props) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);

    if (auth.error || !auth.proyecto) return auth.error;

    if (!solicitudMismoOrigen(req)) {
      return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (body?.confirmacion !== CONFIRMACION_ELIMINAR) {
      return Response.json(
        { success: false, message: "Debes escribir ELIMINAR exactamente para confirmar." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("eliminar_proyecto_pulse", {
      p_empresa_id: auth.proyecto.empresa_id,
      p_proyecto_id: proyectoId,
      p_confirmacion: body.confirmacion,
      p_aceptado: true,
    });

    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        return Response.json(
          { success: false, message: "La eliminación todavía no está habilitada en la base de datos." },
          { status: 503 },
        );
      }

      if (error.code === "P0002") {
        return Response.json({ success: false, message: "El proyecto ya no existe." }, { status: 404 });
      }

      if (/^[0-9A-Z]{5}$/.test(error.code || "")) {
        return Response.json(
          { success: false, message: "No se pudo eliminar el proyecto. No se confirmó ningún borrado parcial." },
          { status: 409 },
        );
      }

      return Response.json(
        { success: false, message: "No se pudo confirmar la eliminación. Actualiza el listado e inténtalo nuevamente." },
        { status: 500 },
      );
    }

    if (
      !data ||
      data.proyectos !== 1 ||
      data.empresa_id !== auth.proyecto.empresa_id ||
      data.proyecto_id !== proyectoId
    ) {
      return Response.json(
        { success: false, message: "La base de datos no confirmó la eliminación esperada." },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      message: "Proyecto y datos asociados eliminados.",
      eliminados: data,
    });
  } catch {
    return Response.json(
      { success: false, message: "No se pudo confirmar la eliminación. Actualiza el listado e inténtalo nuevamente." },
      { status: 500 },
    );
  }
}
