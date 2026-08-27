import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type PendingRow = {
  numero: string;
  reserva_grupo: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  email_cliente: string | null;
  canal: string | null;
  updated_at: string;
  oportunidad_error_at: string | null;
};

type PendingGroup = {
  reserva_grupo: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  email_cliente: string | null;
  canal: string | null;
  numeros: string[];
  detectado_at: string;
  error_explicito: boolean;
};

const PENDING_GRACE_MS = 60 * 60 * 1000;

function fechaMs(value: string | null | undefined) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export async function GET(_req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const { proyecto, error } = await requireProjectManagerAccess(proyectoId);

    if (error || !proyecto) {
      return error || Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const { data, error: queryError } = await supabaseAdmin
      .from("boletas")
      .select(
        "numero,reserva_grupo,nombre_cliente,telefono_cliente,email_cliente,canal,updated_at,oportunidad_error_at"
      )
      .eq("empresa_id", proyecto.empresa_id)
      .eq("proyecto_id", proyectoId)
      .eq("oportunidad_creada", false)
      .in("canal", ["Oficina", "Creacion Manual"])
      .not("reserva_grupo", "is", null)
      .order("updated_at", { ascending: true })
      .limit(500);

    if (queryError) throw queryError;

    const ahora = Date.now();
    const candidatas = ((data || []) as PendingRow[]).filter((item) => {
      if (item.oportunidad_error_at) return true;
      const confirmadaAt = fechaMs(item.updated_at);
      return confirmadaAt > 0 && ahora - confirmadaAt >= PENDING_GRACE_MS;
    });

    const mapa = new Map<string, PendingGroup>();

    for (const item of candidatas) {
      const existente = mapa.get(item.reserva_grupo);
      const detectadoAt = item.oportunidad_error_at || item.updated_at;

      if (!existente) {
        mapa.set(item.reserva_grupo, {
          reserva_grupo: item.reserva_grupo,
          nombre_cliente: item.nombre_cliente,
          telefono_cliente: item.telefono_cliente,
          email_cliente: item.email_cliente,
          canal: item.canal,
          numeros: [item.numero],
          detectado_at: detectadoAt,
          error_explicito: Boolean(item.oportunidad_error_at),
        });
        continue;
      }

      if (!existente.numeros.includes(item.numero)) existente.numeros.push(item.numero);
      existente.error_explicito = existente.error_explicito || Boolean(item.oportunidad_error_at);

      if (fechaMs(detectadoAt) < fechaMs(existente.detectado_at)) {
        existente.detectado_at = detectadoAt;
      }
    }

    const grupos = Array.from(mapa.values())
      .map((grupo) => ({ ...grupo, numeros: grupo.numeros.sort() }))
      .sort((a, b) => fechaMs(a.detectado_at) - fechaMs(b.detectado_at));

    return Response.json({
      success: true,
      cantidad: grupos.length,
      grupos,
      grace_minutes: PENDING_GRACE_MS / 60_000,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
