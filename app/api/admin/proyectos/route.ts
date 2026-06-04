import { getCurrentAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-sand-omega.vercel.app";

type Empresa = {
  id: string;
  nombre: string;
  slug: string;
};

type Proyecto = {
  id: string;
  empresa_id: string;
  nombre: string;
  slug: string;
  estado: string | null;
  flyer_url?: string | null;
  precio_boleta?: number | null;
};

export async function GET() {
  try {
    const session = await getCurrentAdminSession();

    if (!session) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
    }

    let empresasQuery = supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug")
      .order("nombre", { ascending: true });

    if (session.rol === "empresa_admin") {
      if (!session.empresa_id) {
        return Response.json({ success: false, message: "Usuario sin empresa asignada." }, { status: 403 });
      }

      empresasQuery = empresasQuery.eq("id", session.empresa_id);
    }

    const { data: empresas, error: empresasError } = await empresasQuery;
    if (empresasError) throw empresasError;

    const empresaIds = ((empresas || []) as Empresa[]).map((empresa) => empresa.id);

    if (empresaIds.length === 0) {
      return Response.json({ success: true, role: session.rol, empresas: [] });
    }

    const { data: proyectos, error: proyectosError } = await supabaseAdmin
      .from("proyectos")
      .select("id,empresa_id,nombre,slug,estado,flyer_url,precio_boleta")
      .in("empresa_id", empresaIds)
      .order("created_at", { ascending: false });

    if (proyectosError) throw proyectosError;

    const grupos = ((empresas || []) as Empresa[]).map((empresa) => {
      const proyectosEmpresa = ((proyectos || []) as Proyecto[])
        .filter((proyecto) => proyecto.empresa_id === empresa.id)
        .map((proyecto) => ({
          ...proyecto,
          ventas_url: `${BASE_URL}/r/${empresa.slug}/${proyecto.slug}`,
          asignar_vendedor_url: `${BASE_URL}/admin/proyectos/${proyecto.id}/asignar-vendedor`,
        }));

      return {
        empresa,
        proyectos: proyectosEmpresa,
      };
    });

    return Response.json({
      success: true,
      role: session.rol,
      empresa_id: session.empresa_id || null,
      empresas: grupos,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
