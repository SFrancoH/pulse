"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Proyecto = {
  id: string;
  nombre: string;
  slug: string;
  estado?: string | null;
  flyer_url?: string | null;
  ventas_url: string;
  asignar_vendedor_url: string;
};

type EmpresaGrupo = {
  empresa: {
    id: string;
    nombre: string;
    slug: string;
  };
  proyectos: Proyecto[];
};

type ApiResponse = {
  success: boolean;
  role?: string;
  empresa_id?: string | null;
  empresas?: EmpresaGrupo[];
  message?: string;
};

type UpdateResponse = {
  success: boolean;
  message?: string;
  recibidas?: number;
  actualizadas?: number;
  omitidas?: number;
  no_encontradas?: string[];
  errores?: string[];
};

type CsvItem = {
  numero: string;
  estado?: string;
  canal?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  vendedor?: string;
  valor_pagado?: string;
};

const CSV_CHUNK_SIZE = 200;

function normalizarHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarNumero(value: string) {
  const limpio = String(value || "").replace(/\D/g, "");
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

function mapCsvRow(headers: string[], row: string[]): CsvItem | null {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const index = headers.indexOf(key);
      if (index >= 0 && row[index] !== undefined) return row[index].trim();
    }
    return "";
  };

  const numero = normalizarNumero(get("numero", "boleta", "consecutivo"));
  if (!numero) return null;

  return {
    numero,
    estado: get("estado"),
    canal: get("canal"),
    nombre: get("nombre", "nombre_cliente", "cliente"),
    telefono: get("telefono", "telefono_cliente", "phone"),
    email: get("email", "correo"),
    vendedor: get("nombre_vendedor", "vendedor", "asesor"),
    valor_pagado: get("valor_pagago", "valor_pagado", "valor", "valor_a_pagar"),
  };
}

function parseCsvActualizar(texto: string) {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length < 2) return [];

  const headers = parseCsvLine(lineas[0]).map(normalizarHeader);
  const items: CsvItem[] = [];

  for (const linea of lineas.slice(1)) {
    const item = mapCsvRow(headers, parseCsvLine(linea));
    if (item) items.push(item);
  }

  return items;
}

