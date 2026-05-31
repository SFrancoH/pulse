"use client";

import { useState } from "react";

type EmpresaResponse = {
  success: boolean;
  message?: string;
  empresa?: {
    id: string;
    nombre: string;
    slug: string;
    apps_script_url?: string;
  };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

export default function CrearEmpresaPage() {
  const [id, setId] = useState("");
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [appsScriptUrl, setAppsScriptUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<EmpresaResponse | null>(null);
  const [copiado, setCopiado] = useState(false);

  function handleNombre(value: string) {
    setNombre(value);

    if (!slug || slug === slugify(nombre)) {
      setSlug(slugify(value));
    }
  }

  async function crearEmpresa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const res = await fetch("/api/crear-empresa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          nombre,
          slug,
          apps_script_url: appsScriptUrl,
        }),
      });

      const data = (await res.json()) as EmpresaResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudo crear la empresa.");
      }

      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Panel interno</p>
          <h1 className="mt-2 text-4xl font-bold">Crear empresa</h1>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={crearEmpresa} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">ID empresa</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Ej: z6D7TmXDOdu2At3H4Tqy"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Nombre empresa</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => handleNombre(e.target.value)}
                placeholder="Ej: JavierToyotas"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="javier-toyotas"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">URL Apps Script</label>
              <input
                type="url"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Creando empresa..." : "Crear empresa"}
            </button>
          </form>

          {resultado?.empresa && (
            <div className="mt-8 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-5">
              <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">Empresa creada</p>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-[#6F665C]">ID empresa</p>
                  <p className="font-mono font-semibold break-all">{resultado.empresa.id}</p>
                </div>

                <div>
                  <p className="text-[#6F665C]">Slug</p>
                  <p className="font-mono font-semibold break-all">{resultado.empresa.slug}</p>
                </div>

                <div>
                  <p className="text-[#6F665C]">Apps Script</p>
                  <p className="font-mono font-semibold break-all">{resultado.empresa.apps_script_url}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copiar(resultado.empresa.id)}
                className="mt-5 rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white"
              >
                {copiado ? "ID copiado" : "Copiar ID empresa"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
