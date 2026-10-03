"use client";

import { use, useRef, useState } from "react";
import { parseCsvBoletas, type CsvBoletaItem } from "@/lib/boletas-csv";

type Props = {
  params: Promise<{
    proyectoId: string;
  }>;
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

  async function enviarLote(items: CsvBoletaItem[]) {
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
      const { items, filasLeidas, errores } = parseCsvBoletas(texto, true);
      if (errores.length) throw new Error(errores.slice(0, 5).join(" "));

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
              Para actualizar sólo estado y valor pagado, sube: id, empresa_id, proyecto_id, numero, estado, valor_pagado. Los identificadores deben corresponder al proyecto seleccionado. Acepta coma o punto y coma; las columnas ausentes o vacías conservan su valor actual.
            </p>
            <p className="mt-1 text-sm text-[#6F665C]">
              También permite actualizar cliente, canal y vendedor si se incluyen esas columnas, y acepta el orden fijo del Excel sin encabezados: A proyecto, B numero, C estado, D canal, E nombre, F telefono, G email, H vendedor, I fecha, J valor pagado.
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
