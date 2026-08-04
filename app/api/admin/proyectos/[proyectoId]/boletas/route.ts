import { requireProjectAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = { params: Promise<{ proyectoId: string }> };

const ESTADOS = new Set(["Disponible", "No disponible", "Debe", "Abonado", "Pagado"]);
const CAMPOS_ADMIN = new Set([
  "estado",
  "nombre_cliente",
  "telefono_cliente",
  "email_cliente",
  "valor_pagado",
  "vendedor_nombre",
  "canal",
]);
const CAMPOS_VENDEDOR = new Set([
  "estado",
  "nombre_cliente",
  "telefono_cliente",
  "email_cliente",
  "valor_pagado",
]);
const PAGE_SIZE = 1000;

function limpiarCambios(input: Record<string, unknown>, vendedor: boolean) {
  const cambios: Record<string, unknown> = {};
  const camposPermitidos = vendedor ? CAMPOS_VENDEDOR : CAMPOS_ADMIN;

  for (const [campo, valor] of Object.entries(input || {})) {
    if (!camposPermitidos.has(campo)) continue;

    if (campo === "estado") {
      const estado = String(valor || "").trim();
      if (!ESTADOS.has(estado)) throw new Error(`Estado inválido: ${estado || "vacío"}`);
      cambios.estado = estado;
    } else if (campo === "valor_pagado") {
      if (valor === "" || valor === null || valor === undefined) cambios.valor_pagado = 0;
      else {
        const numero = Number(valor);
        if (!Number.isFinite(numero) || numero < 0) throw new Error("El valor pagado no es válido.");
        cambios.valor_pagado = numero;
      }
    } else {
      cambios[campo] = String(valor ?? "").trim() || null;
    }
  }

  cambios.updated_at = new Date().toISOString();
  return cambios;
}

export async function GET(_req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectAccess(proyectoId);
    if (auth.error || !auth.session || !auth.proyecto) return auth.error;

    const esVendedor = auth.session.rol === "vendedor";
    const boletas: unknown[] = [];
    let desde = 0;

    while (true) {
      let query = supabaseAdmin
        .from("boletas")
        .select("id,numero,estado,nombre_cliente,telefono_cliente,email_cliente,valor_pagado,vendedor_nombre,canal")
        .eq("proyecto_id", proyectoId)
        .order("numero", { ascending: true })
        .range(desde, desde + PAGE_SIZE - 1);

      if (esVendedor) query = query.eq("vendedor_user_id", auth.session.user_id!);

      const { data, error } = await query;
      if (error) throw error;

      const lote = data || [];
      boletas.push(...lote);

      if (lote.length < PAGE_SIZE) break;
      desde += PAGE_SIZE;
    }

    return Response.json({
      success: true,
      role: auth.session.rol,
      proyecto: auth.proyecto,
      boletas,
      total: boletas.length,
    });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectAccess(proyectoId);
    if (auth.error || !auth.session) return auth.error;

    const esVendedor = auth.session.rol === "vendedor";
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const cambios = limpiarCambios(body.cambios || {}, esVendedor);

    if (ids.length === 0) {
      return Response.json({ success: false, message: "Selecciona al menos una boleta." }, { status: 400 });
    }

    if (Object.keys(cambios).length === 1) {
      return Response.json({ success: false, message: "No hay cambios permitidos para aplicar." }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("boletas")
      .update(cambios)
      .eq("proyecto_id", proyectoId)
      .in("id", ids);

    if (esVendedor) query = query.eq("vendedor_user_id", auth.session.user_id!);

    const { data, error } = await query.select("id");
    if (error) throw error;

    return Response.json({ success: true, actualizadas: data?.length || 0 });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Error interno." },
      { status: 500 }
    );
  }
}
