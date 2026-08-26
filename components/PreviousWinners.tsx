"use client";

import { useEffect, useState } from "react";
import type { PreviousWinner } from "@/lib/previous-winners";

type Props = {
  winners: PreviousWinner[];
};

function formatearFecha(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return fecha;

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function NumeroGanador({ numero }: { numero: string }) {
  return (
    <div className="mt-3 flex gap-2">
      {numero.split("").map((digito, index) => (
        <div
          key={`${numero}-${index}`}
          className="flex h-[54px] w-[48px] items-center justify-center rounded-xl border border-[#E0D9CE] bg-[#F9F6F1] text-[27px] font-black text-[#E8620A]"
        >
          {digito}
        </div>
      ))}
    </div>
  );
}

export default function PreviousWinners({ winners }: Props) {
  const [winnerActivo, setWinnerActivo] = useState<PreviousWinner | null>(null);

  useEffect(() => {
    if (!winnerActivo) return;

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWinnerActivo(null);
    };

    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = bodyOverflow;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [winnerActivo]);

  if (!winners.length) return null;

  return (
    <>
      <section className="bg-[#F2EDE4] px-4 pb-40 pt-10 text-[#1A1A1A] max-[932px]:px-3">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-7 text-center">
            <p className="text-sm font-semibold uppercase tracking-[4px] text-[#E8620A]">Resultados reales</p>
            <h2 className="mt-2 text-[40px] font-black uppercase leading-none max-[700px]:text-[31px]">
              Ganadores anteriores
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6F665C]">
              Conoce algunos de los números ganadores de nuestros sorteos anteriores y mira los videos de entrega.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
            {winners.map((winner, index) => (
              <article
                key={`${winner.numero}-${winner.fecha}`}
                className={[
                  "overflow-hidden rounded-[24px] border border-[#E0D9CE] bg-white text-[#1A1A1A] shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
                  index === winners.length - 1 && winners.length % 2 === 1
                    ? "col-span-2 mx-auto w-full max-w-[538px] max-[760px]:col-span-1"
                    : "",
                ].join(" ")}
              >
                <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                  <button
                    type="button"
                    onClick={() => setWinnerActivo(winner)}
                    className="group relative mx-auto block aspect-[9/16] w-full max-w-[310px] overflow-hidden rounded-[22px] border border-[#E0D9CE] bg-[linear-gradient(160deg,#1A1A1A,#343434)] text-white shadow-sm"
                    aria-label={`Ver video de entrega del número ganador ${winner.numero}`}
                  >
                    {winner.poster_url && (
                      <img
                        src={winner.poster_url}
                        alt={`Ganador del número ${winner.numero}`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/25" />

                    <div className="absolute left-3 top-3 z-[1] rounded-full bg-black/60 px-3 py-2 text-[11px] font-bold tracking-wide backdrop-blur-sm">
                      <span className="mr-2 text-[#73F49A]">✓</span>
                      Premio entregado
                    </div>

                    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-5 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[32px] text-[#E8620A] shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition group-hover:scale-105">
                        ▶
                      </div>
                      <p className="mt-5 text-sm font-bold uppercase tracking-[2px]">Ver video de entrega</p>
                      <p className="mt-2 text-xs text-white/80">El video se carga solo al abrirlo</p>
                    </div>
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[2px] text-[#8A8178]">Número ganador</p>
                  <NumeroGanador numero={winner.numero} />

                  <div className="mt-5 border-l-2 border-[#E8620A] pl-4">
                    <p className="text-xs font-semibold uppercase tracking-[2px] text-[#8A8178]">Sorteo</p>
                    <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{formatearFecha(winner.fecha)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {winnerActivo && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setWinnerActivo(null);
          }}
          role="presentation"
        >
          <div className="relative w-full max-w-[430px] overflow-hidden rounded-[24px] bg-black shadow-2xl">
            <button
              type="button"
              onClick={() => setWinnerActivo(null)}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl leading-none text-white backdrop-blur-sm"
              aria-label="Cerrar video"
            >
              ×
            </button>

            <video
              key={winnerActivo.video_url}
              src={winnerActivo.video_url}
              poster={winnerActivo.poster_url || undefined}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="max-h-[88vh] w-full bg-black object-contain"
            />

            <div className="bg-white px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-[#8A8178]">Número ganador</p>
              <p className="mt-1 text-2xl font-black text-[#E8620A]">{winnerActivo.numero}</p>
              <p className="mt-1 text-sm font-semibold text-[#1A1A1A]">{formatearFecha(winnerActivo.fecha)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
