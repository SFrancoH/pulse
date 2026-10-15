"use client";

import { useEffect, useState } from "react";
import type { SorteosConfig } from "@/lib/project-draws";

type CountdownValue = { days: number; hours: number; minutes: number; seconds: number };
type CountdownBlockProps = { title: string; targetDate: string | null };
type Props = {
  proyectoNombre: string;
  flyerUrl?: string | null;
  showOctoberPromo?: boolean;
  sorteos?: SorteosConfig | null;
};
const JAVIER_TOYOTAS_LOGO = "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a23040c3c3faf82cadd1459.png";
const EDSA_LOGO = "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a2303eb7eee184e871d27ce.png";
const EMPTY: CountdownValue = { days: 0, hours: 0, minutes: 0, seconds: 0 };

// Fallback solo para no romper la campaña histórica si falta instalar la migración.
const LEGACY_OCTOBER: SorteosConfig = {
  premio_mayor: "2026-10-10T00:00:00-05:00",
  anticipados: ["2026-09-12T00:00:00-05:00"],
};

function calcular(target: string): CountdownValue {
  const remaining = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return EMPTY;
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

function fechaVisible(target: string | null): string {
  if (!target) return "Fecha por anunciar";
  const fecha = new Date(target);
  if (!Number.isFinite(fecha.getTime())) return "Fecha por anunciar";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/Bogota",
  }).format(fecha);
}

function CountdownBlock({ title, targetDate }: CountdownBlockProps) {
  const [tiempo, setTiempo] = useState<CountdownValue>(EMPTY);
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const actualizar = () => { setTiempo(calcular(targetDate)); setAhora(Date.now()); };
    actualizar();
    const id = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(id);
  }, [targetDate]);

  const finalizado = Boolean(targetDate && ahora !== null && new Date(targetDate).getTime() <= ahora);
  const valores = [
    { value: tiempo.days, label: "DÍAS", accent: true },
    { value: tiempo.hours, label: "HORAS" },
    { value: tiempo.minutes, label: "MIN" },
    { value: tiempo.seconds, label: "SEG" },
  ];

  return (
    <article className="rounded-[28px] border border-[#E0D9CE] bg-white p-5 shadow-sm sm:p-7">
      <h3 className="text-center text-[clamp(25px,4vw,42px)] font-black uppercase leading-none tracking-[-0.03em] text-[#1A1A1A]">
        {title} <span className="text-[#E8620A]">{!targetDate ? "POR DEFINIR" : finalizado ? "REALIZADO" : "FALTAN:"}</span>
      </h3>
      {targetDate ? (
        <div className="mx-auto mt-6 grid max-w-[500px] grid-cols-4 gap-2 sm:gap-3">
          {valores.map(item => (
            <div key={item.label} className="min-w-0 rounded-xl border border-[#E0D9CE] bg-[#F9F6F1] px-1.5 py-3 text-center sm:px-3 sm:py-4">
              <div className={`text-[clamp(24px,5vw,34px)] font-black leading-none ${item.accent ? "text-[#E8620A]" : "text-[#1A1A1A]"}`}>{String(item.value).padStart(2, "0")}</div>
              <div className="mt-1.5 text-[9px] font-medium tracking-wide text-[#6F665C] sm:text-[11px]">{item.label}</div>
            </div>
          ))}
        </div>
      ) : <p className="mt-6 rounded-xl bg-[#F9F6F1] p-5 text-center text-[#6F665C]">Próximamente anunciaremos la fecha de este premio.</p>}
      <p className="mt-5 text-center text-[clamp(20px,3vw,30px)] font-black uppercase leading-tight tracking-[-0.03em] text-[#1A1A1A]">
        {fechaVisible(targetDate)}
      </p>
    </article>
  );
}

export default function ProyectoSalesHero({ proyectoNombre, flyerUrl, showOctoberPromo = false, sorteos }: Props) {
  const calendario = sorteos || (showOctoberPromo ? LEGACY_OCTOBER : null);
  const anticipados = calendario?.anticipados || [];
  const cantidad = calendario ? 1 + anticipados.length : null;

  return (
    <div className="bg-[#F2EDE4] text-[#1A1A1A]">
      {showOctoberPromo && (
        <header className="px-4 pb-4 pt-6 sm:pt-8">
          <div className="mx-auto flex max-w-[1100px] justify-center">
            <img src={JAVIER_TOYOTAS_LOGO} alt="Javier Toyotas" className="h-auto max-h-[88px] w-auto max-w-[260px] object-contain sm:max-w-[330px]" />
          </div>
        </header>
      )}

      {flyerUrl && (
        <section className="mx-auto max-w-[1100px] px-3 sm:px-5">
          <div className="overflow-hidden rounded-[22px] border border-[#E0D9CE] bg-white shadow-sm sm:rounded-[30px]">
            <img src={flyerUrl} alt={`Flyer de ${proyectoNombre}`} className="max-h-[680px] w-full object-contain" />
          </div>
        </section>
      )}

      {/* Siempre visible, debajo del flyer y antes de la lista de consecutivos. */}
      <section className="mx-auto max-w-[1100px] px-3 pb-8 pt-9 sm:px-5 sm:pb-10 sm:pt-12">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#E8620A] sm:text-base">Una sola boleta</p>
          <h2 className="mt-3 text-[clamp(38px,7vw,72px)] font-black leading-[0.92] tracking-[-0.05em] text-[#1A1A1A]">
            {cantidad ? <>Participa en <span className="text-[#E8620A]">{cantidad} {cantidad === 1 ? "sorteo" : "sorteos"}</span></> : "Próximos sorteos"}
          </h2>
          <p className="mt-4 text-lg font-semibold text-[#6F665C] sm:text-2xl">{cantidad && cantidad > 1 ? "Con la misma boleta" : "Con tu boleta"}</p>
        </div>
        <div className={`grid gap-5 ${anticipados.length ? "lg:grid-cols-2" : "mx-auto max-w-[600px]"}`}>
          <CountdownBlock title="Premio mayor" targetDate={calendario?.premio_mayor || null} />
          {anticipados.map((fecha, index) => (
            <CountdownBlock key={`${fecha}-${index}`} title={`Anticipado ${index + 1}`} targetDate={fecha} />
          ))}
        </div>
        {showOctoberPromo && (
          <div className="mt-7 rounded-[24px] border border-[#E0D9CE] bg-white px-5 py-6 text-center shadow-sm sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8A8178] sm:text-sm">Avalados por</p>
            <img src={EDSA_LOGO} alt="EDSA" className="mx-auto mt-4 h-auto max-h-[90px] w-auto max-w-[230px] object-contain sm:max-w-[300px]" />
          </div>
        )}
      </section>
    </div>
  );
}
