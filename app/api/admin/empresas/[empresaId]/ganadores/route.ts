import { canAccessEmpresa, requireCompanyManagerSession } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ empresaId: string }> };

async function autorizar(empresaId: string) {
  const auth = await requireCompanyManagerSession();
  if (auth.error || !auth.session) return auth;
  if (!canAccessEmpresa(auth.session, empresaId)) {
    return { session: null, error: Response.json({ success: false, message: "Acceso denegado." }, { status: 403 }) };
  }
  return auth;
}

function entrada(body: Record<string, unknown>) {
  const numero = String(body.numero ?? "").trim();
  const fecha = String(body.fecha ?? "").trim();
  const poster_url = String(body.poster_url ?? "").trim();
  const video_url = String(body.video_url ?? "").trim();
  if (!/^\d{4}$/.test(numero)) throw Error("El número ganador debe tener cuatro dígitos.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || new Date(fecha + "T00:00:00Z").toISOString().slice(0, 10) !== fecha) {
    throw Error("La fecha del sorteo no es válida.");
  }
  for (const [campo, valor] of [["flyer", poster_url], ["video", video_url]]) {
    let url: URL;
    try { url = new URL(valor); } catch { throw Error(`El enlace de ${campo} no es válido.`); }
    if (url.protocol !== "https:" || url.username || url.password || valor.length > 2000) {
      throw Error(`El enlace de ${campo} debe usar HTTPS.`);
    }
  }
  return { numero, fecha, poster_url, video_url };
}
function origenPermitido(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

export async function GET(_req: Request, { params }: Props) {
  const { empresaId } = await params;
  const auth = await autorizar(empresaId);
  if (auth.error) return auth.error;
  const { data, error } = await supabaseAdmin.from("pulse_ganadores_publicos")
    .select("id,numero,fecha,poster_url,video_url,activo")
    .eq("empresa_id", empresaId).order("fecha", { ascending: false });
  if (error) return Response.json({ success: false, message: "Instala primero la actualización de ganadores." }, { status: 503 });
  return Response.json({ success: true, ganadores: data || [] });
}

export async function POST(req: Request, { params }: Props) {
  const { empresaId } = await params;
  const auth = await autorizar(empresaId);
  if (auth.error) return auth.error;
  if (!origenPermitido(req)) return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
  try {
    const input = entrada(await req.json());
    const { error } = await supabaseAdmin.from("pulse_ganadores_publicos")
      .insert({ empresa_id: empresaId, ...input });
    if (error) throw error;
    return Response.json({ success: true, message: "Ganador agregado." }, { status: 201 });
  } catch (err) {
    return Response.json({ success: false, message: err instanceof Error ? err.message : "No se pudo guardar el ganador." }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: Props) {
  const { empresaId } = await params;
  const auth = await autorizar(empresaId);
  if (auth.error) return auth.error;
  if (!origenPermitido(req)) return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return Response.json({ success: false, message: "Ganador inválido." }, { status: 400 });
    const input = entrada(body);
    const { data, error } = await supabaseAdmin.from("pulse_ganadores_publicos")
      .update(input).eq("empresa_id", empresaId).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ success: false, message: "Ganador no encontrado." }, { status: 404 });
    return Response.json({ success: true, message: "Ganador actualizado." });
  } catch (err) {
    return Response.json({ success: false, message: err instanceof Error ? err.message : "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Props) {
  const { empresaId } = await params;
  const auth = await autorizar(empresaId);
  if (auth.error) return auth.error;
  if (!origenPermitido(req)) return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return Response.json({ success: false, message: "Ganador inválido." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("pulse_ganadores_publicos")
    .delete().eq("empresa_id", empresaId).eq("id", id).select("id").maybeSingle();
  if (error) return Response.json({ success: false, message: "No fue posible eliminar el ganador." }, { status: 500 });
  if (!data) return Response.json({ success: false, message: "Ganador no encontrado." }, { status: 404 });
  return Response.json({ success: true, message: "Ganador eliminado." });
}
