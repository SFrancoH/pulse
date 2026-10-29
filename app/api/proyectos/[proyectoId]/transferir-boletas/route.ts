import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ proyectoId: string }> };
const ESTADOS = ["Disponible", "No disponible", "Debe", "Abonado", "Pagado"] as const;
type Estado = (typeof ESTADOS)[number];
type Modo = "todas" | "cantidad" | "especifica";

type Transferencia = {
  vendedor_origen_user_id?: string;
  vendedor_destino_user_id?: string | null;
  modo?: Modo;
  cantidad?: number;
  numero?: string;
  estados?: Estado[];
};

function errorJson(message: string, status: number) {
  return Response.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: Request, { params }: Props) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto) return auth.error;

    const empresaId = auth.proyecto.empresa_id;
    const { data: vendedores, error } = await supabaseAdmin
      .from("admin_users")
      .select("id,nombre,email,estado")
      .eq("empresa_id", empresaId)
      .eq("role", "vendedor")
      .order("nombre", { ascending: true });
    if (error) throw error;

    const origen = new URL(req.url).searchParams.get("origen");
    if (!origen) {
      return Response.json({ success: true, vendedores: vendedores || [] }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!isUuid(origen) || !(vendedores || []).some((item) => item.id === origen)) {
      return errorJson("El vendedor de origen no pertenece a esta empresa.", 400);
    }

    const consultas = await Promise.all(ESTADOS.map(async (estado) => {
      const { count, error: countError } = await supabaseAdmin
        .from("boletas")
        .select("id", { head: true, count: "exact" })
        .eq("empresa_id", empresaId)
        .eq("proyecto_id", proyectoId)
        .eq("vendedor_user_id", origen)
        .eq("estado", estado);
      if (countError) throw countError;
      return [estado, count || 0] as const;
    }));

    const porEstado = Object.fromEntries(consultas) as Record<Estado, number>;
    return Response.json({
      success: true,
      vendedores: vendedores || [],
      total: Object.values(porEstado).reduce((a, b) => a + b, 0),
      por_estado: porEstado,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorJson("No se pudo consultar la asignación de boletas.", 500);
  }
}

export async function POST(req: Request, { params }: Props) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto || !auth.session) return auth.error;

    const body = (await req.json()) as Transferencia;
    const origen = String(body?.vendedor_origen_user_id || "").trim();
    const destino = body?.vendedor_destino_user_id == null
      ? null : String(body.vendedor_destino_user_id).trim();
    const modo = body?.modo;
    const estados = body?.estados;
    const cantidad = body?.cantidad;
    const numeroRaw = String(body?.numero || "").trim();
    const numero = /^\d{1,4}$/.test(numeroRaw) ? numeroRaw.padStart(4, "0") : "";

    if (!isUuid(origen) || (destino !== null && !isUuid(destino)) || destino === origen) {
      return errorJson("Selecciona un vendedor de origen y un destino distinto, o Oficina.", 400);
    }
    if (modo !== "todas" && modo !== "cantidad" && modo !== "especifica") {
      return errorJson("Selecciona una modalidad válida.", 400);
    }
    if (!Array.isArray(estados) || estados.length === 0 ||
        estados.some((estado) => !ESTADOS.includes(estado)) ||
        new Set(estados).size !== estados.length) {
      return errorJson("Selecciona uno o más estados válidos.", 400);
    }
    if (modo === "cantidad" && (!Number.isInteger(cantidad) || cantidad! < 1 || cantidad! > 10000)) {
      return errorJson("Indica una cantidad entre 1 y 10000.", 400);
    }
    if (modo === "especifica" && !numero) {
      return errorJson("Indica una boleta válida de hasta cuatro dígitos.", 400);
    }
    if (!auth.session.user_id || !isUuid(auth.session.user_id)) {
      return errorJson("No se pudo verificar al administrador responsable.", 403);
    }

    const { data, error } = await supabaseAdmin.rpc("transferir_boletas_pulse", {
      p_empresa_id: auth.proyecto.empresa_id,
      p_proyecto_id: proyectoId,
      p_origen: origen,
      p_destino: destino,
      p_modo: modo,
      p_cantidad: modo === "cantidad" ? cantidad : null,
      p_numero: modo === "especifica" ? numero : null,
      p_estados: estados,
      p_actor: auth.session.user_id,
    });

    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        return errorJson("La transferencia masiva aún no está habilitada en la base de datos. Instala la migración TB-01.", 503);
      }
      if (["22023", "P0002", "42501", "40001"].includes(error.code || "")) {
        return errorJson(error.message, error.code === "42501" ? 403 : 409);
      }
      return errorJson("No se pudo completar la transferencia. No se aplicaron cambios parciales.", 500);
    }

    return Response.json({
      ...data,
      message: "Transferencia completada. Se conservó el estado de cada boleta.",
      // La sincronización heredada de Sheet carece de empresa/proyecto.
      // No se invoca para impedir que altere otro proyecto con el mismo número.
      sincronizacion_externa: "No ejecutada: requiere integración por empresa y proyecto.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorJson("No se pudo procesar la transferencia.", 500);
  }
}
