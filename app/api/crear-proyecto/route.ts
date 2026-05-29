import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slug";

const TOTAL_NUMEROS = 10000;
const TAMANO_LOTE = 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-hqaj29tnm-soy-sebastian-franco-s-projects.vercel.app";

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

    const url = `${BASE_URL}/${empresa.slug}/${proyectoSlug}`;

    return Response.json({
      success: true,
      empresa_id,
      proyecto_id,
      proyecto_slug: proyectoSlug,
      url,
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
