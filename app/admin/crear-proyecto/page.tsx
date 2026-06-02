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
  webhook_url?: string;
  proyecto_id?: string;
  proyecto_slug?: string;
};

type CodigoEstado = "pendiente" | "generando" | "listo" | "error";

export default function CrearProyectoAdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("60000");
  const [formularioCompraUrl, setFormularioCompraUrl] = useState("");
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<CrearProyectoResponse | null>(null);
  const [copiado, setCopiado] = useState("");
  const [qrEstado, setQrEstado] = useState<CodigoEstado>("pendiente");
  const [barcodeEstado, setBarcodeEstado] = useState<CodigoEstado>("pendiente");
  const [codigoError, setCodigoError] = useState("");

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
    setCopiado("");
    setQrEstado("pendiente");
    setBarcodeEstado("pendiente");
    setCodigoError("");

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
          formulario_compra_url: formularioCompraUrl,
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

  async function copiar(valor: string | undefined, tipo: string) {
    if (!valor) return;
    await navigator.clipboard.writeText(valor);
    setCopiado(tipo);
    setTimeout(() => setCopiado(""), 2500);
  }

  function descargarArchivo(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function generarQR() {
    if (!resultado?.proyecto_id) return;

    setQrEstado("generando");
    setCodigoError("");

    try {
      descargarArchivo(`/api/proyectos/${resultado.proyecto_id}/generar-qr?desde=0&hasta=999`);
      setQrEstado("listo");
    } catch (err) {
      setQrEstado("error");
      setCodigoError(err instanceof Error ? err.message : "No se pudo generar el ZIP de QR.");
    }
  }

  async function generarBarcodes() {
    if (!resultado?.proyecto_id) return;

    setBarcodeEstado("generando");
    setCodigoError("");

    try {
      descargarArchivo(`/api/proyectos/${resultado.proyecto_id}/generar-barcodes?desde=0&hasta=999`);
      setBarcodeEstado("listo");
    } catch (err) {
      setBarcodeEstado("error");
      setCodigoError(err instanceof Error ? err.message : "No se pudo generar el ZIP de códigos de barras.");
    }
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
              <label className="mb-2 block text-sm font-medium">Formulario de compra</label>
              <input
                type="url"
                value={formularioCompraUrl}
                onChange={(e) => setFormularioCompraUrl(e.target.value)}
                placeholder="https://forms.example.com/..."
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

              <p className="mt-4 text-sm text-[#6F665C]">URL pública de venta:</p>
              <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">{resultado.url}</p>

              <p className="mt-4 text-sm text-[#6F665C]">URL pública webhook para actualizar boletas:</p>
              <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">{resultado.webhook_url}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => copiar(resultado.url, "landing")}
                  className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white"
                >
                  {copiado === "landing" ? "Copiada" : "Copiar landing"}
                </button>

                <button
                  type="button"
                  onClick={() => copiar(resultado.webhook_url, "webhook")}
                  className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white"
                >
                  {copiado === "webhook" ? "Copiado" : "Copiar webhook"}
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

              <div className="mt-6 rounded-2xl border border-[#E0D9CE] bg-white p-4">
                <p className="text-sm font-semibold">Generación de archivos físicos</p>
                <p className="mt-1 text-sm text-[#6F665C]">
                  Primero descarga los QR. Cuando termines, descarga los códigos de barras. Cada ZIP genera el rango 0000 a 0999 para evitar sobrecargar el servidor.
                </p>

                {codigoError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {codigoError}
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={generarQR}
                    disabled={qrEstado === "generando"}
                    className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {qrEstado === "generando" ? "Generando QR..." : qrEstado === "listo" ? "QR generado" : "Generar QR"}
                  </button>

                  <button
                    type="button"
                    onClick={generarBarcodes}
                    disabled={qrEstado !== "listo" || barcodeEstado === "generando"}
                    className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-40"
                  >
                    {barcodeEstado === "generando"
                      ? "Generando códigos..."
                      : barcodeEstado === "listo"
                        ? "Códigos generados"
                        : "Generar códigos de barras"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
