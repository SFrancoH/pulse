"use client";

import { useEffect, useMemo, useState } from "react";

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
  proyectoId?: string;
};

type BoletasResponse = {
  success: boolean;
  message?: string;
  mode?: "page" | "search";
  page?: number;
  boletas?: Boleta[];
};

function formatearCOP(valor: number) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function fmtNumero(value: number) {
  return String(value).padStart(4, "0");
}

function normalizarNumero(value: string) {
  const limpio = value.replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function enviarAlturaIframe() {
  if (typeof window === "undefined") return;

  const height = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );

  window.parent?.postMessage(
    {
      type: "PULSE_IFRAME_HEIGHT",
      height: height + 40,
    },
    "*"
  );
}

export default function ProyectoVentaClient({
  empresaNombre,
  proyectoNombre,
  precioBoleta,
  formularioCompraUrl,
  boletas: iniciales,
  proyectoId,
}: ProyectoVentaClientProps) {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [toast, setToast] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [boletas, setBoletas] = useState<Boleta[]>(iniciales);
  const [cargandoPagina, setCargandoPagina] = useState(false);
  const [modoBusqueda, setModoBusqueda] = useState(false);

  useEffect(() => {
    setBoletas(iniciales);
  }, [iniciales]);

  useEffect(() => {
    enviarAlturaIframe();

    const timeout = window.setTimeout(enviarAlturaIframe, 250);
    const interval = window.setInterval(enviarAlturaIframe, 800);
    window.addEventListener("resize", enviarAlturaIframe);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("resize", enviarAlturaIframe);
    };
  }, [boletas, seleccionados, modalAbierto, toast, cargandoPagina, modoBusqueda]);

  function mostrarToast(mensaje: string) {
    setToast(mensaje);
    setTimeout(() => setToast(""), 3500);
  }

  async function consultarBoletas(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as BoletasResponse;

    if (!data.success) {
      throw new Error(data.message || "No se pudieron cargar las boletas.");
    }

    return data;
  }

  async function cargarPagina(page: number) {
    if (!proyectoId) {
      mostrarToast("No se encontró el ID del proyecto.");
      return;
    }

    try {
      setCargandoPagina(true);
      setBusqueda("");
      setModoBusqueda(false);

      const data = await consultarBoletas(`/api/proyectos/${proyectoId}/boletas-disponibles?page=${page}`);

      setPagina(data.page ?? page);
      setBoletas(data.boletas || []);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(enviarAlturaIframe, 250);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error cargando números.");
    } finally {
      setCargandoPagina(false);
    }
  }

  async function buscarNumero() {
    if (!proyectoId) {
      mostrarToast("No se encontró el ID del proyecto.");
      return;
    }

    const numero = normalizarNumero(busqueda);

    if (!numero) {
      cargarPagina(pagina);
      return;
    }

    try {
      setCargandoPagina(true);

      const data = await consultarBoletas(`/api/proyectos/${proyectoId}/boletas-disponibles?numero=${numero}`);

      setBoletas(data.boletas || []);
      setPagina(data.page ?? Math.floor(Number(numero) / 1000));
      setModoBusqueda(true);
      window.setTimeout(enviarAlturaIframe, 250);

      if (!data.boletas || data.boletas.length === 0) {
        mostrarToast(`El número ${numero} no está disponible.`);
      }
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error buscando número.");
    } finally {
      setCargandoPagina(false);
    }
  }

  function limpiarBusqueda() {
    setBusqueda("");
    cargarPagina(pagina);
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

  const boletasFiltradas = useMemo(() => boletas, [boletas]);
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

  const rangoInicio = pagina * 1000;
  const rangoFin = rangoInicio + 999;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F2EDE4] pb-32 text-[#1A1A1A]">
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-[#E0D9CE] bg-white px-5 py-3 max-[932px]:flex-col max-[932px]:px-3">
        <div className="rounded-md bg-[#E8620A] px-6 py-2 text-[22px] font-semibold text-white max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-center max-[932px]:text-[28px]">
          {formatearCOP(precioBoleta)}
        </div>

        <div className="flex w-full max-w-xl gap-2 max-[932px]:max-w-none max-[932px]:flex-col">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscarNumero();
              }
            }}
            placeholder="Buscar número... Ej: 5555"
            className="w-full rounded-md border border-[#E0D9CE] bg-[#F2EDE4] px-4 py-2.5 outline-none focus:border-[#E8620A] max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg"
          />
          <button type="button" onClick={buscarNumero} disabled={cargandoPagina} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-50">
            Buscar
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-[1100px] px-5 pb-3 pt-6 max-[932px]:px-3">
        <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">{empresaNombre}</p>
        <h1 className="mt-2 text-[32px] font-bold max-[932px]:text-[34px]">{proyectoNombre}</h1>
        <p className="mt-2 text-sm text-[#9A9187]">
          {modoBusqueda ? "Resultado de búsqueda" : `Números ${fmtNumero(rangoInicio)} al ${fmtNumero(rangoFin)}`}
        </p>
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-wrap gap-2 px-5 pb-5 max-[932px]:flex-col max-[932px]:px-3">
        <button type="button" disabled={pagina === 0 || cargandoPagina} onClick={() => cargarPagina(pagina - 1)} className="rounded-2xl border border-[#1A1A1A] bg-white px-5 py-4 text-lg font-semibold disabled:opacity-40">
          Ver números anteriores
        </button>

        <button type="button" disabled={pagina === 9 || cargandoPagina} onClick={() => cargarPagina(pagina + 1)} className="rounded-2xl bg-[#E8620A] px-5 py-4 text-lg font-semibold text-white disabled:opacity-40">
          {cargandoPagina ? "Cargando..." : "Ver más números"}
        </button>

        {modoBusqueda && (
          <button type="button" disabled={cargandoPagina} onClick={limpiarBusqueda} className="rounded-2xl border border-[#E8620A] bg-white px-5 py-4 text-lg font-semibold text-[#E8620A] disabled:opacity-40">
            Volver a lista de números
          </button>
        )}
      </section>

      <section className="mx-auto max-w-[1100px] px-4 max-[932px]:px-3">
        {boletasFiltradas.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 max-[932px]:grid-cols-2 max-[932px]:gap-3">
            {boletasFiltradas.map((boleta) => {
              const seleccionado = seleccionados.includes(boleta.numero);

              return (
                <button key={boleta.id} type="button" onClick={() => toggleNumero(boleta.numero)} className={["select-none rounded-[10px] border bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#E8620A] max-[932px]:rounded-[18px] max-[932px]:py-6", seleccionado ? "border-[#E8620A] bg-[#E8620A]" : "border-[#E0D9CE]"].join(" ")}>
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

      <button type="button" onClick={reservar} className={["fixed bottom-5 right-5 z-[99] rounded-[28px] bg-[#E8620A] px-6 py-3 text-base font-semibold text-white shadow-[0_10px_25px_rgba(232,98,10,0.35)] transition max-[932px]:left-3 max-[932px]:right-3 max-[932px]:bottom-[calc(18px+env(safe-area-inset-bottom))] max-[932px]:rounded-[22px] max-[932px]:py-5 max-[932px]:text-[26px]", seleccionados.length > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"].join(" ")}>
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
