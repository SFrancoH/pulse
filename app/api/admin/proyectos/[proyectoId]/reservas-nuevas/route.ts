import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

function fechaValida(value: string | null) {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const { proyecto, error } = await requireProjectManagerAccess(proyectoId);

    if (error || !proyecto) {
      return error || Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const url = new URL(req.url);
    const since = fechaValida(url.searchParams.get("since"));

    if (!since) {
      return Response.json(
        { success: false, message: "El parámetro since es obligatorio y debe ser una fecha válida." },
        { status: 400 }
      );
    }

    const { data, error: queryError } = await supabaseAdmin
      .from("boletas")
      .select("numero,estado,nombre_cliente,vendedor_nombre,canal,reservado_en")
      .eq("empresa_id", proyecto.empresa_id)
      .eq("proyecto_id", proyectoId)
      .gt("reservado_en", since)
      .order("reservado_en", { ascending: true })
      .limit(50);

    if (queryError) throw queryError;

    return Response.json({
      success: true,
      reservas: data || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
