"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Datos temporales de prueba.
 * Luego esto debe venir desde el dominio o desde una ruta dinámica.
 */
const EMPRESA_ID = "z6D7TmXDOdu2At3H4Tqy";
const PROYECTO_ID = "JavierToyotas04_01_2025_31_05_2025";

/**
 * Precio por número.
 * En la siguiente fase esto debe venir desde la tabla projects.ticket_price.
 */
const PRECIO_CUPO = 60000;
const MAX_SELECCION = 10;

/**
 * Formulario GHL original.
 */
const GHL_FORM_BASE_URL =
  "https://api.leadconnectorhq.com/widget/form/dd0mSFWY0XyoGd68bE2y";

type BoletaDisponible = {
  numero: string;
};

function formatearCOP(valor: number) {
  return "$" + valor.toLocaleString("es-CO");
}

export default function Home() {
  const [numeros, setNumeros] = useState<BoletaDisponible[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState("");

  /**
   * Cargar disponibles desde Supabase por medio del backend de Next.
   */
  async function cargarNumeros() {
    try {
      const url = `/api/boletas-disponibles?empresa_id=${EMPRESA_ID}&proyecto_id=${PROYECTO_ID}`;
      const respuesta = await fetch(url, { cache: "no-store" });
      const resultado = await respuesta.json();

      if (!resultado.success) {
        throw new Error(resultado.message || "Error al cargar los números.");
      }

      setNumeros(resultado.numeros || []);
      setError("");

      /**
       * Si un número seleccionado dejó de estar disponible,
       * se quita automáticamente de la selección.
       */
      const disponibles = new Set((resultado.numeros || []).map((item: BoletaDisponible) => item.numero));
      setSeleccionados((actuales) => actuales.filter((numero) => disponibles.has(numero)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarNumeros();

    /**
     * Equivalente al setInterval del Apps Script:
     * refresca disponibles cada 5 segundos.
     */
    const intervalo = setInterval(cargarNumeros, 5000);

    return () => clearInterval(intervalo);
  }, []);

  function mostrarToast(mensaje: string) {
    setToast(mensaje);
    setTimeout(() => setToast(""), 4500);
  }

  function toggleNumero(numero: string) {
    setSeleccionados((actuales) => {
      if (actuales.includes(numero)) {
        return actuales.filter((n) => n !== numero);
      }

      if (actuales.length >= MAX_SELECCION) {
        mostrarToast(`Solo puedes seleccionar máximo ${MAX_SELECCION} números.`);
        return actuales;
      }

      return [...actuales, numero];
    });
  }

  const numerosFiltrados = useMemo(() => {
    const q = busqueda.trim();

    if (!q) return numeros;

    return numeros.filter((item) => item.numero.includes(q));
  }, [busqueda, numeros]);

  const valorPagar = seleccionados.length * PRECIO_CUPO;

  const ghlUrl = useMemo(() => {
    const params = new URLSearchParams();

    /**
     * Mantengo los nombres originales del HTML:
     * consecutivos y valor_a_pagar.
     */
    params.set("consecutivos", seleccionados.join(","));
    params.set("valor_a_pagar", String(valorPagar));

    /**
     * También envío los campos separados para que GHL pueda mapearlos
     * a campos ocultos numero_1 ... numero_10.
     */
    seleccionados.forEach((numero, index) => {
      params.set(`numero_${index + 1}`, numero);
    });

    params.set("empresa_id", EMPRESA_ID);
    params.set("proyecto_id", PROYECTO_ID);

    return `${GHL_FORM_BASE_URL}?${params.toString()}`;
  }, [seleccionados, valorPagar]);

  function abrirFormularioGHL() {
    if (seleccionados.length === 0) {
      mostrarToast("Selecciona al menos un número.");
      return;
    }

    setModalAbierto(true);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F2EDE4] pb-32 text-[#1A1A1A]">
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-[#E0D9CE] bg-white px-5 py-3 max-[932px]:flex-col max-[932px]:px-3">
        <div className="rounded-md bg-[#E8620A] px-6 py-2 font-['Oswald'] text-[22px] font-semibold text-white max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-3 max-[932px]:text-center max-[932px]:text-[28px]">
          {formatearCOP(PRECIO_CUPO)}
        </div>

        <button
          type="button"
          onClick={() => setBuscarAbierto((actual) => !actual)}
          className="rounded-md bg-[#1A1A1A] px-5 py-2.5 font-['Oswald'] text-sm text-white max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg"
        >
          BUSCAR NÚMERO
        </button>
      </div>

      {buscarAbierto && (
        <div className="border-b border-[#E0D9CE] bg-white px-5 py-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Escribe el número... ej: 0042"
            className="mx-auto block w-full max-w-md rounded-lg border border-[#E0D9CE] bg-[#F2EDE4] px-4 py-3 text-[15px] outline-none focus:border-[#E8620A] max-[932px]:max-w-none max-[932px]:rounded-xl max-[932px]:py-4 max-[932px]:text-lg"
          />
        </div>
      )}

      <section className="mx-auto flex max-w-[1100px] justify-between px-5 pb-3 pt-5 max-[932px]:flex-col max-[932px]:gap-1 max-[932px]:px-3">
        <h1 className="font-['Oswald'] text-[22px] font-bold max-[932px]:text-[28px]">
          NÚMEROS DISPONIBLES
        </h1>
        <p className="font-['Oswald'] text-xs text-[#9A9187] max-[932px]:text-sm">
          HAZ CLIC PARA SEPARAR
        </p>
      </section>

      <section className="mx-auto flex max-w-[1100px] flex-wrap gap-2 px-5 pb-4 max-[932px]:flex-col max-[932px]:px-3">
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:px-4 max-[932px]:py-3 max-[932px]:text-lg">
          Disponibles: <b className="text-[#1A1A1A]">{numeros.length}</b>
        </div>
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:px-4 max-[932px]:py-3 max-[932px]:text-lg">
          Seleccionados: <b className="text-[#1A1A1A]">{seleccionados.length}</b>
        </div>
        <div className="rounded-full border border-[#E0D9CE] bg-white px-4 py-1 text-sm text-[#9A9187] max-[932px]:w-full max-[932px]:rounded-xl max-[932px]:px-4 max-[932px]:py-3 max-[932px]:text-lg">
          Total a pagar: <b className="text-[#1A1A1A]">{formatearCOP(valorPagar)}</b>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 max-[932px]:px-3">
        {cargando && (
          <div className="py-16 text-center text-[#9A9187]">
            Cargando números disponibles...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center text-[#CC3333]">
            Error al cargar los números: {error}
          </div>
        )}

        {!cargando && !error && numerosFiltrados.length === 0 && (
          <div className="py-10 text-center text-[#9A9187]">
            No se encontró ese número o no está disponible.
          </div>
        )}

        {!cargando && !error && numerosFiltrados.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 max-[932px]:grid-cols-2 max-[932px]:gap-3">
            {numerosFiltrados.map((item) => {
              const seleccionado = seleccionados.includes(item.numero);

              return (
                <button
                  key={item.numero}
                  type="button"
                  onClick={() => toggleNumero(item.numero)}
                  className={[
                    "select-none rounded-[10px] border bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-[#E8620A] max-[932px]:rounded-[18px] max-[932px]:px-2 max-[932px]:py-6",
                    seleccionado
                      ? "border-[#E8620A] bg-[#E8620A]"
                      : "border-[#E0D9CE]",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "font-['Oswald'] text-[26px] font-semibold max-[932px]:text-[42px]",
                      seleccionado ? "text-white" : "text-[#1A1A1A]",
                    ].join(" ")}
                  >
                    {item.numero}
                  </div>
                  <div
                    className={[
                      "mt-1 font-['Oswald'] text-[10px] tracking-[2px] max-[932px]:mt-2 max-[932px]:text-[13px]",
                      seleccionado ? "text-white/80" : "text-[#9A9187]",
                    ].join(" ")}
                  >
                    {seleccionado ? "SELECCIONADO" : "LIBRE"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={abrirFormularioGHL}
        className={[
          "fixed bottom-5 right-5 z-[99] rounded-[28px] bg-[#E8620A] px-6 py-3 font-['Oswald'] text-base text-white shadow-[0_10px_25px_rgba(232,98,10,0.35)] transition max-[932px]:left-3 max-[932px]:right-3 max-[932px]:bottom-[calc(18px+env(safe-area-inset-bottom))] max-[932px]:rounded-[22px] max-[932px]:py-5 max-[932px]:text-[26px]",
          seleccionados.length > 0
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-5 opacity-0",
        ].join(" ")}
      >
        🎟 SEPARAR {seleccionados.length}
      </button>

      {modalAbierto && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 max-[932px]:items-end max-[932px]:p-0">
          <div className="relative h-[90vh] max-h-[620px] w-full max-w-[520px] overflow-hidden rounded-xl bg-white max-[932px]:h-[94dvh] max-[932px]:max-h-[94dvh] max-[932px]:max-w-none max-[932px]:rounded-t-3xl max-[932px]:rounded-b-none">
            <div className="flex h-[52px] items-center justify-between bg-[#1A1A1A] px-4 font-['Oswald'] text-lg text-white max-[932px]:h-16 max-[932px]:px-5 max-[932px]:text-[22px]">
              <span>Confirmar separado</span>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-3xl leading-none text-white max-[932px]:text-[34px]"
              >
                ×
              </button>
            </div>

            <div className="h-[calc(100%-52px)] max-[932px]:h-[calc(94dvh-64px)]">
              <iframe
                src={ghlUrl}
                className="h-full w-full border-0"
                title="Formulario GHL"
              />
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
