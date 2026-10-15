"use client";

import type { SorteosInput } from "@/lib/project-draws";

type Props = {
  value: SorteosInput;
  onChange: (value: SorteosInput) => void;
  disabled?: boolean;
};

export default function SorteosFields({ value, onChange, disabled = false }: Props) {
  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
      <legend className="px-2 font-bold">Fechas de sorteos</legend>
      <p className="text-sm text-[#6F665C]">Selecciona fecha y hora de Colombia (UTC-05:00). El premio mayor es obligatorio. Puedes agregar tantos anticipados como necesites.</p>
      <div>
        <label htmlFor="fecha-premio-mayor" className="mb-2 block text-sm font-semibold">Premio mayor — fecha y hora *</label>
        <input id="fecha-premio-mayor" required type="datetime-local" value={value.premio_mayor}
          onChange={e => onChange({ ...value, premio_mayor: e.target.value })}
          className="w-full rounded-xl border border-[#E0D9CE] bg-white p-3" />
      </div>
      <div className="space-y-3">
        {value.anticipados.map((fecha, index) => (
          <div key={index} className="rounded-xl border border-[#E0D9CE] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={`fecha-anticipado-${index}`} className="font-semibold">Anticipado {index + 1} — fecha y hora *</label>
              <button type="button" className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700"
                onClick={() => onChange({ ...value, anticipados: value.anticipados.filter((_, i) => i !== index) })}>
                Eliminar
              </button>
            </div>
            <input id={`fecha-anticipado-${index}`} required type="datetime-local" value={fecha}
              onChange={e => onChange({ ...value, anticipados: value.anticipados.map((v, i) => i === index ? e.target.value : v) })}
              className="w-full rounded-xl border border-[#E0D9CE] p-3" />
          </div>
        ))}
      </div>
      <button type="button" disabled={value.anticipados.length >= 100}
        onClick={() => onChange({ ...value, anticipados: [...value.anticipados, ""] })}
        className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-3 font-semibold disabled:opacity-40">
        + Agregar anticipado
      </button>
    </fieldset>
  );
}
