import { sincronizarLoteBoletasConSheet } from "@/lib/apps-script-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type CsvItem = {
  numero?: string;
  estado?: string;
  canal?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  vendedor?: string;
  fecha_creacion?: string;
  valor_pagado?: string | number;
};

type Payload = {
  items?: CsvItem[];
};

const ESTADOS_VALIDOS = new Set(["Disponible", "No disponible", "Debe", "Abonado", "Pagado", "disponible"]);

function normalizarNumero(valor: unknown) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function texto(valor: unknown) {
  return String(valor || "").trim();
}

function normalizarEstado(valor: unknown) {
  const raw = texto(valor);
  const lower = raw.toLowerCase();

  if (!raw) return "";
  if (raw === "disponible") return "disponible";
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
  const numero = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numero) ? numero : undefined;
}

function crearUpdateData(item: CsvItem) {
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
    const sincronizarItems: CsvItem[] = [];
    let empresaId = "";

    for (const item of items) {
      const numero = normalizarNumero(item.numero);

      if (!numero) {
        omitidas++;
        errores.push("Registro sin número válido.");
        continue;
      }

      const updateData = crearUpdateData(item);

      const { data, error } = await supabaseAdmin
        .from("boletas")
        .update(updateData)
        .eq("proyecto_id", proyectoId)
        .eq("numero", numero)
        .select("id,empresa_id,numero")
        .maybeSingle();

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

      empresaId = empresaId || data.empresa_id;
      actualizadas++;
      sincronizarItems.push({ ...item, numero });
    }

    if (empresaId && sincronizarItems.length > 0) {
      const { data: empresa, error: empresaError } = await supabaseAdmin
        .from("empresas")
        .select("apps_script_url")
        .eq("id", empresaId)
        .maybeSingle();

      if (empresaError) {
        errores.push(`Apps Script URL: ${empresaError.message}`);
      }

      if (empresa?.apps_script_url) {
        try {
          await sincronizarLoteBoletasConSheet(
            empresa.apps_script_url,
            sincronizarItems.map((item) => ({
              proyecto: proyectoId,
              numero: normalizarNumero(item.numero),
              estado: normalizarEstado(item.estado) || undefined,
              canal: texto(item.canal),
              nombre: texto(item.nombre),
              telefono: texto(item.telefono),
              email: texto(item.email),
              vendedor: texto(item.vendedor),
              valor_pagado: item.valor_pagado ?? "",
            }))
          );
        } catch (error: unknown) {
          errores.push(`Google Sheets: ${error instanceof Error ? error.message : "Error desconocido"}`);
        }
      }
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
