import { getCurrentAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = { params: Promise<{ proyectoId: string }> };

const ESTADOS = new Set(["Disponible", "No disponible", "Debe", "Abonado", "Pagado"]);
const CAMPOS = new Set(["estado", "nombre_cliente", "telefono_cliente", "email_cliente", "valor_pagado", "vendedor_nombre", "canal"]);

async function proyectoAutorizado(proyectoId: string) {
  const session = await getCurrentAdminSession();
  if (!session) return { error: Response.json({ success: false, message: "No autorizado." }, { status: 401 }) };

  const { data: proyecto, error } = await supabaseAdmin.from("proyectos").select("id,empresa_id,nombre").eq("id", proyectoId).maybeSingle();
  if (error || !proyecto) return { error: Response.json({ success: false, message: "Proyecto no encontrado." }, { status: 404 }) };
  if (session.rol !== "super_admin" && session.empresa_id !== proyecto.empresa_id) {
    return { error: Response.json({ success: false, message: "No autorizado para este proyecto." }, { status: 403 }) };
  }
  return { proyecto };
}

function limpiarCambios(input: Record<string, unknown>) {
  const cambios: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(input || {})) {
    if (!CAMPOS.has(campo)) continue;
    if (campo === "estado") {
      const estado = String(valor || "").trim();
      if (estado && !ESTADOS.has(estado)) throw new Error(`Estado inválido: ${estado}`);
      cambios.estado = estado || null;
    } else if (campo === "valor_pagado") {
      if (valor === "" || valor === null || valor === undefined) cambios.valor_pagado = 0;
      else {
        const numero = Number(valor);
        if (!Number.isFinite(numero) || numero < 0) throw new Error("El valor pagado no es válido.");
        cambios.valor_pagado = numero;
      }
    } else cambios[campo] = String(valor ?? "").trim() || null;
  }
  cambios.updated_at = new Date().toISOString();
  return cambios;
}

export async function GET(_req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await proyectoAutorizado(proyectoId);
    if (auth.error) return auth.error;
    const { data, error } = await supabaseAdmin.from("boletas")
      .select("id,numero,estado,nombre_cliente,telefono_cliente,email_cliente,valor_pagado,vendedor_nombre,canal")
      .eq("proyecto_id", proyectoId).order("numero", { ascending: true }).limit(10000);
    if (error) throw error;
    return Response.json({ success: true, proyecto: auth.proyecto, boletas: data || [] });
  } catch (error: unknown) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Error interno." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await proyectoAutorizado(proyectoId);
    if (auth.error) return auth.error;
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const cambios = limpiarCambios(body.cambios || {});
    if (ids.length === 0) return Response.json({ success: false, message: "Selecciona al menos una boleta." }, { status: 400 });
    if (Object.keys(cambios).length === 1) return Response.json({ success: false, message: "No hay cambios para aplicar." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("boletas").update(cambios).eq("proyecto_id", proyectoId).in("id", ids).select("id");
    if (error) throw error;
    return Response.json({ success: true, actualizadas: data?.length || 0 });
  } catch (error: unknown) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Error interno." }, { status: 500 });
  }
}
