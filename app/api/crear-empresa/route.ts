import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "@/lib/require-admin";
import { slugify } from "@/lib/slug";

function limpiarId(value: string) {
  return value.trim();
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();

  if (auth.error) {
    return auth.error;
  }

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
          message: "Datos inválidos.",
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
      message: "Empresa creada correctamente.",
      empresa: data,
    });
  } catch {
    return Response.json(
      {
        success: false,
        message: "Error interno.",
      },
      { status: 500 }
    );
  }
}
