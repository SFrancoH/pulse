"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Datos fijos para esta primera prueba.
 * Luego esto debe venir por dominio, empresa o ruta dinámica.
 */
const EMPRESA_ID = "z6D7TmXDOdu2At3H4Tqy";
const PROYECTO_ID = "JavierToyotas04_01_2025_31_05_2025";

/**
 * URL temporal del formulario GHL.
 * Cambia esta URL cuando tengas el formulario real.
 */
const GHL_FORM_URL = "https://TU-FORMULARIO-GHL.com";
const MAX_SELECCION = 10;

type BoletaDisponible = {
  numero: string;
};

export default function Home() {
  const [numeros, setNumeros] = useState<BoletaDisponible[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  /**
   * Carga los números disponibles desde el backend de Next.js.
   *
   * Esta página NO consulta Supabase directamente.
   * Consulta /api/boletas-disponibles y ese endpoint consulta Supabase.
   */
  useEffect(() => {
    async function cargarNumeros() {
      try {
        const url = `/api/boletas-disponibles?empresa_id=${EMPRESA_ID}&proyecto_id=${PROYECTO_ID}`;
        const respuesta = await fetch(url);
        const resultado = await respuesta.json();

        if (!resultado.success) {
          throw new Error(resultado.message || "No se pudieron cargar los números");
        }

        setNumeros(resultado.numeros || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
      } finally {
        setCargando(false);
      }
    }

    cargarNumeros();
  }, []);

  /**
   * Agrega o quita un número de la selección.
   */
  function toggleNumero(numero: string) {
    setSeleccionados((actuales) => {
      if (actuales.includes(numero)) {
        return actuales.filter((n) => n !== numero);
      }

      if (actuales.length >= MAX_SELECCION) {
        alert(`Solo puedes seleccionar máximo ${MAX_SELECCION} números.`);
        return actuales;
      }

      return [...actuales, numero];
    });
  }

  function limpiarSeleccion() {
    setSeleccionados([]);
  }

  /**
   * Filtro visual para encontrar números rápido.
   */
  const numerosFiltrados = useMemo(() => {
    const texto = busqueda.trim();

    if (!texto) return numeros;

    return numeros.filter((item) => item.numero.includes(texto.padStart(4, "0")));
  }, [busqueda, numeros]);

  /**
   * Construye la URL hacia el formulario GHL.
   *
   * Los campos deben existir como campos ocultos en GHL:
   * numero_1, numero_2, numero_3... numero_10.
   */
  const urlFormulario = useMemo(() => {
    const params = new URLSearchParams();

    seleccionados.forEach((numero, index) => {
      params.set(`numero_${index + 1}`, numero);
    });

    params.set("empresa_id", EMPRESA_ID);
    params.set("proyecto_id", PROYECTO_ID);

    return `${GHL_FORM_URL}?${params.toString()}`;
  }, [seleccionados]);

  return (
    <main className="min-h-screen bg-[#0f1115] px-4 py-6 text-white md:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl md:p-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-orange-400">
            Pulse Rifas
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-6xl">
            Selecciona tus números
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
            Elige hasta {MAX_SELECCION} números disponibles. Al continuar, te llevaremos al formulario para registrar tus datos.
          </p>
        </header>

        <section className="sticky top-3 z-20 mb-6 rounded-2xl border border-orange-500/30 bg-[#171a21]/95 p-4 shadow-xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-black text-black">
                  {seleccionados.length}/{MAX_SELECCION}
                </span>
                <p className="font-semibold">Números seleccionados</p>
              </div>

              <p className="mt-2 min-h-6 text-sm text-orange-200">
                {seleccionados.length > 0 ? seleccionados.join(", ") : "Aún no has seleccionado números."}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Limpiar
              </button>

              <a
                href={seleccionados.length > 0 ? urlFormulario : "#"}
                onClick={(e) => {
                  if (seleccionados.length === 0) {
                    e.preventDefault();
                    alert("Selecciona al menos un número.");
                  }
                }}
                className="rounded-xl bg-orange-500 px-6 py-3 text-center text-sm font-black text-black transition hover:bg-orange-400"
              >
                Continuar al formulario
              </a>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Estado de conexión</p>
            <p className="mt-1 text-2xl font-black">
              {cargando ? "Cargando" : error ? "Error" : "Conectado"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-zinc-400">Disponibles cargados</p>
            <p className="mt-1 text-2xl font-black">{numeros.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <label className="text-sm text-zinc-400" htmlFor="busqueda">
              Buscar número
            </label>
            <input
              id="busqueda"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Ej: 0001"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-orange-400"
            />
          </div>
        </section>

        {cargando && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-300">
            Cargando números disponibles desde Supabase...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/50 p-8 text-center text-red-100">
            <p className="text-xl font-bold">No se pudieron cargar los números</p>
            <p className="mt-2 text-sm">{error}</p>
            <p className="mt-4 text-xs text-red-200/80">
              Revisa las variables de entorno en Vercel y que el proyecto exista en Supabase.
            </p>
          </div>
        )}

        {!cargando && !error && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-zinc-400">
                Mostrando {numerosFiltrados.length} números disponibles
              </p>
              <p className="text-xs text-zinc-500">
                Toca un número para seleccionarlo o quitarlo.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15">
              {numerosFiltrados.map((item) => {
                const activo = seleccionados.includes(item.numero);

                return (
                  <button
                    key={item.numero}
                    type="button"
                    onClick={() => toggleNumero(item.numero)}
                    className={[
                      "rounded-xl border px-2 py-3 text-sm font-black transition",
                      activo
                        ? "scale-105 border-orange-300 bg-orange-500 text-black shadow-lg shadow-orange-500/20"
                        : "border-white/10 bg-[#1b1f29] text-white hover:border-orange-400 hover:bg-[#252b38]",
                    ].join(" ")}
                  >
                    {item.numero}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
