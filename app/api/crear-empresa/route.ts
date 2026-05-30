import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = String(body.id || "").trim();
    const nombre = String(body.nombre || "").trim();
    const slug = String(body.slug || slugify(nombre)).trim();
    const apps_script_url = String(body.apps_script_url || "").trim();

    if (!id || !nombre) {
      return Response.json(
        {
          success: false,
          message: "id y nombre son obligatorios.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("empresas")
      .upsert({
        id,
        nombre,
        slug: slugify(slug),
        apps_script_url,
        estado: "activa",
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      message: "Empresa creada o actualizada correctamente.",
      empresa: {
        id,
        nombre,
        slug: slugify(slug),
        apps_script_url,
      },
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
