import { getActiveSellerSalesLink } from "@/lib/seller-sales-links";
import {
  cancelarReservaTemporal,
  confirmarReservaTemporal,
  retenerBoletasTemporales,
} from "@/lib/temporary-reservations";

type Props = { params: Promise<{ token: string }> };

type Payload = {
  action?: "hold" | "confirm" | "cancel";
  numeros?: string[];
  hold_token?: string;
  first_name?: string;
  phone?: string;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const { token } = await params;
    const link = await getActiveSellerSalesLink(token);

    if (!link) {
      return Response.json({ success: false, message: "Enlace no disponible." }, { status: 404 });
    }

    const body = (await req.json()) as Payload;
    const scope = {
      empresaId: link.empresa_id,
      proyectoId: link.proyecto_id,
      vendedorUserId: link.vendedor_user_id,
    };

    if (body.action === "hold") {
      const result = await retenerBoletasTemporales(scope, body.numeros || [], {
        firstName: String(body.first_name || "").trim(),
        phone: String(body.phone || "").trim(),
      });
      return Response.json({ success: true, ...result });
    }

    if (body.action === "cancel") {
      const liberadas = await cancelarReservaTemporal(scope, body.numeros || [], String(body.hold_token || ""));
      return Response.json({ success: true, liberadas });
    }

    if (body.action === "confirm") {
      const result = await confirmarReservaTemporal(scope, body.numeros || [], String(body.hold_token || ""), "Vendedores");
      return Response.json({ success: !result.expired, code: result.expired ? "RESERVA_EXPIRADA" : undefined, ...result });
    }

    return Response.json({ success: false, message: "Acción no válida." }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
