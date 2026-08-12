import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canAccessEmpresa, requireCompanyManagerSession } from "@/lib/require-admin";
import { crearProjectSalesToken, crearUrlPublicaDeProyecto } from "@/lib/project-sales-links";
import { slugify } from "@/lib/slug";

const TOTAL_NUMEROS = 10000;
const TAMANO_LOTE = 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-sand-omega.vercel.app";
const PUBLIC_BOLETA_BASE_URL = process.env.PUBLIC_BOLETA_BASE_URL || "https://javiertoyotas.com/boleta";

function crearBoletas(empresaId: string, proyectoId: string) {
  return Array.from({ length: TOTAL_NUMEROS }, (_, index) => {
    const id = randomUUID();
    const url = new URL(PUBLIC_BOLETA_BASE_URL);
    url.searchParams.set("id", empresaId);
    url.searchParams.set("proyecto", proyectoId);
    url.searchParams.set("numero", id);

    return {
      id,
      empresa_id: empresaId,
      proyecto_id: proyectoId,
      numero: String(index).padStart(4, "0"),
      estado: "Disponible",
      canal: "Oficina",
      vendedor_nombre: "Oficina",
      vendedor_user_id: null,
      comprobante_url: url.toString(),
    };
  });
}

export async function POST(req: Request) {
  const auth = await requireCompanyManagerSession();
  if (auth.error || !auth.session) return auth.error;

  try {
    const body = await req.json();
    const empresaId = String(body.empresa_id || "").trim();
    const nombre = String(body.nombre || "").trim();
    const precioBoleta = Number(body.precio_boleta || 60000);
    const formularioCompraUrl = String(body.formulario_compra_url || "").trim();
    const flyerUrl = String(body.flyer_url || "").trim();

    if (!empresaId || !nombre) {
      return Response.json({ success: false, message: "Datos inválidos." }, { status: 400 });
    }

    if (!canAccessEmpresa(auth.session, empresaId)) {
      return Response.json({ success: false, message: "No autorizado para esta empresa." }, { status: 403 });
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug")
      .eq("id", empresaId)
      .single();

    if (empresaError || !empresa) {
      return Response.json({ success: false, message: "Empresa no encontrada." }, { status: 404 });
    }

    const proyectoSlug = slugify(nombre);
    const proyectoId = `${empresaId}_${proyectoSlug.replace(/-/g, "_")}`;
    const salesToken = crearProjectSalesToken();

    const { error: proyectoError } = await supabaseAdmin.from("proyectos").insert({
      id: proyectoId,
      empresa_id: empresaId,
      nombre,
      slug: proyectoSlug,
      precio_boleta: precioBoleta,
      formulario_compra_url: formularioCompraUrl,
      flyer_url: flyerUrl,
      sales_token: salesToken,
      estado: "activo",
    });
    if (proyectoError) throw proyectoError;

    const boletas = crearBoletas(empresaId, proyectoId);
    for (let inicio = 0; inicio < boletas.length; inicio += TAMANO_LOTE) {
      const { error } = await supabaseAdmin.from("boletas").upsert(boletas.slice(inicio, inicio + TAMANO_LOTE), {
        onConflict: "proyecto_id,numero",
        ignoreDuplicates: true,
      });
      if (error) throw error;
    }

    return Response.json({
      success: true,
      empresa_id: empresaId,
      proyecto_id: proyectoId,
      proyecto_slug: proyectoSlug,
      sales_token: salesToken,
      url: crearUrlPublicaDeProyecto(salesToken),
      pulse_url: `${BASE_URL}/o/${salesToken}`,
      webhook_url: `${BASE_URL}/api/proyectos/${proyectoId}/actualizar-boleta`,
      asignar_vendedor_url: `${BASE_URL}/admin/proyectos/${proyectoId}/asignar-vendedor`,
      total_boletas: boletas.length,
    });
  } catch (error: unknown) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Error interno." }, { status: 500 });
  }
}
