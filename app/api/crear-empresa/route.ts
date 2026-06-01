import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slug";

function limpiarId(value: string) {
  return value.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = limpiarId(String(body.id || ""));
    const nombre = String(body.nombre || "").trim();
    const slugEntrada = String(body.slug || slugify(nombre)).trim();
    const slug = slugify(slugEntrada || nombre);
    const apps_script_url = String(body.apps_script_url || "").trim();

    if (!id || !nombre || !slug) {
      return Response.json(
        {
          success: false,
          message: "id, nombre y slug son obligatorios.",
        },
        { status: 400 }
      );
    }

    const payload = {
      id,
      nombre,
      slug,
      apps_script_url,
      estado: "activa",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("empresas")
      .upsert(payload, { onConflict: "id" })
      .select("id,nombre,slug,apps_script_url,estado")
      .single();

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      message: "Empresa creada o actualizada correctamente.",
      empresa: data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
