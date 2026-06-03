import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

const PAGE_SIZE = 1000;

function clampPage(value: string | null) {
  const page = Number(value || 0);
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(9, Math.floor(page)));
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const url = new URL(req.url);
    const page = clampPage(url.searchParams.get("page"));
    const desde = page * PAGE_SIZE;
    const hasta = desde + PAGE_SIZE - 1;
    const desdeTexto = String(desde).padStart(4, "0");
    const hastaTexto = String(hasta).padStart(4, "0");

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("proyecto_id", proyectoId)
      .eq("estado", "disponible")
      .gte("numero", desdeTexto)
      .lte("numero", hastaTexto)
      .order("numero", { ascending: true });

    if (error) throw error;

    return Response.json({
      success: true,
      page,
      desde,
      hasta,
      desde_texto: desdeTexto,
      hasta_texto: hastaTexto,
      boletas: data || [],
      has_previous: page > 0,
      has_next: page < 9,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
