import { requireProjectManagerAccess } from "@/lib/require-admin";
import {
  cancelarReservaTemporal,
  confirmarReservaTemporal,
  retenerBoletasTemporales,
} from "@/lib/temporary-reservations";

type Props = { params: Promise<{ proyectoId: string }> };

type Payload = {
  action?: "hold" | "confirm" | "cancel";
  numeros?: string[];
  hold_token?: string;
  first_name?: string;
  phone?: string;
  city?: string;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const { proyectoId } = await params;
    const { proyecto, error } = await requireProjectManagerAccess(proyectoId);

    if (error || !proyecto) {
      return error || Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const body = (await req.json()) as Payload;
    const scope = { empresaId: proyecto.empresa_id, proyectoId, vendedorUserId: null };

    if (body.action === "hold") {
      const result = await retenerBoletasTemporales(scope, body.numeros || [], {
        firstName: String(body.first_name || "").trim(),
        phone: String(body.phone || "").trim(),
        city: String(body.city || "").trim(),
      });
      return Response.json({ success: true, ...result });
    }

    if (body.action === "cancel") {
      const liberadas = await cancelarReservaTemporal(scope, body.numeros || [], String(body.hold_token || ""));
      return Response.json({ success: true, liberadas });
    }

    if (body.action === "confirm") {
      const result = await confirmarReservaTemporal(
        scope,
        body.numeros || [],
        String(body.hold_token || ""),
        "Creacion Manual",
        true
      );
      return Response.json({ success: !result.expired, code: result.expired ? "RESERVA_EXPIRADA" : undefined, ...result });
    }

    return Response.json({ success: false, message: "Acción no válida." }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
