"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Configuración temporal.
 *
 * Luego esto debe venir dinámicamente según el dominio.
 */
const EMPRESA_ID = "z6D7TmXDOdu2At3H4Tqy";
const PROYECTO_ID = "JavierToyotas04_01_2025_31_05_2025";

/**
 * URL del formulario GHL.
 * Reemplazar por la URL real.
 */
const GHL_FORM_URL = "https://TU-FORMULARIO-GHL.com";

type BoletaDisponible = {
  numero: string;
};

export default function Home() {
  const [numeros, setNumeros] = useState<BoletaDisponible[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /**
   * Cargar boletas disponibles.
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
   * Seleccionar / deseleccionar número.
   * Máximo 10.
   */
  function toggleNumero(numero: string) {
    setSeleccionados((actuales) => {
      const yaSeleccionado = actuales.includes(numero);

      if (yaSeleccionado) {
        return actuales.filter((n) => n !== numero);
      }

      if (actuales.length >= 10) {
        alert("Solo puedes seleccionar máximo 10 números.");
        return actuales;
      }

      return [...actuales, numero];
    });
  }

  /**
   * Construye URL del formulario GHL.
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
    <main className="min-h-screen bg-[#111111] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-orange-400">
            Sistema de rifas
          </p>

          <h1 className="text-3xl font-bold md:text-5xl">
            Selecciona tus números
          </h1>

          <p className="mt-4 text-zinc-300">
            Puedes seleccionar máximo 10 números por envío.
          </p>
        </div>

        <div className="sticky top-0 z-10 mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-400">Seleccionados</p>

              <p className="text-xl font-semibold">
                {seleccionados.length}/10
              </p>

              <p className="mt-1 text-sm text-orange-300 break-all">
                {seleccionados.length > 0
                  ? seleccionados.join(", ")
                  : "Aún no has seleccionado números"}
              </p>
            </div>

            <a
              href={seleccionados.length > 0 ? urlFormulario : "#"}
              onClick={(e) => {
                if (seleccionados.length === 0) {
                  e.preventDefault();
                  alert("Selecciona al menos un número.");
                }
              }}
              className="rounded-xl bg-orange-500 px-6 py-3 text-center font-bold text-black transition hover:bg-orange-400"
            >
              Continuar al formulario
            </a>
          </div>
        </div>

        {cargando && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            Cargando números disponibles...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950 p-6 text-center text-red-200">
            {error}
          </div>
        )}

        {!cargando && !error && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12">
            {numeros.map((item) => {
              const activo = seleccionados.includes(item.numero);

              return (
                <button
                  key={item.numero}
                  onClick={() => toggleNumero(item.numero)}
                  className={[
                    "rounded-lg border px-2 py-3 text-sm font-semibold transition",
                    activo
                      ? "border-orange-400 bg-orange-500 text-black"
                      : "border-zinc-800 bg-zinc-900 text-white hover:border-orange-400",
                  ].join(" ")}
                >
                  {item.numero}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
