"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PendingGroup = {
  reserva_grupo: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  email_cliente: string | null;
  ciudad_cliente: string | null;
  canal: string | null;
  numeros: string[];
  detectado_at: string;
  error_explicito: boolean;
};

type QueueResponse = {
  success: boolean;
  message?: string;
  cantidad?: number;
  grupos?: PendingGroup[];
};

type Props = {
  proyectoId: string;
  proyectoNombre: string;
};

const RECOVERY_FORM_URL = "https://conector.soysebastianfranco.com/widget/form/sWvX4OJBvd9XAZkewUtB";
const POLL_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVOS = 10;

export default function OpportunityErrorRecovery({ proyectoId, proyectoNombre }: Props) {
  const [grupos, setGrupos] = useState<PendingGroup[]>([]);
  const [grupoAbierto, setGrupoAbierto] = useState<PendingGroup | null>(null);
  const consultandoRef = useRef(false);

  const consultar = useCallback(async () => {
    if (consultandoRef.current) return;
    consultandoRef.current = true;

    try {
      const res = await fetch(
        `/api/admin/proyectos/${encodeURIComponent(proyectoId)}/oportunidades-pendientes`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as QueueResponse;
      if (!res.ok || !data.success) return;
      setGrupos(data.grupos || []);
    } catch {
      // La siguiente consulta vuelve a intentar sin interrumpir la venta.
    } finally {
      consultandoRef.current = false;
    }
  }, [proyectoId]);

  useEffect(() => {
    void consultar();
    const timer = window.setInterval(() => void consultar(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [consultar]);

  const formularioUrl = useMemo(() => {
    if (!grupoAbierto) return "";

    const params = new URLSearchParams();
    params.set("nombre_proyecto", proyectoNombre);
    params.set("first_name", grupoAbierto.nombre_cliente || "");
    params.set("phone", grupoAbierto.telefono_cliente || "");
    params.set("city", grupoAbierto.ciudad_cliente || "");
    params.set("email", grupoAbierto.email_cliente || "");

    for (let index = 0; index < MAX_CONSECUTIVOS; index += 1) {
      params.set(`consecutivo_${index + 1}`, grupoAbierto.numeros[index] || "");
    }

    return `${RECOVERY_FORM_URL}?${params.toString()}`;
  }, [grupoAbierto, proyectoNombre]);

  function abrirSiguiente() {
    if (!grupos.length) return;
    setGrupoAbierto(grupos[0]);
  }

  function cerrarYActualizar() {
    setGrupoAbierto(null);
    window.setTimeout(() => void consultar(), 1200);
    window.setTimeout(() => void consultar(), 5000);
  }

  if (grupos.length === 0 && !grupoAbierto) return null;

  const cantidad = grupos.length;
  const etiqueta = cantidad === 1 ? "Corregir 1 Error" : `Corregir ${cantidad} Errores`;

  return (
    <>
      {!grupoAbierto && cantidad > 0 && (
        <button
          type="button"
          onClick={abrirSiguiente}
          className="fixed right-4 top-14 z-[1200] rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-red-700 sm:text-base"
        >
          ⚠ {etiqueta}
        </button>
      )}

      {grupoAbierto && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/80 p-3 sm:p-5">
          <div className="flex h-[94vh] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#E5DED5] px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[2px] text-red-700">Corrección de oportunidades</p>
                <h2 className="mt-1 text-xl font-bold text-[#1A1A1A] sm:text-2xl">
                  {grupoAbierto.nombre_cliente || "Reserva pendiente"}
                </h2>
                <p className="mt-1 text-sm text-[#6F665C]">
                  Números pendientes: {grupoAbierto.numeros.join(" · ")}
                </p>
                <p className="mt-1 text-xs text-[#8A8178]">
                  Revisa los datos y envía el formulario para completar la corrección.
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarYActualizar}
                className="rounded-full border border-[#D8CFC3] px-4 py-2 text-sm font-bold text-[#1A1A1A]"
                aria-label="Cerrar formulario de corrección"
              >
                Cerrar
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-[#F5F2ED]">
              <iframe
                src={formularioUrl}
                className="h-full w-full border-0"
                title="FORMULARIO BOLETAS - CORRECCION DE ERRORES"
              />
            </div>

            <div className="border-t border-[#E5DED5] bg-white px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={cerrarYActualizar}
                className="w-full rounded-2xl bg-[#1A1A1A] px-5 py-3 font-bold text-white"
              >
                Ya envié la corrección · Cerrar y actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
