import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "@/lib/require-admin";
import { slugify } from "@/lib/slug";
import { cifrarWebhook } from "@/lib/reservation-webhook";

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
    const webhookUrl = String(body.webhook_url || "").trim();
    const urlCifrada = webhookUrl ? cifrarWebhook(webhookUrl) : null;

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
      estado: "activa",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("empresas")
      .upsert(payload, { onConflict: "id" })
      .select("id,nombre,slug,estado")
      .single();

    if (error) {
      throw error;
    }

    if (urlCifrada) {
      const { error: integracionError } = await supabaseAdmin.from("pulse_empresa_integraciones")
        .upsert({empresa_id:id,webhook_url_cifrada:urlCifrada,updated_at:new Date().toISOString()},{onConflict:"empresa_id"});
      if (integracionError) return Response.json({success:false,message:"Empresa guardada, pero falta configurar la integración. Abre su configuración privada."},{status:503});
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
