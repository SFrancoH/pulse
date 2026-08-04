import { getCurrentAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pulse-sand-omega.vercel.app";
const PAGE_SIZE = 1000;

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

async function proyectosDelVendedor(userId: string, empresaId: string) {
  const proyectoIds = new Set<string>();
  let desde = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("proyecto_id")
      .eq("empresa_id", empresaId)
      .eq("vendedor_user_id", userId)
      .range(desde, desde + PAGE_SIZE - 1);

    if (error) throw error;

    const lote = data || [];
    for (const item of lote) proyectoIds.add(item.proyecto_id);

    if (lote.length < PAGE_SIZE) break;
    desde += PAGE_SIZE;
  }

  return Array.from(proyectoIds);
}

export async function GET() {
  try {
    const session = await getCurrentAdminSession();

    if (!session) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
    }

    if (session.rol !== "super_admin" && !session.empresa_id) {
      return Response.json({ success: false, message: "Usuario sin empresa asignada." }, { status: 403 });
    }

    if (session.rol === "vendedor" && !session.user_id) {
      return Response.json({ success: false, message: "No fue posible identificar al vendedor." }, { status: 403 });
    }

    let empresasQuery = supabaseAdmin
      .from("empresas")
      .select("id,nombre,slug")
      .order("nombre", { ascending: true });

    if (session.rol !== "super_admin") {
      empresasQuery = empresasQuery.eq("id", session.empresa_id!);
    }

    const { data: empresas, error: empresasError } = await empresasQuery;
    if (empresasError) throw empresasError;

    const empresasTipadas = (empresas || []) as Empresa[];
    const empresaIds = empresasTipadas.map((empresa) => empresa.id);

    if (empresaIds.length === 0) {
      return Response.json({ success: true, role: session.rol, empresa_id: session.empresa_id || null, empresas: [] });
    }

    let proyectosPermitidos: string[] | null = null;
    if (session.rol === "vendedor") {
      proyectosPermitidos = await proyectosDelVendedor(session.user_id!, session.empresa_id!);
    }

    let proyectos: Proyecto[] = [];

    if (proyectosPermitidos === null || proyectosPermitidos.length > 0) {
      let proyectosQuery = supabaseAdmin
        .from("proyectos")
        .select("id,empresa_id,nombre,slug,estado,flyer_url,precio_boleta")
        .in("empresa_id", empresaIds)
        .order("created_at", { ascending: false });

      if (proyectosPermitidos) {
        proyectosQuery = proyectosQuery.in("id", proyectosPermitidos);
      }

      const { data, error } = await proyectosQuery;
      if (error) throw error;
      proyectos = (data || []) as Proyecto[];
    }

    const grupos = empresasTipadas.map((empresa) => ({
      empresa,
      proyectos: proyectos
        .filter((proyecto) => proyecto.empresa_id === empresa.id)
        .map((proyecto) => ({
          ...proyecto,
          ventas_url: `${BASE_URL}/r/${empresa.slug}/${proyecto.slug}`,
          base_datos_url: `${BASE_URL}/admin/proyectos/${proyecto.id}/base-datos`,
          asignar_vendedor_url:
            session.rol === "vendedor"
              ? null
              : `${BASE_URL}/admin/proyectos/${proyecto.id}/asignar-vendedor`,
        })),
    }));

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
