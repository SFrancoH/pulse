import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizarNumeroCsv, type CsvBoletaItem } from "@/lib/boletas-csv";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = {
  items?: CsvBoletaItem[];
};

const ESTADOS_VALIDOS = new Set(["Disponible", "No disponible", "Debe", "Abonado", "Pagado"]);

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function normalizarEstado(valor: unknown) {
  const raw = texto(valor);
  const lower = raw.toLowerCase();

  if (!raw) return "";
  if (lower === "disponible") return "Disponible";
  if (lower === "no disponible" || lower === "nodisponible") return "No disponible";
  if (lower === "debe") return "Debe";
  if (lower === "abonado" || lower === "abonada") return "Abonado";
  if (lower === "pagado" || lower === "pagada") return "Pagado";

  return ESTADOS_VALIDOS.has(raw) ? raw : "";
}

function normalizarValor(valor: unknown) {
  const raw = texto(valor);
  if (!raw) return undefined;
  if (!/^\$?\s*\d[\d.,\s]*$/.test(raw)) return undefined;
  const numero = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numero) && numero >= 0 ? numero : undefined;
}

function crearUpdateData(item: CsvBoletaItem) {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const estado = normalizarEstado(item.estado);
  const canal = texto(item.canal);
  const nombre = texto(item.nombre);
  const telefono = texto(item.telefono);
  const email = texto(item.email);
  const vendedor = texto(item.vendedor);
  const valorPagado = normalizarValor(item.valor_pagado);

  if (estado) updateData.estado = estado;
  if (canal) updateData.canal = canal;
  if (nombre) updateData.nombre_cliente = nombre;
  if (telefono) updateData.telefono_cliente = telefono;
  if (email) updateData.email_cliente = email;
  if (vendedor) updateData.vendedor_nombre = vendedor;
  if (typeof valorPagado === "number") updateData.valor_pagado = valorPagado;

  return updateData;
}

export async function POST(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.proyecto) return auth.error;

    const body = (await req.json()) as Payload;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Debes enviar al menos un registro.",
        },
        { status: 400 }
      );
    }

    let actualizadas = 0;
    let omitidas = 0;
    const no_encontradas: string[] = [];
    const errores: string[] = [];

    for (const item of items) {
      const numero = normalizarNumeroCsv(item?.numero);

      if (!numero) {
        omitidas++;
        errores.push("Registro sin número válido.");
        continue;
      }

      if ((item.empresa_id !== undefined && texto(item.empresa_id) !== auth.proyecto.empresa_id)
        || (item.proyecto_id !== undefined && texto(item.proyecto_id) !== proyectoId)) {
        omitidas++;
        errores.push(`${numero}: la empresa o el proyecto del CSV no coincide con el proyecto seleccionado.`);
        continue;
      }

      const id = texto(item.id);
      if (item.id !== undefined && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
        omitidas++;
        errores.push(`${numero}: id de boleta inválido.`);
        continue;
      }

      if ((texto(item.estado) && !normalizarEstado(item.estado))
        || (texto(item.valor_pagado) && normalizarValor(item.valor_pagado) === undefined)) {
        omitidas++;
        errores.push(`${numero}: estado o valor pagado inválido.`);
        continue;
      }

      const updateData = crearUpdateData(item);
      if (Object.keys(updateData).length === 1) {
        omitidas++;
        errores.push(`${numero}: no contiene valores para actualizar.`);
        continue;
      }

      let query = supabaseAdmin
        .from("boletas")
        .update(updateData)
        .eq("empresa_id", auth.proyecto.empresa_id)
        .eq("proyecto_id", proyectoId)
        .eq("numero", numero);
      if (id) query = query.eq("id", id);

      const { data, error } = await query.select("id,numero").maybeSingle();

      if (error) {
        omitidas++;
        errores.push(`${numero}: ${error.message}`);
        continue;
      }

      if (!data) {
        omitidas++;
        no_encontradas.push(numero);
        continue;
      }

      actualizadas++;
    }

    return Response.json({
      success: true,
      message: "Base de datos actualizada correctamente.",
      recibidas: items.length,
      actualizadas,
      omitidas,
      no_encontradas,
      errores,
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
