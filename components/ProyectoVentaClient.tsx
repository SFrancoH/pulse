"use client";

import { useMemo, useState } from "react";

const MAX_SELECCION = 10;

type Boleta = {
  id: string;
  numero: string;
};

type ProyectoVentaClientProps = {
  empresaNombre: string;
  proyectoNombre: string;
  precioBoleta: number;
  formularioCompraUrl: string | null;
  boletas: Boleta[];
};

function formatearCOP(valor: number) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

export default function ProyectoVentaClient({
  empresaNombre,
  proyectoNombre,
  precioBoleta,
  formularioCompraUrl,
  boletas,
}: ProyectoVentaClientProps) {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [toast, setToast] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  function mostrarToast(mensaje: string) {
    setToast(mensaje);
    setTimeout(() => setToast(""), 3500);
  }

  function toggleNumero(numero: string) {
    setSeleccionados((actuales) => {
      if (actuales.includes(numero)) {
        return actuales.filter((item) => item !== numero);
      }

      if (actuales.length >= MAX_SELECCION) {
        mostrarToast(`Solo puedes seleccionar máximo ${MAX_SELECCION} números.`);
        return actuales;
      }

      return [...actuales, numero];
    });
  }

  const boletasFiltradas = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return boletas;
    return boletas.filter((boleta) => boleta.numero.includes(q));
  }, [boletas, busqueda]);

  const totalPagar = seleccionados.length * precioBoleta;

  const formularioUrl = useMemo(() => {
    if (!formularioCompraUrl) return "";

    const params = new URLSearchParams();

    seleccionados.forEach((numero, index) => {
      params.set(`consecutivo_${index + 1}`, numero);
    });

    for (let index = seleccionados.length; index < MAX_SELECCION; index++) {
      params.set(`consecutivo_${index + 1}`, "");
    }

    params.set("nombre_proyecto", proyectoNombre);
    params.set("valor_a_pagar", String(totalPagar));

    const separador = formularioCompraUrl.includes("?") ? "&" : "?";
    return `${formularioCompraUrl}${separador}${params.toString()}`;
  }, [formularioCompraUrl, proyectoNombre, seleccionados, totalPagar]);

  function reservar() {
    if (seleccionados.length === 0) {
      mostrarToast("Selecciona al menos un número.");
      return;
    }

    if (!formularioCompraUrl) {
      mostrarToast("Este proyecto no tiene formulario de compra configurado.");
      return;
    }

    setModalAbierto(true);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F2EDE4] pb-32 text-[#1A1A1A]">
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-[#E0D9CE] bg-white px-5 py-3 max-[932px]:flex-col max-[932px]:px-3">
        <div className="rounded-md bg-[#E8620A] px-6 py-2 text-[22px] font-semibold text-white max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-center max-[932px]:text-[28px]">
          {formatearCOP(precioBoleta)}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Buscar número..."
          className="w-full max-w-xs rounded-md border border-[#E0D9CE] bg-[#F2EDE4] px-4 py-2.5 outline-none focus:border-[#E8620A] max-[932px]:max-w-none max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg"
        />
      </div>

      <section className="mx-auto max-w-[1100px] px-5 pb-3 pt-6 max-[932px]:px-3">
        <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">{empresaNombre}</p>
        <h1 className="mt-2 text-[32px] font-bold max-[932px]:text-[34px]">{proyectoNombre}</h1>
        <p className="mt-2 text-sm text-[#9A9187]">Selecciona hasta {MAX_SELECCION} números disponibles.</p>
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-wrap gap-2 px-5 pb-4 max-[932px]:flex-col max-[932px]:px-3">
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-lg">
          Disponibles: <b className="text-[#1A1A1A]">{boletas.length}</b>
        </div>
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-lg">
          Seleccionados: <b className="text-[#1A1A1A]">{seleccionados.length}</b>
        </div>
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-lg">
          Total: <b className="text-[#1A1A1A]">{formatearCOP(totalPagar)}</b>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 max-[932px]:px-3">
        {boletasFiltradas.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 max-[932px]:grid-cols-2 max-[932px]:gap-3">
            {boletasFiltradas.map((boleta) => {
              const seleccionado = seleccionados.includes(boleta.numero);

              return (
                <button
                  key={boleta.id}
                  type="button"
                  onClick={() => toggleNumero(boleta.numero)}
                  className={[
                    "select-none rounded-[10px] border bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#E8620A] max-[932px]:rounded-[18px] max-[932px]:py-6",
                    seleccionado ? "border-[#E8620A] bg-[#E8620A]" : "border-[#E0D9CE]",
                  ].join(" ")}
                >
                  <div className={["text-[26px] font-semibold max-[932px]:text-[42px]", seleccionado ? "text-white" : "text-[#1A1A1A]"].join(" ")}>{boleta.numero}</div>
                  <div className={["mt-1 text-[10px] tracking-[2px] max-[932px]:mt-2 max-[932px]:text-[13px]", seleccionado ? "text-white/80" : "text-[#9A9187]"].join(" ")}>{seleccionado ? "SELECCIONADO" : "LIBRE"}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E0D9CE] bg-white p-10 text-center text-[#9A9187]">
            No se encontró ese número o no está disponible.
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={reservar}
        className={[
          "fixed bottom-5 right-5 z-[99] rounded-[28px] bg-[#E8620A] px-6 py-3 text-base font-semibold text-white shadow-[0_10px_25px_rgba(232,98,10,0.35)] transition max-[932px]:left-3 max-[932px]:right-3 max-[932px]:bottom-[calc(18px+env(safe-area-inset-bottom))] max-[932px]:rounded-[22px] max-[932px]:py-5 max-[932px]:text-[26px]",
          seleccionados.length > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0",
        ].join(" ")}
      >
        Reservar {seleccionados.length}
      </button>

      {modalAbierto && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 max-[932px]:items-end max-[932px]:p-0">
          <div className="relative h-[90vh] max-h-[620px] w-full max-w-[520px] overflow-hidden rounded-xl bg-white max-[932px]:h-[94dvh] max-[932px]:max-h-[94dvh] max-[932px]:max-w-none max-[932px]:rounded-t-3xl max-[932px]:rounded-b-none">
            <div className="flex h-[52px] items-center justify-between bg-[#1A1A1A] px-4 text-lg font-semibold text-white max-[932px]:h-16 max-[932px]:px-5 max-[932px]:text-[22px]">
              <span>Confirmar reserva</span>
              <button type="button" onClick={() => setModalAbierto(false)} className="text-3xl leading-none text-white max-[932px]:text-[34px]">×</button>
            </div>
            <div className="h-[calc(100%-52px)] max-[932px]:h-[calc(100%-64px)]">
              <iframe src={formularioUrl} className="h-full w-full border-0" title="Formulario de compra" />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-4 z-[999] max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-[#CC3333] px-6 py-3 text-center text-sm text-white">
          {toast}
        </div>
      )}
    </main>
  );
}
