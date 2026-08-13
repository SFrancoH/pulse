"use client";

import { useState } from "react";

type Vendedor = { id: string; nombre: string; telefono: string; email: string };
type Campo = "nombre" | "telefono" | "email" | "password";
type ApiResponse = { success: boolean; message?: string; vendedores?: Vendedor[]; vendedor?: Vendedor | null };

export default function GestionVendedores() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [actualizando, setActualizando] = useState<Campo | "">("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const seleccionado = vendedores.find((v) => v.id === vendedorId) || null;
  const inputClass = "w-full rounded-xl border border-[#D8D0C5] bg-white px-4 py-3 text-[#1A1A1A] caret-[#1A1A1A] outline-none placeholder:text-[#7A7066] focus:border-[#E8620A]";

  function cargarCampos(v: Vendedor | null) {
    setNombre(v?.nombre || "");
    setTelefono(v?.telefono || "");
    setEmail(v?.email || "");
    setPassword("");
  }

  async function abrir() {
    setAbierto(true);
    setCargando(true);
    setError("");
    setMensaje("");
    setVendedorId("");
    cargarCampos(null);
    try {
      const res = await fetch("/api/admin/vendedores", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!data.success) throw new Error(data.message || "No se pudieron cargar los vendedores.");
      setVendedores(data.vendedores || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando vendedores.");
    } finally {
      setCargando(false);
    }
  }

  function cerrar() {
    if (actualizando) return;
    setAbierto(false);
    setError("");
    setMensaje("");
    setVendedorId("");
    cargarCampos(null);
  }

  function seleccionar(id: string) {
    setVendedorId(id);
    setError("");
    setMensaje("");
    cargarCampos(vendedores.find((v) => v.id === id) || null);
  }

  async function actualizar(campo: Campo) {
    if (!vendedorId) return;
    const valor = campo === "nombre" ? nombre : campo === "telefono" ? telefono : campo === "email" ? email : password;
    setActualizando(campo);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/admin/vendedores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor_id: vendedorId, campo, valor }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.success) throw new Error(data.message || "No se pudo actualizar el vendedor.");
      if (data.vendedor) {
        const actualizado = data.vendedor;
        setVendedores((lista) => lista.map((v) => (v.id === actualizado.id ? actualizado : v)));
        setNombre(actualizado.nombre || "");
        setTelefono(actualizado.telefono || "");
        setEmail(actualizado.email || "");
      }
      if (campo === "password") setPassword("");
      setMensaje(data.message || "Datos actualizados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando vendedor.");
    } finally {
      setActualizando("");
    }
  }

  function fila(label: string, campo: Campo, value: string, setValue: (value: string) => void, type = "text", placeholder = "") {
    return (
      <div className="rounded-2xl border border-[#E0D9CE] bg-white p-4 text-[#1A1A1A]">
        <label className="mb-2 block text-sm font-semibold text-[#1A1A1A]">{label}</label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type={type} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete={campo === "password" ? "new-password" : undefined} className={inputClass} />
          <button type="button" onClick={() => actualizar(campo)} disabled={Boolean(actualizando)} className={`rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50 ${campo === "password" ? "bg-[#1A1A1A]" : "bg-[#E8620A]"}`}>
            {actualizando === campo ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={abrir} className="rounded-2xl border border-[#1A1A1A] bg-white px-6 py-4 text-lg font-semibold text-[#1A1A1A]">Gestionar vendedores</button>
      {abierto && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white text-[#1A1A1A] shadow-xl">
            <div className="flex items-center justify-between bg-[#1A1A1A] px-6 py-5 text-white">
              <div><p className="text-sm uppercase tracking-[3px] text-white/60">Administración</p><h2 className="mt-1 text-3xl font-bold">Gestionar vendedores</h2></div>
              <button type="button" onClick={cerrar} className="text-4xl leading-none" aria-label="Cerrar">×</button>
            </div>
            <div className="space-y-6 p-6">
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {mensaje && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{mensaje}</div>}
              {cargando ? (
                <div className="rounded-2xl bg-[#F2EDE4] p-6 text-center text-[#1A1A1A]">Consultando vendedores...</div>
              ) : vendedores.length === 0 ? (
                <div className="rounded-2xl bg-[#F2EDE4] p-6 text-center text-[#1A1A1A]">No hay vendedores activos.</div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1A1A1A]">Vendedor</label>
                    <select value={vendedorId} onChange={(e) => seleccionar(e.target.value)} className={inputClass}>
                      <option value="">Seleccionar vendedor...</option>
                      {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </div>
                  {seleccionado && (
                    <div className="space-y-4">
                      {fila("Nombre", "nombre", nombre, setNombre)}
                      {fila("Teléfono", "telefono", telefono, setTelefono, "tel")}
                      {fila("Correo", "email", email, setEmail, "email")}
                      {fila("Contraseña nueva", "password", password, setPassword, "password", "Mínimo 8 caracteres")}
                      <p className="text-sm text-[#7A7066]">El ID interno del vendedor no se modifica. Al cambiar el nombre, también se actualiza el nombre del vendedor en las boletas que tengan ese ID asignado.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
