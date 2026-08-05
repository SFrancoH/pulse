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
  sales_url?: string | null;
};

type CsvResumen = {
  filasLeidas: number;
  vendedores: number;
  asignadas: number;
  omitidas: number;
  noEncontradas: string[];
  errores: string[];
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

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsvAsignaciones(texto: string) {
  const grupos = new Map<string, string[]>();
  let filasLeidas = 0;
  const errores: string[] = [];

  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  lineas.forEach((linea, index) => {
    const columnas = parseCsvLine(linea);
    const numeroRaw = columnas[0] || "";
    const vendedorRaw = columnas[1] || "";

    const esHeader =
      index === 0 &&
      /numero|número|boleta/i.test(numeroRaw) &&
      /vendedor|asesor/i.test(vendedorRaw);
    if (esHeader) return;

    filasLeidas++;

    const numero = normalizarNumero(numeroRaw);
    const vendedor = vendedorRaw.trim();

    if (!numero || !vendedor) {
      errores.push(`Fila ${index + 1}: falta número o vendedor.`);
      return;
    }

    const actuales = grupos.get(vendedor) || [];
    if (!actuales.includes(numero)) {
      actuales.push(numero);
    }
    grupos.set(vendedor, actuales);
  });

  return { grupos, filasLeidas, errores };
}

export default function AsignarVendedorPage({ params }: Props) {
  const { proyectoId } = use(params);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pistolaInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const ultimoScanRef = useRef("");
  const ultimoScanAtRef = useRef(0);

  const [inputCodigo, setInputCodigo] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [numeros, setNumeros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [resultado, setResultado] = useState<ApiResponse | null>(null);
  const [csvResumen, setCsvResumen] = useState<CsvResumen | null>(null);
  const [error, setError] = useState("");
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [scannerMsg, setScannerMsg] = useState("");
  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [deviceIdSeleccionado, setDeviceIdSeleccionado] = useState("");
  const [modoPistola, setModoPistola] = useState(false);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (modoPistola) {
      setTimeout(() => pistolaInputRef.current?.focus(), 100);
    }
  }, [modoPistola, numeros.length]);

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
    if (modoPistola) setTimeout(() => pistolaInputRef.current?.focus(), 50);
  }

  function manejarPistola(valor: string) {
    const numero = normalizarNumero(valor);
    if (!numero) return;
    agregarNumero(numero);
    setInputCodigo("");
    setScannerMsg(`Pistola: ${numero}`);
    setTimeout(() => pistolaInputRef.current?.focus(), 50);
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
    return deviceIdSeleccionado || primera.deviceId;
  }

  async function iniciarScanner(deviceId: string) {
    if (!videoRef.current) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128]);

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
      setScannerMsg(`Cámara: ${numero}`);
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

  async function asignarLote(vendedorNombre: string, numerosLote: string[]) {
    const res = await fetch(`/api/proyectos/${proyectoId}/asignar-vendedor-lote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vendedor_nombre: vendedorNombre,
        numeros: numerosLote,
      }),
    });

    const data = (await res.json()) as ApiResponse;

    if (!data.success) {
      throw new Error(data.message || `No se pudo asignar el lote de ${vendedorNombre}.`);
    }

    return data;
  }

  async function asignar() {
    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const data = await asignarLote(vendedor, numeros);

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

  async function procesarCsv(file: File) {
    setCsvLoading(true);
    setError("");
    setResultado(null);
    setCsvResumen(null);

    try {
      const texto = await file.text();
      const { grupos, filasLeidas, errores } = parseCsvAsignaciones(texto);

      if (grupos.size === 0) {
        throw new Error("El CSV no contiene asignaciones válidas. Usa columna A para número y columna B para vendedor.");
      }

      let asignadas = 0;
      let omitidas = 0;
      const noEncontradas: string[] = [];
      const erroresProceso = [...errores];

      for (const [nombreVendedor, numerosVendedor] of grupos.entries()) {
        try {
          const data = await asignarLote(nombreVendedor, numerosVendedor);
          asignadas += data.asignadas || 0;
          omitidas += data.omitidas || 0;
          if (data.no_encontradas?.length) noEncontradas.push(...data.no_encontradas);
          if (data.errores?.length) erroresProceso.push(...data.errores);
        } catch (err) {
          erroresProceso.push(`${nombreVendedor}: ${err instanceof Error ? err.message : "Error desconocido"}`);
        }
      }

      setCsvResumen({
        filasLeidas,
        vendedores: grupos.size,
        asignadas,
        omitidas,
        noEncontradas,
        errores: erroresProceso,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el CSV.");
    } finally {
      setCsvLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
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
              <p className="mt-1 text-sm text-[#6F665C]">Compatible con celular o computador. Usa Code39 / Libre Barcode 39. También acepta Code128.</p>

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

            <div className="rounded-2xl border border-[#E0D9CE] bg-white p-4">
              <div className="flex items-center justify-between gap-3 max-[700px]:flex-col max-[700px]:items-start">
                <div>
                  <p className="text-sm font-semibold">Modo pistola lectora</p>
                  <p className="mt-1 text-sm text-[#6F665C]">Actívalo si usas un escáner USB/Bluetooth. La pistola escribe el número y presiona Enter automáticamente.</p>
                </div>
                <button type="button" onClick={() => setModoPistola((v) => !v)} className={["rounded-xl px-5 py-3 font-semibold", modoPistola ? "bg-[#E8620A] text-white" : "border border-[#1A1A1A] bg-white"].join(" ")}>
                  {modoPistola ? "Modo pistola activo" : "Activar modo pistola"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-4">
              <p className="text-sm font-semibold">Subir CSV de asignaciones</p>
              <p className="mt-1 text-sm text-[#6F665C]">Columna A: número de boleta. Columna B: nombre del vendedor. Puede tener encabezados.</p>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={csvLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) procesarCsv(file);
                }}
                className="mt-4 w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#1A1A1A] file:px-4 file:py-2 file:font-semibold file:text-white"
              />

              {csvLoading && <p className="mt-3 text-sm font-medium text-[#6F665C]">Procesando CSV...</p>}

              {csvResumen && (
                <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  <p className="font-semibold">CSV procesado</p>
                  <div className="mt-2 space-y-1">
                    <p>Filas leídas: {csvResumen.filasLeidas}</p>
                    <p>Vendedores detectados: {csvResumen.vendedores}</p>
                    <p>Asignadas: {csvResumen.asignadas}</p>
                    <p>Omitidas: {csvResumen.omitidas}</p>
                  </div>
                  {csvResumen.noEncontradas.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold">No encontradas:</p>
                      <p className="break-all">{csvResumen.noEncontradas.join(", ")}</p>
                    </div>
                  )}
                  {csvResumen.errores.length > 0 && (
                    <div className="mt-3 text-red-700">
                      <p className="font-semibold">Errores:</p>
                      <p className="break-all">{csvResumen.errores.join(" | ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Agregar manualmente o con pistola</label>

              <div className="flex gap-3 max-[700px]:flex-col">
                <input
                  ref={pistolaInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={inputCodigo}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setInputCodigo(valor);
                  }}
                  onBlur={() => {
                    if (modoPistola) setTimeout(() => pistolaInputRef.current?.focus(), 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      if (!inputCodigo.trim()) return;

                      if (modoPistola) {
                        manejarPistola(inputCodigo);
                      } else {
                        agregarCodigo();
                      }
                    }
                  }}
                  placeholder="Escanea o escribe: 0000"
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
              {resultado.errores && resultado.errores.length > 0 && <div className="mt-4"><p className="font-semibold">Errores:</p><p className="mt-1 break-all">{resultado.errores.join(" | ")}</p></div>}
              {resultado.sales_url && (
                <div className="mt-4 rounded-xl border border-green-300 bg-white p-4 text-[#1A1A1A]">
                  <p className="font-semibold">Enlace público del vendedor</p>
                  <p className="mt-1 break-all text-xs text-[#6F665C]">{resultado.sales_url}</p>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(resultado.sales_url || "")}
                    className="mt-3 rounded-lg bg-[#1A1A1A] px-4 py-2 font-semibold text-white"
                  >
                    Copiar enlace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
