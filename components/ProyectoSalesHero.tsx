"use client";

import { useEffect, useState } from "react";

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type CountdownBlockProps = {
  title: string;
  targetDate: string;
  dateLabel: string;
};

type ProyectoSalesHeroProps = {
  proyectoNombre: string;
  flyerUrl?: string | null;
  showOctoberPromo?: boolean;
};

const JAVIER_TOYOTAS_LOGO =
  "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a23040c3c3faf82cadd1459.png";

const EMPTY_COUNTDOWN: CountdownValue = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

function calcularCuentaRegresiva(targetDate: string): CountdownValue {
  const distancia = new Date(targetDate).getTime() - Date.now();

  if (distancia <= 0) return EMPTY_COUNTDOWN;

  return {
    days: Math.floor(distancia / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distancia % (1000 * 60)) / 1000),
  };
}

function CountdownBlock({ title, targetDate, dateLabel }: CountdownBlockProps) {
  const [tiempo, setTiempo] = useState<CountdownValue>(EMPTY_COUNTDOWN);

  useEffect(() => {
    const actualizar = () => setTiempo(calcularCuentaRegresiva(targetDate));

    actualizar();
    const timer = window.setInterval(actualizar, 1000);

    return () => window.clearInterval(timer);
  }, [targetDate]);

  const valores = [
    { value: tiempo.days, label: "DÍAS", accent: true },
    { value: tiempo.hours, label: "HORAS", accent: false },
    { value: tiempo.minutes, label: "MIN", accent: false },
    { value: tiempo.seconds, label: "SEG", accent: false },
  ];

  return (
    <article className="rounded-[28px] border border-[#E0D9CE] bg-white p-5 shadow-sm sm:p-7">
      <h3 className="text-center text-[clamp(25px,4vw,42px)] font-black uppercase leading-none tracking-[-0.03em] text-[#1A1A1A]">
        {title} <span className="text-[#E8620A]">FALTAN:</span>
      </h3>

      <div className="mx-auto mt-6 grid max-w-[500px] grid-cols-4 gap-2 sm:gap-3">
        {valores.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-xl border border-[#E0D9CE] bg-[#F9F6F1] px-1.5 py-3 text-center sm:px-3 sm:py-4"
          >
            <div
              className={`text-[clamp(24px,5vw,34px)] font-black leading-none ${
                item.accent ? "text-[#E8620A]" : "text-[#1A1A1A]"
              }`}
            >
              {String(item.value).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-[9px] font-medium tracking-wide text-[#6F665C] sm:text-[11px]">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[clamp(20px,3vw,30px)] font-black uppercase leading-tight tracking-[-0.03em] text-[#1A1A1A]">
        {dateLabel}
      </p>
    </article>
  );
}

export default function ProyectoSalesHero({
  proyectoNombre,
  flyerUrl,
  showOctoberPromo = false,
}: ProyectoSalesHeroProps) {
  if (!flyerUrl && !showOctoberPromo) return null;

  return (
    <div className="bg-[#F2EDE4] text-[#1A1A1A]">
      {showOctoberPromo && (
        <header className="px-4 pb-4 pt-6 sm:pt-8">
          <div className="mx-auto flex max-w-[1100px] justify-center">
            <img
              src={JAVIER_TOYOTAS_LOGO}
              alt="Javier Toyotas"
              className="h-auto max-h-[88px] w-auto max-w-[260px] object-contain sm:max-w-[330px]"
            />
          </div>
        </header>
      )}

      {flyerUrl && (
        <section className="mx-auto max-w-[1100px] px-3 sm:px-5">
          <div className="overflow-hidden rounded-[22px] border border-[#E0D9CE] bg-white shadow-sm sm:rounded-[30px]">
            <img
              src={flyerUrl}
              alt={`Flyer de ${proyectoNombre}`}
              className="max-h-[680px] w-full object-contain"
            />
          </div>
        </section>
      )}

      {showOctoberPromo && (
        <section className="mx-auto max-w-[1100px] px-3 pb-8 pt-9 sm:px-5 sm:pb-10 sm:pt-12">
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#E8620A] sm:text-base">
              Una sola boleta
            </p>
            <h2 className="mt-3 text-[clamp(38px,7vw,72px)] font-black leading-[0.92] tracking-[-0.05em] text-[#1A1A1A]">
              Participa en <span className="text-[#E8620A]">2 sorteos</span>
            </h2>
            <p className="mt-4 text-lg font-semibold text-[#6F665C] sm:text-2xl">
              Con la misma boleta
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CountdownBlock
              title="Premio mayor"
              targetDate="2026-10-10T00:00:00-05:00"
              dateLabel="10 de octubre del 2026"
            />
            <CountdownBlock
              title="Anticipado"
              targetDate="2026-09-12T00:00:00-05:00"
              dateLabel="12 de septiembre del 2026"
            />
          </div>
        </section>
      )}
    </div>
  );
}
