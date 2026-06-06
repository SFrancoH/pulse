"use client";

import { use, useRef, useState } from "react";

type Props = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type CsvItem = {
  numero: string;
  estado?: string;
  canal?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  vendedor?: string;
  fecha_creacion?: string;
  valor_pagado?: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  recibidas?: number;
  actualizadas?: number;
  omitidas?: number;
  no_encontradas?: string[];
  errores?: string[];
};

type Resumen = {
  filasLeidas: number;
  lotes: number;
  actualizadas: number;
  omitidas: number;
  noEncontradas: string[];
  errores: string[];
};

const BATCH_SIZE = 200;

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizarHeader(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarNumero(value: string) {
  const limpio = String(value || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function mapearCampo(header: string) {
  const h = normalizarHeader(header);

  if (["numero", "nro", "boleta", "consecutivo", "numero_boleta", "n_boleta"].includes(h)) return "numero";
  if (["estado", "status"].includes(h)) return "estado";
  if (["canal", "origen", "channel"].includes(h)) return "canal";
  if (["nombre", "cliente", "nombre_cliente", "full_name", "name"].includes(h)) return "nombre";
  if (["telefono", "telefono_cliente", "phone", "celular", "whatsapp"].includes(h)) return "telefono";
  if (["email", "correo", "correo_electronico", "email_cliente"].includes(h)) return "email";
  if (["nombre_vendedor", "vendedor", "asesor", "seller"].includes(h)) return "vendedor";
  if (["fecha_de_creacion", "fecha_creacion", "fecha", "created_at"].includes(h)) return "fecha_creacion";
  if (["valor_pagago", "valor_pagado", "valor", "valor_a_pagar", "pago", "amount"].includes(h)) return "valor_pagado";

  return "";
}

function parseCsvBaseDatos(texto: string) {
  const errores: string[] = [];
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length === 0) {
    return { items: [], filasLeidas: 0, errores: ["El archivo CSV está vacío."] };
  }

  const primeraFila = parseCsvLine(lineas[0]);
  const camposHeader = primeraFila.map(mapearCampo);
  const tieneHeader = camposHeader.includes("numero") || camposHeader.includes("estado") || camposHeader.includes("canal");

  const campos = tieneHeader
    ? camposHeader
    : ["proyecto", "numero", "estado", "canal", "nombre", "telefono", "email", "vendedor", "fecha_creacion", "valor_pagado"];

  const dataLineas = tieneHeader ? lineas.slice(1) : lineas;
  const items: CsvItem[] = [];

  dataLineas.forEach((linea, index) => {
    const columnas = parseCsvLine(linea);
    const item: Record<string, string> = {};

    campos.forEach((campo, colIndex) => {
      if (!campo || campo === "proyecto") return;
      item[campo] = columnas[colIndex] || "";
    });

    const numero = normalizarNumero(item.numero || "");

    if (!numero) {
      errores.push(`Fila ${index + (tieneHeader ? 2 : 1)}: número inválido.`);
      return;
    }

    items.push({
      numero,
      estado: item.estado || "",
      canal: item.canal || "",
      nombre: item.nombre || "",
      telefono: item.telefono || "",
      email: item.email || "",
      vendedor: item.vendedor || "",
      fecha_creacion: item.fecha_creacion || "",
      valor_pagado: item.valor_pagado || "",
    });
  });

  return { items, filasLeidas: dataLineas.length, errores };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function ActualizarBaseDatosPage({ params }: Props) {
  const { proyectoId } = use(params);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [progreso, setProgreso] = useState("");

  async function enviarLote(items: CsvItem[]) {
    const res = await fetch(`/api/proyectos/${proyectoId}/actualizar-base-datos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });

    const data = (await res.json()) as ApiResponse;

    if (!data.success) {
      throw new Error(data.message || "No se pudo actualizar el lote.");
    }

    return data;
  }

  async function procesarCsv(file: File) {
    setLoading(true);
    setError("");
    setResumen(null);
    setProgreso("Leyendo archivo...");

    try {
      const texto = await file.text();
      const { items, filasLeidas, errores } = parseCsvBaseDatos(texto);

      if (items.length === 0) {
        throw new Error("El CSV no contiene registros válidos para actualizar.");
      }

      const lotes = chunkArray(items, BATCH_SIZE);
      let actualizadas = 0;
      let omitidas = 0;
      const noEncontradas: string[] = [];
      const erroresProceso = [...errores];

      for (let index = 0; index < lotes.length; index++) {
        setProgreso(`Procesando lote ${index + 1} de ${lotes.length}...`);

        try {
          const data = await enviarLote(lotes[index]);
          actualizadas += data.actualizadas || 0;
          omitidas += data.omitidas || 0;
          if (data.no_encontradas?.length) noEncontradas.push(...data.no_encontradas);
          if (data.errores?.length) erroresProceso.push(...data.errores);
        } catch (err) {
          erroresProceso.push(`Lote ${index + 1}: ${err instanceof Error ? err.message : "Error desconocido"}`);
        }
      }

      setResumen({
        filasLeidas,
        lotes: lotes.length,
        actualizadas,
        omitidas,
        noEncontradas,
        errores: erroresProceso,
      });
      setProgreso("Proceso terminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el CSV.");
      setProgreso("");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Actualización masiva</p>
          <h1 className="mt-2 text-4xl font-bold">Actualizar base de datos</h1>
          <p className="mt-3 break-all text-sm text-white/70">Proyecto: {proyectoId}</p>
        </div>

        <div className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
            <p className="text-sm font-semibold">Subir CSV del Excel</p>
            <p className="mt-1 text-sm text-[#6F665C]">
              Puedes subir columnas con encabezados: proyecto, numero, estado, canal, nombre, telefono, email, Nombre vendedor, Fecha de creacion y valor pagago.
            </p>
            <p className="mt-1 text-sm text-[#6F665C]">
              También acepta el orden fijo del Excel: A proyecto, B numero, C estado, D canal, E nombre, F telefono, G email, H vendedor, I fecha, J valor pagado.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) procesarCsv(file);
              }}
              className="mt-4 w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#1A1A1A] file:px-4 file:py-2 file:font-semibold file:text-white"
            />

            {progreso && <p className="mt-3 text-sm font-medium text-[#6F665C]">{progreso}</p>}
          </div>

          {resumen && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
              <p className="font-semibold">Actualización completada</p>
              <div className="mt-3 space-y-1">
                <p>Filas leídas: {resumen.filasLeidas}</p>
                <p>Lotes procesados: {resumen.lotes}</p>
                <p>Actualizadas: {resumen.actualizadas}</p>
                <p>Omitidas: {resumen.omitidas}</p>
              </div>
              {resumen.noEncontradas.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold">No encontradas:</p>
                  <p className="break-all">{resumen.noEncontradas.join(", ")}</p>
                </div>
              )}
              {resumen.errores.length > 0 && (
                <div className="mt-4 text-red-700">
                  <p className="font-semibold">Errores:</p>
                  <p className="break-all">{resumen.errores.join(" | ")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
