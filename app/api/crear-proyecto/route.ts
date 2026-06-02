import { supabaseAdmin } from "@/lib/supabase-admin";
import { sincronizarBoletasInicialesConSheet } from "@/lib/apps-script-sync";
import { slugify } from "@/lib/slug";

const TOTAL_NUMEROS = 10000;
const TAMANO_LOTE = 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-sand-omega.vercel.app";

function crearBoletas(empresa_id: string, proyecto_id: string) {
  return Array.from({ length: TOTAL_NUMEROS }, (_, index) => ({
    empresa_id,
    proyecto_id,
    numero: String(index).padStart(4, "0"),
    estado: "disponible",
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const empresa_id = String(body.empresa_id || "").trim();
    const nombre = String(body.nombre || "").trim();
    const precio_boleta = Number(body.precio_boleta || 60000);
    const formulario_compra_url = String(body.formulario_compra_url || "").trim();

    if (!empresa_id || !nombre) {
      return Response.json(
        {
          success: false,
          message: "empresa_id y nombre son obligatorios.",
        },
        { status: 400 }
      );
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug,apps_script_url")
      .eq("id", empresa_id)
      .single();

    if (empresaError || !empresa) {
      return Response.json(
        {
          success: false,
          message: "Empresa no encontrada.",
        },
        { status: 404 }
      );
    }

    const proyectoSlug = slugify(nombre);
    const proyecto_id = `${empresa_id}_${proyectoSlug.replace(/-/g, "_")}`;

    const { error: proyectoError } = await supabaseAdmin
      .from("proyectos")
      .upsert({
        id: proyecto_id,
        empresa_id,
        nombre,
        slug: proyectoSlug,
        precio_boleta,
        formulario_compra_url,
        estado: "activo",
      });

    if (proyectoError) {
      throw proyectoError;
    }

    const boletas = crearBoletas(empresa_id, proyecto_id);

    for (let inicio = 0; inicio < boletas.length; inicio += TAMANO_LOTE) {
      const lote = boletas.slice(inicio, inicio + TAMANO_LOTE);

      const { error } = await supabaseAdmin
        .from("boletas")
        .upsert(lote, {
          onConflict: "proyecto_id,numero",
          ignoreDuplicates: true,
        });

      if (error) {
        throw error;
      }
    }

    let sheet_sync = "sin_configurar";
    let sheet_sync_error = "";

    if (empresa.apps_script_url) {
      try {
        await sincronizarBoletasInicialesConSheet(
          empresa.apps_script_url,
          proyecto_id,
          boletas.map((boleta) => boleta.numero)
        );

        sheet_sync = "sincronizado";
      } catch (error: unknown) {
        sheet_sync = "error";
        sheet_sync_error = error instanceof Error ? error.message : "Error sincronizando Apps Script";
      }
    }

    const url = `${BASE_URL}/r/${empresa.slug}/${proyectoSlug}`;
    const webhook_url = `${BASE_URL}/api/proyectos/${proyecto_id}/actualizar-boleta`;
    const asignar_vendedor_url = `${BASE_URL}/admin/proyectos/${proyecto_id}/asignar-vendedor`;

    return Response.json({
      success: true,
      empresa_id,
      proyecto_id,
      proyecto_slug: proyectoSlug,
      url,
      webhook_url,
      asignar_vendedor_url,
      sheet_sync,
      sheet_sync_error,
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
