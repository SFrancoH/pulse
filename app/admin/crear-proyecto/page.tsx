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
  actualizar_boleta_url?: string;
  reservar_boleta_url?: string;
  oportunidades_ghl_url?: string;
  asignar_vendedor_url?: string;
  proyecto_id?: string;
  proyecto_slug?: string;
};

type CodigoEstado = "pendiente" | "generando" | "listo" | "error";

const RANGOS = Array.from({ length: 10 }, (_, index) => ({
  desde: index * 1000,
  hasta: index * 1000 + 999,
}));

function fmtNumero(value: number) {
  return String(value).padStart(4, "0");
}

export default function CrearProyectoAdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("60000");
  const [formularioCompraUrl, setFormularioCompraUrl] = useState("");
  const [flyerUrl, setFlyerUrl] = useState("");
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

        if (!data.success) throw new Error(data.message || "No se pudieron cargar las empresas.");

        setEmpresas(data.empresas || []);
        if (data.empresas?.[0]?.id) setEmpresaId(data.empresas[0].id);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          nombre,
          precio_boleta: Number(precio || 60000),
          formulario_compra_url: formularioCompraUrl,
          flyer_url: flyerUrl,
        }),
      });

      const data = (await res.json()) as CrearProyectoResponse;
      if (!data.success) throw new Error(data.message || "No se pudo crear el proyecto.");
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

  function descargarLote(tipo: "qr" | "barcodes", desde: number, hasta: number) {
    if (!resultado?.proyecto_id) return;
    const endpoint = tipo === "qr" ? "generar-qr" : "generar-barcodes";
    descargarArchivo(`/api/proyectos/${resultado.proyecto_id}/${endpoint}?desde=${desde}&hasta=${hasta}`);
  }

  function iniciarQR() {
    if (!resultado?.proyecto_id) return;
    setQrEstado("listo");
    descargarLote("qr", 0, 999);
  }

  function iniciarBarcodes() {
    if (!resultado?.proyecto_id) return;
    setBarcodeEstado("listo");
    descargarLote("barcodes", 0, 999);
  }

  const configuracionGhl = resultado
    ? [
        { label: "Proyecto_id", value: resultado.proyecto_id, key: "proyecto" },
        { label: "Reservar Boleta", value: resultado.reservar_boleta_url, key: "reservar" },
        { label: "oportunidades-ghl", value: resultado.oportunidades_ghl_url, key: "oportunidades" },
        { label: "actualizar boleta", value: resultado.actualizar_boleta_url || resultado.webhook_url, key: "actualizar" },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Panel interno</p>
          <h1 className="mt-2 text-4xl font-bold">Crear proyecto</h1>
        </div>

        <div className="p-6">
          {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={crearProyecto} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} disabled={cargandoEmpresas} className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none" required>
                {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Nombre del proyecto</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Promo Abril" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Precio por boleta</label>
              <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="60000" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Formulario de compra</label>
              <input type="url" value={formularioCompraUrl} onChange={(e) => setFormularioCompraUrl(e.target.value)} placeholder="https://forms.example.com/..." className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">URL imagen / flyer</label>
              <input type="url" value={flyerUrl} onChange={(e) => setFlyerUrl(e.target.value)} placeholder="https://ejemplo.com/flyer.jpg" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" />
            </div>

            <button type="submit" disabled={creando || cargandoEmpresas} className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
              {creando ? "Creando proyecto y boletas..." : "Crear proyecto"}
            </button>
          </form>

          {resultado?.url && (
            <div className="mt-8 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-5">
              <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">Proyecto creado</p>

              <div className="mt-4 rounded-2xl border border-[#E0D9CE] bg-white p-4">
                <p className="text-sm font-semibold">Variables de integración</p>
                <p className="mt-1 text-sm text-[#6F665C]">Agrega estas variables al CRM by Sebastian Franco para conectar las automatizaciones con el nuevo proyecto.</p>

                <div className="mt-4 space-y-4">
                  {configuracionGhl.map((item) => (
                    <div key={item.key}>
                      <p className="text-sm font-medium text-[#6F665C]">{item.label}</p>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <p className="min-w-0 flex-1 break-all rounded-xl bg-[#F9F6F1] p-3 font-mono text-sm">{item.value}</p>
                        <button type="button" onClick={() => copiar(item.value, item.key)} className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-semibold text-white">
                          {copiado === item.key ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-[#6F665C]">URL pública de venta:</p>
                  <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">{resultado.url}</p>
                </div>
                <div>
                  <p className="text-sm text-[#6F665C]">URL asignar vendedor:</p>
                  <p className="break-all rounded-xl bg-white p-3 font-mono text-sm">{resultado.asignar_vendedor_url}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => copiar(resultado.url, "landing")} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white">{copiado === "landing" ? "Landing copiada" : "Copiar landing"}</button>
                <button type="button" onClick={() => copiar(resultado.asignar_vendedor_url, "vendedor")} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white">{copiado === "vendedor" ? "URL copiada" : "Copiar asignar vendedor"}</button>
                <a href={resultado.asignar_vendedor_url} target="_blank" rel="noreferrer" className="rounded-xl border border-[#1A1A1A] px-5 py-3 text-center font-semibold">Abrir asignación</a>
              </div>

              <div className="mt-6 rounded-2xl border border-[#E0D9CE] bg-white p-4">
                <p className="text-sm font-semibold">Generación de archivos físicos</p>
                <p className="mt-1 text-sm text-[#6F665C]">Descarga los 10 lotes de QR y luego los 10 lotes de códigos de barras.</p>

                {codigoError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{codigoError}</div>}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={iniciarQR} className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white">Generar QR inicial</button>
                  <button type="button" onClick={iniciarBarcodes} disabled={qrEstado !== "listo"} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-40">Generar códigos iniciales</button>
                </div>

                {qrEstado === "listo" && (
                  <div className="mt-6 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
                    <p className="text-sm font-semibold">Descargar todos los QR</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {RANGOS.map((rango) => <button key={`qr-${rango.desde}`} type="button" onClick={() => descargarLote("qr", rango.desde, rango.hasta)} className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-3 text-sm font-semibold">QR {fmtNumero(rango.desde)}-{fmtNumero(rango.hasta)}</button>)}
                    </div>
                  </div>
                )}

                {barcodeEstado === "listo" && (
                  <div className="mt-6 rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
                    <p className="text-sm font-semibold">Descargar todos los códigos de barras</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {RANGOS.map((rango) => <button key={`bar-${rango.desde}`} type="button" onClick={() => descargarLote("barcodes", rango.desde, rango.hasta)} className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-3 text-sm font-semibold">Barras {fmtNumero(rango.desde)}-{fmtNumero(rango.hasta)}</button>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
