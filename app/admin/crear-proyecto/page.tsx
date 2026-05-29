"use client";

import { useEffect, useState } from "react";

type Empresa = {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
};

type CrearProyectoResponse = {
  success: boolean;
  message?: string;
  url?: string;
  proyecto_id?: string;
  proyecto_slug?: string;
};

export default function CrearProyectoAdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("60000");
  const [ghlFormUrl, setGhlFormUrl] = useState("");
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<CrearProyectoResponse | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function cargarEmpresas() {
      try {
        const res = await fetch("/api/empresas", { cache: "no-store" });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.message || "No se pudieron cargar las empresas.");
        }

        setEmpresas(data.empresas || []);
        if (data.empresas?.[0]?.id) {
          setEmpresaId(data.empresas[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setCargandoEmpresas(false);
      }
    }

    cargarEmpresas();
  }, []);

  async function crearProyecto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreando(true);
    setError("");
    setResultado(null);
    setCopiado(false);

    try {
      const res = await fetch("/api/crear-proyecto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empresa_id: empresaId,
          nombre,
          precio_boleta: Number(precio || 60000),
          ghl_form_url: ghlFormUrl,
        }),
      });

      const data = (await res.json()) as CrearProyectoResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudo crear el proyecto.");
      }

      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreando(false);
    }
  }

  async function copiarUrl() {
    if (!resultado?.url) return;
    await navigator.clipboard.writeText(resultado.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Panel interno</p>
          <h1 className="mt-2 text-4xl font-bold">Crear proyecto</h1>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={crearProyecto} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Empresa</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                disabled={cargandoEmpresas}
                className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none"
                required
              >
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Nombre del proyecto</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Promo Abril"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Precio por boleta</label>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="60000"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">URL formulario GHL</label>
              <input
                type="url"
                value={ghlFormUrl}
                onChange={(e) => setGhlFormUrl(e.target.value)}
                placeholder="https://forms.leadconnectorhq.com/..."
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={creando || cargandoEmpresas}
              className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60"
            >
              {creando ? "Creando proyecto y boletas..." : "Crear proyecto"}
            </button>
          </form>

          {resultado?.url && (
            <div className="mt-8 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-5">
              <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">Proyecto creado</p>
              <p className="mt-3 text-sm text-[#6F665C]">ID proyecto:</p>
              <p className="break-all font-mono text-sm font-semibold">{resultado.proyecto_id}</p>

              <p className="mt-4 text-sm text-[#6F665C]">URL pública:</p>
              <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">{resultado.url}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copiarUrl}
                  className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white"
                >
                  {copiado ? "URL copiada" : "Copiar URL"}
                </button>

                <a
                  href={resultado.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[#1A1A1A] px-5 py-3 text-center font-semibold"
                >
                  Abrir proyecto
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
