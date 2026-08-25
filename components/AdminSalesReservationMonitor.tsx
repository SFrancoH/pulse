"use client";

import { useEffect, useRef, useState } from "react";

type Reserva = {
  numero: string;
  estado: string | null;
  nombre_cliente: string | null;
  vendedor_nombre: string | null;
  canal: string | null;
  updated_at: string;
};

type MonitorResponse = {
  success: boolean;
  message?: string;
  reservas?: Reserva[];
};

type Props = {
  proyectoId: string;
  baseline: string;
};

const POLL_MS = 3000;

export default function AdminSalesReservationMonitor({ proyectoId, baseline }: Props) {
  const cursorRef = useRef(baseline);
  const consultandoRef = useRef(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);

  useEffect(() => {
    let activo = true;

    async function consultar() {
      if (!activo || consultandoRef.current) return;
      consultandoRef.current = true;

      try {
        const res = await fetch(
          `/api/admin/proyectos/${encodeURIComponent(proyectoId)}/reservas-nuevas?since=${encodeURIComponent(cursorRef.current)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as MonitorResponse;

        if (!activo || !res.ok || !data.success) return;

        const nuevas = (data.reservas || []).filter((item) => item.updated_at);
        if (nuevas.length === 0) return;

        cursorRef.current = nuevas[nuevas.length - 1].updated_at;
        setReservas((actuales) => {
          const existentes = new Set(actuales.map((item) => `${item.numero}-${item.updated_at}`));
          return [
            ...actuales,
            ...nuevas.filter((item) => !existentes.has(`${item.numero}-${item.updated_at}`)),
          ];
        });
      } catch {
        // El siguiente ciclo vuelve a intentar sin interrumpir la venta.
      } finally {
        consultandoRef.current = false;
      }
    }

    const timer = window.setInterval(consultar, POLL_MS);
    consultar();

    return () => {
      activo = false;
      window.clearInterval(timer);
    };
  }, [proyectoId]);

  if (reservas.length === 0) return null;

  const numeros = reservas.map((item) => item.numero);
  const ultima = reservas[reservas.length - 1];
  const origen = ultima.canal === "Creacion Manual" ? "Creacion Manual" : ultima.vendedor_nombre || ultima.canal;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-[560px] rounded-3xl bg-white p-6 text-[#1A1A1A] shadow-2xl sm:p-8">
        <div className="mb-5 inline-flex rounded-full bg-red-100 px-4 py-2 text-sm font-bold uppercase tracking-[2px] text-red-700">
          Nueva reserva detectada
        </div>

        <h2 className="text-3xl font-bold">Debes actualizar antes de continuar</h2>
        <p className="mt-3 text-base leading-7 text-[#6F665C]">
          {reservas.length === 1
            ? `La boleta ${ultima.numero} acaba de ser reservada y ya no debe aparecer como disponible.`
            : `Se detectaron ${reservas.length} reservas nuevas y la lista actual puede estar desactualizada.`}
        </p>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[2px] text-red-700">
            {reservas.length === 1 ? "Boleta reservada" : "Boletas reservadas"}
          </p>
          <p className="mt-2 break-words text-2xl font-bold text-red-800">{numeros.join(" · ")}</p>

          {reservas.length === 1 && (
            <div className="mt-4 space-y-1 text-sm text-red-900">
              {ultima.nombre_cliente && <p>Cliente: {ultima.nombre_cliente}</p>}
              {origen && <p>Origen: {origen}</p>}
            </div>
          )}
        </div>

        <p className="mt-5 text-sm leading-6 text-[#6F665C]">
          La página queda bloqueada para evitar que el equipo continúe trabajando con números antiguos.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-bold text-white"
        >
          Actualizar números y continuar
        </button>
      </div>
    </div>
  );
}
