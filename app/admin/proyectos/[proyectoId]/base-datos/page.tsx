"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Boleta = {
  id: string;
  numero: string;
  estado: string | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  email_cliente: string | null;
  valor_pagado: number | null;
  vendedor_nombre: string | null;
  canal: string | null;
};

type Props = { params: Promise<{ proyectoId: string }> };
type Editable = Omit<Boleta, "id" | "numero">;

const ESTADOS = ["Disponible", "No disponible", "Debe", "Abonado", "Pagado"];
const CANALES = ["", "Vendedores", "Anuncios", "Oficina"];

export default function BaseDatosProyectoPage({ params }: Props) {
  const { proyectoId } = use(params);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [proyectoNombre, setProyectoNombre] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [ediciones, setEdiciones] = useState<Record<string, Editable>>({});
  const [busqueda, setBusqueda] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [estado, setEstado] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cliente, setCliente] = useState("");
  const [correo, setCorreo] = useState("");
  const [masivo, setMasivo] = useState<Record<string, string>>({});

  const cargar = useCallback(async (mostrarMensaje = false) => {
    try {
      setLoading(true);
      setError("");
      if (mostrarMensaje) setMensaje("Consultando nuevamente la base de datos...");

      const res = await fetch(`/api/admin/proyectos/${proyectoId}/boletas`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || "No se pudo cargar la base de datos.");

      setBoletas(data.boletas || []);
      setProyectoNombre(data.proyecto?.nombre || proyectoId);
      setRole(data.role || "");
      setEdiciones({});
      setSeleccionadas(new Set());
      if (mostrarMensaje) setMensaje(`Base de datos actualizada. ${data.total ?? data.boletas?.length ?? 0} registros cargados.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
      setMensaje("");
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargar]);

  const filtradas = useMemo(() => {
    const nums = busqueda
      .split(/[\s,;]+/)
      .map((v) => v.replace(/\D/g, "").padStart(4, "0"))
      .filter(Boolean);
    const termino = busqueda.trim().toLowerCase();

    return boletas.filter(
      (b) =>
        (!termino || nums.includes(b.numero) || b.numero.includes(termino)) &&
        (!vendedor || (b.vendedor_nombre || "").toLowerCase().includes(vendedor.toLowerCase())) &&
        (!estado || b.estado === estado) &&
        (!telefono || (b.telefono_cliente || "").includes(telefono)) &&
        (!cliente || (b.nombre_cliente || "").toLowerCase().includes(cliente.toLowerCase())) &&
        (!correo || (b.email_cliente || "").toLowerCase().includes(correo.toLowerCase()))
    );
  }, [boletas, busqueda, vendedor, estado, telefono, cliente, correo]);

  function valorFila(b: Boleta): Editable {
    return (
      ediciones[b.id] || {
        estado: b.estado,
        nombre_cliente: b.nombre_cliente,
        telefono_cliente: b.telefono_cliente,
        email_cliente: b.email_cliente,
        valor_pagado: b.valor_pagado,
        vendedor_nombre: b.vendedor_nombre,
        canal: b.canal,
      }
    );
  }

  function editar(id: string, campo: keyof Editable, valor: string | number | null) {
    const boleta = boletas.find((item) => item.id === id);
    if (!boleta) return;
    setEdiciones((prev) => ({ ...prev, [id]: { ...valorFila(boleta), [campo]: valor } }));
  }

  async function actualizar(ids: string[], cambios: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const res = await fetch(`/api/admin/proyectos/${proyectoId}/boletas`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, cambios }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || "No se pudo actualizar.");

      setMensaje(`${data.actualizadas || 0} registro(s) actualizado(s).`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setSaving(false);
    }
  }

  function aplicarMasivo() {
    const cambios = Object.fromEntries(Object.entries(masivo).filter(([, value]) => value !== ""));
    void actualizar(Array.from(seleccionadas), cambios);
  }

  async function cargarCsv(file: File) {
    setSaving(true);
    setError("");
    setMensaje("Procesando archivo...");

    try {
      const texto = await file.text();
      const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
      const headers = lineas[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const items = lineas
        .slice(1)
        .map((linea) => {
          const columnas = linea.split(",");
          const get = (...nombres: string[]) => {
            const index = nombres.map((nombre) => headers.indexOf(nombre)).find((value) => value >= 0);
            return index === undefined ? "" : (columnas[index] || "").trim();
          };
          return {
            numero: get("numero", "boleta", "consecutivo"),
            estado: get("estado"),
            nombre: get("nombre", "nombre_cliente"),
            telefono: get("telefono", "telefono_cliente"),
            email: get("email", "correo"),
            valor_pagado: get("valor_pagado", "valor"),
            vendedor: get("vendedor", "vendedor_nombre"),
            canal: get("canal"),
          };
        })
        .filter((item) => item.numero);

      const res = await fetch(`/api/proyectos/${proyectoId}/actualizar-base-datos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || "No se pudo cargar el archivo.");

      setMensaje(`Carga manual completada. Actualizadas: ${data.actualizadas || 0}. Omitidas: ${data.omitidas || 0}.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando CSV.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const campos = [
    ["estado", "Estado"],
    ["nombre_cliente", "Nombre cliente"],
    ["telefono_cliente", "Teléfono"],
    ["email_cliente", "Email"],
    ["valor_pagado", "Valor pagado"],
    ["vendedor_nombre", "Vendedor"],
    ["canal", "Canal"],
  ] as const;
  const esVendedor = role === "vendedor";
  const puedeAdministrar = role === "super_admin" || role === "empresa_admin";
  const camposVisibles = puedeAdministrar
    ? campos
    : campos.filter(([campo]) => campo !== "vendedor_nombre" && campo !== "canal");

  return (
    <main className="min-h-screen bg-[#F2EDE4] p-4 text-[#1A1A1A]">
      <section className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[3px] text-[#7A7066]">
              {esVendedor ? "Tus números asignados" : "Base de datos"}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{proyectoNombre}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-3 font-semibold">Volver</Link>
            <button type="button" disabled={loading} onClick={() => void cargar(true)} className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-3 font-semibold disabled:opacity-50">{loading ? "Refrescando..." : "Refrescar"}</button>
            {puedeAdministrar && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-[#E8620A] px-4 py-3 font-semibold text-white">Cargar base de datos manual</button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void cargarCsv(e.target.files[0])} />
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {mensaje && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">{mensaje}</div>}

        <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Número o lista de números" className="rounded-xl border p-3" />
          {puedeAdministrar && <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Vendedor" className="rounded-xl border p-3" />}
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-xl border p-3"><option value="">Todos los estados</option>{ESTADOS.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" className="rounded-xl border p-3" />
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre cliente" className="rounded-xl border p-3" />
          <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo" className="rounded-xl border p-3" />
        </div>

        {seleccionadas.size > 0 && (
          <div className="mb-5 rounded-2xl border border-[#E8620A] bg-white p-4">
            <p className="mb-3 font-semibold">{seleccionadas.size} seleccionada(s). Completa solo los campos que deseas cambiar.</p>
            <div className="grid gap-3 md:grid-cols-4">
              {camposVisibles.map(([campo, label]) =>
                campo === "estado" ? (
                  <select key={campo} value={masivo[campo] || ""} onChange={(e) => setMasivo({ ...masivo, [campo]: e.target.value })} className="rounded-xl border p-3"><option value="">{label}</option>{ESTADOS.map((item) => <option key={item}>{item}</option>)}</select>
                ) : campo === "canal" ? (
                  <select key={campo} value={masivo[campo] || ""} onChange={(e) => setMasivo({ ...masivo, [campo]: e.target.value })} className="rounded-xl border p-3"><option value="">Canal</option>{CANALES.filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select>
                ) : (
                  <input key={campo} type={campo === "valor_pagado" ? "number" : "text"} value={masivo[campo] || ""} onChange={(e) => setMasivo({ ...masivo, [campo]: e.target.value })} placeholder={label} className="rounded-xl border p-3" />
                )
              )}
            </div>
            <button disabled={saving} onClick={aplicarMasivo} className="mt-3 rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-50">Actualizar seleccionadas</button>
          </div>
        )}

        <div className="overflow-auto rounded-2xl bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center">Cargando...</p>
          ) : (
            <table className={`${esVendedor ? "min-w-[1200px]" : "min-w-[1500px]"} w-full text-sm`}>
              <thead className="sticky top-0 bg-[#1A1A1A] text-white"><tr><th className="p-3"><input type="checkbox" checked={filtradas.length > 0 && filtradas.every((b) => seleccionadas.has(b.id))} onChange={(e) => setSeleccionadas(e.target.checked ? new Set(filtradas.map((b) => b.id)) : new Set())} /></th><th className="p-3 text-left">Número</th>{camposVisibles.map(([, label]) => <th key={label} className="p-3 text-left">{label}</th>)}<th className="p-3">Acción</th></tr></thead>
              <tbody>
                {filtradas.map((b) => {
                  const valor = valorFila(b);
                  return (
                    <tr key={b.id} className="border-b align-top">
                      <td className="p-2"><input type="checkbox" checked={seleccionadas.has(b.id)} onChange={(e) => setSeleccionadas((prev) => { const next = new Set(prev); if (e.target.checked) next.add(b.id); else next.delete(b.id); return next; })} /></td>
                      <td className="p-2 font-semibold">{b.numero}</td>
                      <td className="p-2"><select value={valor.estado || ""} onChange={(e) => editar(b.id, "estado", e.target.value)} className="w-40 rounded border p-2">{ESTADOS.map((item) => <option key={item}>{item}</option>)}</select></td>
                      <td className="p-2"><input value={valor.nombre_cliente || ""} onChange={(e) => editar(b.id, "nombre_cliente", e.target.value)} className="w-44 rounded border p-2" /></td>
                      <td className="p-2"><input value={valor.telefono_cliente || ""} onChange={(e) => editar(b.id, "telefono_cliente", e.target.value)} className="w-36 rounded border p-2" /></td>
                      <td className="p-2"><input value={valor.email_cliente || ""} onChange={(e) => editar(b.id, "email_cliente", e.target.value)} className="w-52 rounded border p-2" /></td>
                      <td className="p-2"><input type="number" value={valor.valor_pagado ?? 0} onChange={(e) => editar(b.id, "valor_pagado", Number(e.target.value))} className="w-32 rounded border p-2" /></td>
                      {puedeAdministrar && <td className="p-2"><input value={valor.vendedor_nombre || ""} onChange={(e) => editar(b.id, "vendedor_nombre", e.target.value)} className="w-44 rounded border p-2" /></td>}
                      {puedeAdministrar && <td className="p-2"><select value={valor.canal || ""} onChange={(e) => editar(b.id, "canal", e.target.value)} className="w-36 rounded border p-2"><option value="">Sin canal</option>{CANALES.filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select></td>}
                      <td className="p-2"><button disabled={!ediciones[b.id] || saving} onClick={() => void actualizar([b.id], ediciones[b.id])} className="rounded-lg bg-[#E8620A] px-3 py-2 font-semibold text-white disabled:opacity-40">Actualizar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-sm text-[#6F665C]">Mostrando {filtradas.length} de {boletas.length} registros.</p>
      </section>
    </main>
  );
}
