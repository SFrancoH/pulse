import { requireProjectManagerAccess } from "@/lib/require-admin";
import { leerSorteos, validarSorteos } from "@/lib/project-draws";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ proyectoId: string }> };
function origenPermitido(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

export async function GET(_req: Request, { params }: Props) {
  const { proyectoId } = await params;
  const auth = await requireProjectManagerAccess(proyectoId);
  if (auth.error || !auth.proyecto) return auth.error;
  const { data, error } = await supabaseAdmin.from("proyectos")
    .select("nombre,sorteos_config").eq("id", proyectoId)
    .eq("empresa_id", auth.proyecto.empresa_id).maybeSingle();
  if (error) return Response.json({ success: false, message: "Instala primero la actualización de fechas de sorteos." }, { status: 503 });
  return Response.json({ success: true, proyecto: data?.nombre, sorteos: leerSorteos(data?.sorteos_config) });
}

export async function PATCH(req: Request, { params }: Props) {
  const { proyectoId } = await params;
  const auth = await requireProjectManagerAccess(proyectoId);
  if (auth.error || !auth.proyecto) return auth.error;
  if (!origenPermitido(req)) return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
  try {
    const body = await req.json();
    const sorteos = validarSorteos(body.sorteos);
    const { data, error } = await supabaseAdmin.from("proyectos")
      .update({ sorteos_config: sorteos })
      .eq("id", proyectoId).eq("empresa_id", auth.proyecto.empresa_id)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ success: false, message: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ success: true, message: "Fechas de sorteos actualizadas." });
  } catch (err) {
    return Response.json({ success: false, message: err instanceof Error ? err.message : "No se pudieron guardar las fechas." }, { status: 400 });
  }
}
