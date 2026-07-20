"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type BoletaResponse = {
  success: boolean;
  message?: string;
  proyecto?: { nombre: string; flyer_url?: string | null; precio_boleta: number };
  boleta?: { numero: string; estado: string; disponible: boolean; nombre_cliente?: string | null; telefono_cliente?: string | null; valor_pagado: number; saldo_pendiente: number };
  vendedor?: { nombre: string; telefono?: string | null } | null;
};

const dinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function BoletaPublicaPage() {
  const params = useSearchParams();
  const [data, setData] = useState<BoletaResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const empresa = params.get("id") || "";
    const proyecto = params.get("proyecto") || "";
    const numero = params.get("numero") || "";

    async function cargar() {
      try {
        setLoading(true);
        setError("");
        const query = new URLSearchParams({ id: empresa, proyecto, numero });
        const res = await fetch(`/api/public/boleta?${query.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as BoletaResponse;
        if (!res.ok || !json.success) throw new Error(json.message || "No fue posible consultar la boleta.");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible consultar la boleta.");
      } finally {
        setLoading(false);
      }
    }

    void cargar();
  }, [params]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F2EDE4] p-5 text-[#1A1A1A]"><p className="text-lg font-semibold">Consultando boleta...</p></main>;
  if (error || !data?.boleta || !data.proyecto) return <main className="flex min-h-screen items-center justify-center bg-[#F2EDE4] p-5"><div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center text-red-700 shadow-sm"><h1 className="text-2xl font-bold">No encontramos esta boleta</h1><p className="mt-3">{error}</p></div></main>;

  const { boleta, proyecto, vendedor } = data;
  const estadoClass = boleta.disponible ? "bg-green-100 text-green-800" : boleta.estado === "Pagado" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800";

  return (
    <main className="min-h-screen bg-[#F2EDE4] p-4 text-[#1A1A1A] sm:p-8">
      <article className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-lg">
        {proyecto.flyer_url ? <img src={proyecto.flyer_url} alt={proyecto.nombre} className="max-h-[420px] w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-[#1A1A1A] px-6 text-center text-3xl font-bold text-white">{proyecto.nombre}</div>}
        <div className="p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[3px] text-[#7A7066]">Boleta oficial</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black">Número {boleta.numero}</h1>
            <span className={`rounded-full px-4 py-2 text-sm font-bold ${estadoClass}`}>{boleta.estado}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-[#5E554D]">{proyecto.nombre}</h2>

          <dl className="mt-7 grid gap-4 rounded-2xl bg-[#F9F6F1] p-5 sm:grid-cols-2">
            <div><dt className="text-sm text-[#7A7066]">Titular</dt><dd className="mt-1 text-lg font-semibold">{boleta.nombre_cliente || "Sin asignar"}</dd></div>
            <div><dt className="text-sm text-[#7A7066]">Valor de la boleta</dt><dd className="mt-1 text-lg font-semibold">{dinero.format(proyecto.precio_boleta)}</dd></div>
            <div><dt className="text-sm text-[#7A7066]">Teléfono</dt><dd className="mt-1 text-lg font-semibold">{boleta.telefono_cliente || "No registrado"}</dd></div>
            <div><dt className="text-sm text-[#7A7066]">Valor abonado</dt><dd className="mt-1 text-lg font-semibold">{dinero.format(boleta.valor_pagado)}</dd></div>
            <div><dt className="text-sm text-[#7A7066]">Saldo pendiente</dt><dd className="mt-1 text-lg font-semibold">{dinero.format(boleta.saldo_pendiente)}</dd></div>
          </dl>

          {vendedor && (
            <div className="mt-6 rounded-2xl border border-[#E8620A]/30 bg-orange-50 p-5">
              <p className="font-semibold">Este número fue asignado al vendedor {vendedor.nombre}.</p>
              {vendedor.telefono && <a href={`tel:${vendedor.telefono}`} className="mt-2 inline-block text-lg font-bold text-[#E8620A]">Teléfono: {vendedor.telefono}</a>}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#8A8178]">Consulta generada directamente desde el sistema oficial del proyecto.</p>
        </div>
      </article>
    </main>
  );
}