export default function AdminDashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const proyectoCsvRef = useRef<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaGrupo[]>([]);
  const [role, setRole] = useState("");
  const [empresaSesionId, setEmpresaSesionId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [formEmpresaId, setFormEmpresaId] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formPrecio, setFormPrecio] = useState("60000");
  const [formFormularioUrl, setFormFormularioUrl] = useState("");
  const [formFlyerUrl, setFormFlyerUrl] = useState("");
  const [modalError, setModalError] = useState("");
  const [syncingProyectoId, setSyncingProyectoId] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/proyectos", {
        cache: "no-store",
      });

      const data = (await res.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudieron cargar los proyectos.");
      }

      const grupos = data.empresas || [];
      setEmpresas(grupos);
      setRole(data.role || "");
      setEmpresaSesionId(data.empresa_id || null);

      if (!formEmpresaId && grupos[0]?.empresa.id) {
        setFormEmpresaId(data.role === "empresa_admin" && data.empresa_id ? data.empresa_id : grupos[0].empresa.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function abrirModal(empresaId?: string) {
    setModalError("");
    setFormEmpresaId(role === "empresa_admin" && empresaSesionId ? empresaSesionId : empresaId || empresas[0]?.empresa.id || "");
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (creando) return;
    setModalAbierto(false);
  }

  function abrirCsv(proyectoId: string) {
    proyectoCsvRef.current = proyectoId;
    setError("");
    setSyncMessage("");
    fileInputRef.current?.click();
  }

  async function leerJsonSeguro(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text) as UpdateResponse;
    } catch {
      throw new Error(text || "El servidor no respondió JSON válido.");
    }
  }

  async function procesarCsvSeleccionado(file: File) {
    const proyectoId = proyectoCsvRef.current;
    if (!proyectoId) return;

    setSyncingProyectoId(proyectoId);
    setSyncMessage("Leyendo CSV...");
    setError("");

    try {
      const texto = await file.text();
      const items = parseCsvActualizar(texto);

      if (items.length === 0) {
        throw new Error("El CSV no tiene registros válidos. Debe incluir al menos la columna numero.");
      }

      let actualizadas = 0;
      let omitidas = 0;
      const noEncontradas: string[] = [];
      const errores: string[] = [];

      for (let inicio = 0; inicio < items.length; inicio += CSV_CHUNK_SIZE) {
        const chunk = items.slice(inicio, inicio + CSV_CHUNK_SIZE);
        setSyncMessage(`Actualizando ${Math.min(inicio + chunk.length, items.length)} de ${items.length} registros...`);

        const res = await fetch(`/api/proyectos/${proyectoId}/actualizar-base-datos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });

        const data = await leerJsonSeguro(res);

        if (!data.success) {
          throw new Error(data.message || "No se pudo actualizar la base de datos.");
        }

        actualizadas += data.actualizadas || 0;
        omitidas += data.omitidas || 0;
        if (data.no_encontradas?.length) noEncontradas.push(...data.no_encontradas);
        if (data.errores?.length) errores.push(...data.errores);
      }

      setSyncMessage(`CSV procesado. Actualizadas: ${actualizadas}. Omitidas: ${omitidas}. No encontradas: ${noEncontradas.length}. Errores: ${errores.length}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando base de datos.");
    } finally {
      setSyncingProyectoId("");
      proyectoCsvRef.current = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function crearProyecto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreando(true);
    setModalError("");

    try {
      const empresaIdFinal = role === "empresa_admin" && empresaSesionId ? empresaSesionId : formEmpresaId;

      const res = await fetch("/api/crear-proyecto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaIdFinal,
          nombre: formNombre,
          precio_boleta: Number(formPrecio || 60000),
          formulario_compra_url: formFormularioUrl,
          flyer_url: formFlyerUrl,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "No se pudo crear el proyecto.");
      }

      setFormNombre("");
      setFormPrecio("60000");
      setFormFormularioUrl("");
      setFormFlyerUrl("");
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) procesarCsvSeleccionado(file);
        }}
      />

      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[3px] text-[#7A7066]">Panel administrativo</p>
            <h1 className="mt-2 text-4xl font-bold">
              {role === "super_admin" ? "Todos los proyectos" : "Proyectos de tu empresa"}
            </h1>
          </div>

          <button type="button" onClick={() => abrirModal()} className="rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white">
            Crear nuevo proyecto
          </button>
        </div>

        {syncMessage && (
          <div className="mb-6 rounded-3xl border border-green-200 bg-green-50 p-5 text-green-700">
            {syncMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl bg-white p-10 text-center text-lg shadow-sm">
            Cargando proyectos...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && empresas.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            No hay proyectos disponibles.
          </div>
        )}

        <div className="space-y-12">
          {empresas.map((grupo) => (
            <section key={grupo.empresa.id}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">{grupo.empresa.nombre}</h2>

                <button type="button" onClick={() => abrirModal(grupo.empresa.id)} className="rounded-xl border border-[#1A1A1A] bg-white px-5 py-3 font-semibold">
                  Crear nuevo proyecto
                </button>
              </div>

              {grupo.proyectos.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 shadow-sm">
                  Esta empresa aún no tiene proyectos.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.proyectos.map((proyecto) => (
                    <article key={proyecto.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                      <div className="aspect-[16/10] bg-[#E7DED3]">
                        {proyecto.flyer_url ? (
                          <img src={proyecto.flyer_url} alt={proyecto.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-center text-sm text-[#7A7066]">
                            Sin imagen del proyecto
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="mb-4">
                          <h3 className="text-2xl font-bold">{proyecto.nombre}</h3>
                          <p className="mt-1 text-sm uppercase tracking-[2px] text-[#7A7066]">
                            {proyecto.estado || "Sin estado"}
                          </p>
                        </div>

                        <div className="grid gap-3">
                          <Link href={proyecto.asignar_vendedor_url} className="rounded-2xl bg-[#1A1A1A] px-5 py-4 text-center text-lg font-semibold text-white">
                            Asignar vendedor
                          </Link>

                          <a href={proyecto.ventas_url} className="rounded-2xl bg-[#E8620A] px-5 py-4 text-center text-lg font-semibold text-white">
                            Página de ventas
                          </a>

                          <button type="button" onClick={() => abrirCsv(proyecto.id)} disabled={syncingProyectoId === proyecto.id} className="rounded-2xl border border-[#1A1A1A] bg-white px-5 py-4 text-center text-lg font-semibold disabled:opacity-60">
                            {syncingProyectoId === proyecto.id ? "Actualizando..." : "Actualizar base de datos"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>

      {modalAbierto && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-[#1A1A1A] px-6 py-5 text-white">
              <div>
                <p className="text-sm uppercase tracking-[3px] text-white/60">Nuevo proyecto</p>
                <h2 className="mt-1 text-3xl font-bold">Crear proyecto</h2>
              </div>
              <button type="button" onClick={cerrarModal} className="text-4xl leading-none">×</button>
            </div>

            <form onSubmit={crearProyecto} className="space-y-5 p-6">
              {modalError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</div>}

              {role === "super_admin" && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Empresa</label>
                  <select value={formEmpresaId} onChange={(e) => setFormEmpresaId(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none" required>
                    {empresas.map((grupo) => (
                      <option key={grupo.empresa.id} value={grupo.empresa.id}>{grupo.empresa.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Nombre del proyecto</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Promo Abril" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Precio por boleta</label>
                <input type="number" value={formPrecio} onChange={(e) => setFormPrecio(e.target.value)} placeholder="60000" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Formulario de compra</label>
                <input type="url" value={formFormularioUrl} onChange={(e) => setFormFormularioUrl(e.target.value)} placeholder="https://forms.example.com/..." className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">URL imagen / flyer</label>
                <input type="url" value={formFlyerUrl} onChange={(e) => setFormFlyerUrl(e.target.value)} placeholder="https://ejemplo.com/flyer.jpg" className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={cerrarModal} disabled={creando} className="rounded-2xl border border-[#1A1A1A] px-6 py-4 text-lg font-semibold disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={creando} className="rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
                  {creando ? "Creando proyecto..." : "Crear proyecto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
