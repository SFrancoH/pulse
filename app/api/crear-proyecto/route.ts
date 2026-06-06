import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/require-admin";
import { slugify } from "@/lib/slug";

const TOTAL_NUMEROS = 10000;
const TAMANO_LOTE = 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-sand-omega.vercel.app";

function crearBoletas(empresa_id: string, proyecto_id: string) {
  return Array.from({ length: TOTAL_NUMEROS }, (_, index) => ({
    empresa_id,
    proyecto_id,
    numero: String(index).padStart(4, "0"),
    estado: "Disponible",
    canal: "Vacio",
  }));
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json();

    const empresa_id = String(body.empresa_id || "").trim();
    const nombre = String(body.nombre || "").trim();
    const precio_boleta = Number(body.precio_boleta || 60000);
    const formulario_compra_url = String(body.formulario_compra_url || "").trim();
    const flyer_url = String(body.flyer_url || "").trim();

    if (!empresa_id || !nombre) {
      return Response.json(
        {
          success: false,
          message: "Datos inválidos.",
        },
        { status: 400 }
      );
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug")
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
        flyer_url,
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
    });
  } catch (error: unknown) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno.",
      },
      { status: 500 }
    );
  }
}
