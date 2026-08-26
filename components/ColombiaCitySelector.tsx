"use client";

import { useMemo, useState } from "react";
import { MUNICIPIOS_COLOMBIA } from "@/data/municipios-colombia";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function normalizarBusqueda(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export default function ColombiaCitySelector({ value, onChange, disabled = false }: Props) {
  const [query, setQuery] = useState(value);
  const [abierto, setAbierto] = useState(false);
  const [manual, setManual] = useState(false);

  const resultados = useMemo(() => {
    const q = normalizarBusqueda(query);
    if (!q) return MUNICIPIOS_COLOMBIA.slice(0, 8);

    const starts: string[] = [];
    const includes: string[] = [];

    for (const municipio of MUNICIPIOS_COLOMBIA) {
      const normalizado = normalizarBusqueda(municipio);
      if (normalizado.startsWith(q)) starts.push(municipio);
      else if (normalizado.includes(q)) includes.push(municipio);
      if (starts.length + includes.length >= 12) break;
    }

    return [...starts, ...includes].slice(0, 8);
  }, [query]);

  function seleccionar(municipio: string) {
    setManual(false);
    setQuery(municipio);
    onChange(municipio);
    setAbierto(false);
  }

  function activarManual() {
    setManual(true);
    onChange("");
    setQuery("");
    setAbierto(false);
  }

  if (manual) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Ciudad</span>
          <button
            type="button"
            onClick={() => {
              setManual(false);
              setQuery("");
              onChange("");
            }}
            className="text-xs font-semibold text-[#E8620A]"
          >
            Buscar en la lista
          </button>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          className="mt-2 w-full rounded-xl border border-[#D8CFC3] px-4 py-3 text-base outline-none focus:border-[#E8620A] disabled:opacity-50"
          placeholder="Escribe tu ciudad o municipio"
        />
        <p className="mt-2 text-xs leading-5 text-[#6F665C]">
          Escribe el nombre completo de tu ciudad o municipio.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-semibold" htmlFor="pulse-city-search">Ciudad</label>
      <input
        id="pulse-city-search"
        value={query}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange("");
          setAbierto(true);
        }}
        onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
        disabled={disabled}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-[#D8CFC3] px-4 py-3 text-base outline-none focus:border-[#E8620A] disabled:opacity-50"
        placeholder="Selecciona tu ciudad"
      />

      <p className="mt-2 text-xs leading-5 text-[#6F665C]">
        Escribe el nombre de tu ciudad o municipio y selecciónalo de la lista. Si no lo encuentras, elige “No encuentro mi ciudad” para escribirlo manualmente.
      </p>

      {abierto && (
        <div className="absolute z-[30] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D8CFC3] bg-white p-2 shadow-xl">
          {resultados.length > 0 ? (
            <>
              {resultados.map((municipio) => (
                <button
                  key={municipio}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => seleccionar(municipio)}
                  className="block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-[#F7F4EF]"
                >
                  {municipio}
                </button>
              ))}
              <div className="my-2 border-t border-[#E0D9CE]" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={activarManual}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-[#E8620A] hover:bg-orange-50"
              >
                No encuentro mi ciudad
              </button>
            </>
          ) : (
            <div className="p-2">
              <p className="px-2 py-2 text-sm text-[#6F665C]">No encontramos “{query.trim()}”.</p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={activarManual}
                className="mt-1 block w-full rounded-lg bg-[#F7F4EF] px-3 py-3 text-left text-sm font-bold text-[#E8620A]"
              >
                Escribir mi ciudad manualmente
              </button>
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="city" value={value} required />
    </div>
  );
}
