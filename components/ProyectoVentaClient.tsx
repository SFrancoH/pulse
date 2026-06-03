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

function formatearCOP(valor: number) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function fmtNumero(value: number) {
  return String(value).padStart(4, "0");
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

  useEffect(() => {
    setBoletas(iniciales);
  }, [iniciales]);

  async function cargarPagina(page: number) {
    if (!proyectoId) return;

    try {
      setCargandoPagina(true);

      const res = await fetch(`/api/proyectos/${proyectoId}/boletas-disponibles?page=${page}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "No se pudieron cargar las boletas.");
      }

      setPagina(page);
      setBoletas(data.boletas || []);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error cargando números.");
    } finally {
      setCargandoPagina(false);
    }
  }

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

  const rangoInicio = pagina * 1000;
  const rangoFin = rangoInicio + 999;

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
        <p className="mt-2 text-sm text-[#9A9187]">Números {fmtNumero(rangoInicio)} al {fmtNumero(rangoFin)}</p>
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-wrap gap-2 px-5 pb-5 max-[932px]:flex-col max-[932px]:px-3">
        <button
          type="button"
          disabled={pagina === 0 || cargandoPagina}
          onClick={() => cargarPagina(pagina - 1)}
          className="rounded-2xl border border-[#1A1A1A] bg-white px-5 py-4 text-lg font-semibold disabled:opacity-40"
        >
          Ver números anteriores
        </button>

        <button
          type="button"
          disabled={pagina === 9 || cargandoPagina}
          onClick={() => cargarPagina(pagina + 1)}
          className="rounded-2xl bg-[#E8620A] px-5 py-4 text-lg font-semibold text-white disabled:opacity-40"
        >
          {cargandoPagina ? "Cargando..." : "Ver más números"}
        </button>
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
    </main>
  );
}
