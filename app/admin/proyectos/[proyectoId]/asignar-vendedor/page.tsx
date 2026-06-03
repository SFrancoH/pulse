"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { use, useEffect, useRef, useState } from "react";

type ApiResponse = {
  success: boolean;
  message?: string;
  asignadas?: number;
  omitidas?: number;
  no_encontradas?: string[];
  errores?: string[];
};

type Props = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Camara = {
  deviceId: string;
  label: string;
};

function normalizarNumero(valor: string) {
  const limpio = valor.replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

export default function AsignarVendedorPage({ params }: Props) {
  const { proyectoId } = use(params);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const ultimoScanRef = useRef("");
  const ultimoScanAtRef = useRef(0);

  const [inputCodigo, setInputCodigo] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [numeros, setNumeros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [scannerMsg, setScannerMsg] = useState("");
  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [deviceIdSeleccionado, setDeviceIdSeleccionado] = useState("");

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  function agregarNumero(valor: string) {
    const numero = normalizarNumero(valor);

    if (!numero) return;

    setNumeros((actuales) => {
      if (actuales.includes(numero)) return actuales;
      return [...actuales, numero];
    });
  }

  function agregarCodigo() {
    agregarNumero(inputCodigo);
    setInputCodigo("");
  }

  function eliminarCodigo(valor: string) {
    setNumeros((actuales) => actuales.filter((item) => item !== valor));
  }

  async function pedirPermisoCamara() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });

    stream.getTracks().forEach((track) => track.stop());
  }

  async function listarCamaras() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no permite usar cámara. Usa Chrome, Safari o Edge actualizado en HTTPS.");
    }

    await pedirPermisoCamara();

    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    const normalizadas = devices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Cámara ${index + 1}`,
    }));

    setCamaras(normalizadas);

    const backCamera = normalizadas.find((device) => /back|rear|environment|trasera|posterior/i.test(device.label));
    const primera = backCamera || normalizadas[0];

    if (!primera?.deviceId) {
      throw new Error("No se encontró cámara disponible. Revisa permisos del navegador y que otra aplicación no esté usando la cámara.");
    }

    setDeviceIdSeleccionado((actual) => actual || primera.deviceId);
    return actualDeviceId(deviceIdSeleccionado, primera.deviceId);
  }

  function actualDeviceId(actual: string, fallback: string) {
    return actual || fallback;
  }

  async function iniciarScanner(deviceId: string) {
    if (!videoRef.current) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39]);

    const reader = new BrowserMultiFormatReader(hints);

    controlsRef.current?.stop();

    const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
      if (!result) return;

      const raw = result.getText();
      const numero = normalizarNumero(raw);

      if (!numero) return;

      const ahora = Date.now();
      if (ultimoScanRef.current === numero && ahora - ultimoScanAtRef.current < 1600) {
        return;
      }

      ultimoScanRef.current = numero;
      ultimoScanAtRef.current = ahora;
      agregarNumero(numero);
      setScannerMsg(`Escaneado: ${numero}`);
    });

    controlsRef.current = controls;
    setCamaraActiva(true);
    setScannerMsg("Cámara activa. Escanea los códigos de barras.");
  }

  async function activarCamara() {
    setError("");
    setScannerMsg("Activando cámara...");

    try {
      const deviceId = await listarCamaras();
      await iniciarScanner(deviceId);
    } catch (err) {
      setCamaraActiva(false);
      setScannerMsg("");
      setError(err instanceof Error ? err.message : "No se pudo activar la cámara.");
    }
  }

  async function cambiarCamara(deviceId: string) {
    setDeviceIdSeleccionado(deviceId);

    if (!camaraActiva) return;

    try {
      setScannerMsg("Cambiando cámara...");
      await iniciarScanner(deviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la cámara.");
    }
  }

  function detenerCamara() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCamaraActiva(false);
    setScannerMsg("Cámara detenida.");
  }

  async function asignar() {
    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/asignar-vendedor-lote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendedor_nombre: vendedor,
          numeros,
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudo asignar el lote.");
      }

      setResultado(data);
      setNumeros([]);
      setInputCodigo("");
      setVendedor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Asignación masiva</p>
          <h1 className="mt-2 text-4xl font-bold">Asignar boletas a vendedor</h1>
          <p className="mt-3 break-all text-sm text-white/70">Proyecto: {proyectoId}</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
              <p className="text-sm font-semibold">Escanear con cámara</p>
              <p className="mt-1 text-sm text-[#6F665C]">Compatible con celular o computador. Usa códigos Code39 / Libre Barcode 39 con solo el número de boleta.</p>

              {camaras.length > 0 && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium">Seleccionar cámara</label>
                  <select value={deviceIdSeleccionado} onChange={(e) => cambiarCamara(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none">
                    {camaras.map((camara) => (
                      <option key={camara.deviceId} value={camara.deviceId}>
                        {camara.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl bg-black">
                <video ref={videoRef} className="h-[280px] w-full object-cover" muted playsInline />
              </div>

              {scannerMsg && <p className="mt-3 text-sm font-medium text-[#6F665C]">{scannerMsg}</p>}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={activarCamara} disabled={camaraActiva} className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-50">
                  Activar cámara
                </button>
                <button type="button" onClick={detenerCamara} disabled={!camaraActiva} className="rounded-xl border border-[#1A1A1A] px-5 py-3 font-semibold disabled:opacity-50">
                  Detener cámara
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Agregar manualmente</label>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputCodigo}
                  onChange={(e) => setInputCodigo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarCodigo();
                    }
                  }}
                  placeholder="Ej: 0000"
                  className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                />

                <button type="button" onClick={agregarCodigo} className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white">
                  Agregar
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Boletas escaneadas ({numeros.length})</label>

              <div className="max-h-[320px] overflow-auto rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-3">
                {numeros.length === 0 ? (
                  <p className="text-sm text-[#9A9187]">No hay códigos escaneados.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {numeros.map((numero) => (
                      <div key={numero} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium">
                        <span>{numero}</span>
                        <button type="button" onClick={() => eliminarCodigo(numero)} className="text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Nombre del vendedor</label>
              <input type="text" value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Ej: Carlos Pérez" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" />
            </div>

            <button type="button" disabled={loading || numeros.length === 0 || !vendedor.trim()} onClick={asignar} className="w-full rounded-2xl bg-[#1A1A1A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
              {loading ? "Asignando boletas..." : `Asignar ${numeros.length} boletas`}
            </button>
          </div>

          {resultado?.success && (
            <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
              <p className="font-semibold">Asignación completada</p>
              <div className="mt-3 space-y-1">
                <p>Asignadas: {resultado.asignadas || 0}</p>
                <p>Omitidas: {resultado.omitidas || 0}</p>
              </div>
              {resultado.no_encontradas && resultado.no_encontradas.length > 0 && <div className="mt-4"><p className="font-semibold">No encontradas:</p><p className="mt-1 break-all">{resultado.no_encontradas.join(", ")}</p></div>}
              {resultado.errores && resultado.errores.length > 0 && <div className="mt-4"><p className="font-semibold">Errores:</p><p className="mt-1 break-all">{resultado.errores.join(", ")}</p></div>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
