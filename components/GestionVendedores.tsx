"use client";

import { useState } from "react";

type Vendedor = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  vendedores?: Vendedor[];
  vendedor?: Vendedor | null;
};

type CampoEditable = "nombre" | "telefono" | "email" | "password";

export default function GestionVendedores() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [actualizando, setActualizando] = useState<CampoEditable | "">("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const vendedorSeleccionado = vendedores.find((item) => item.id === vendedorId) || null;

  function cargarCampos(vendedor: Vendedor | null) {
    setNombre(vendedor?.nombre || "");
    setTelefono(vendedor?.telefono || "");
    setEmail(vendedor?.email || "");
    setPassword("");
  }

  async function abrir() {
    setAbierto(true);
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      const res = await fetch("/api/admin/vendedores", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudieron cargar los vendedores.");
      }

      const lista = data.vendedores || [];
      setVendedores(lista);

      if (lista.length > 0) {
        setVendedorId(lista[0].id);
        cargarCampos(lista[0]);
      } else {
        setVendedorId("");
        cargarCampos(null);
      }
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
    setPassword("");
  }

  function seleccionar(id: string) {
    setVendedorId(id);
    setError("");
    setMensaje("");
    cargarCampos(vendedores.find((item) => item.id === id) || null);
  }

  async function actualizar(campo: CampoEditable) {
    if (!vendedorId) return;

    const valor =
      campo === "nombre"
        ? nombre
        : campo === "telefono"
          ? telefono
          : campo === "email"
            ? email
            : password;

    setActualizando(campo);
    setError("");
    setMensaje("");

    try {
      const res = await fetch("/api/admin/vendedores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedor_id: vendedorId,
          campo,
          valor,
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudo actualizar el vendedor.");
      }

      if (data.vendedor) {
        setVendedores((actuales) =>
          actuales.map((item) => (item.id === data.vendedor!.id ? data.vendedor! : item))
        );
        setNombre(data.vendedor.nombre || "");
        setTelefono(data.vendedor.telefono || "");
        setEmail(data.vendedor.email || "");
      }

      if (campo === "password") {
        setPassword("");
      }

      setMensaje(data.message || "Datos actualizados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando vendedor.");
    } finally {
      setActualizando("");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-2xl border border-[#1A1A1A] bg-white px-6 py-4 text-lg font-semibold text-[#1A1A1A]"
      >
        Gestionar vendedores
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-[#1A1A1A] px-6 py-5 text-white">
              <div>
                <p className="text-sm uppercase tracking-[3px] text-white/60">Administración</p>
                <h2 className="mt-1 text-3xl font-bold">Gestionar vendedores</h2>
              </div>
              <button type="button" onClick={cerrar} className="text-4xl leading-none" aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="space-y-6 p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {mensaje && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {mensaje}
                </div>
              )}

              {cargando ? (
                <div className="rounded-2xl bg-[#F2EDE4] p-6 text-center">Consultando vendedores...</div>
              ) : vendedores.length === 0 ? (
                <div className="rounded-2xl bg-[#F2EDE4] p-6 text-center">No hay vendedores activos.</div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Vendedor</label>
                    <select
                      value={vendedorId}
                      onChange={(e) => seleccionar(e.target.value)}
                      className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 text-base outline-none"
                    >
                      {vendedores.map((vendedor) => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {vendedorSeleccionado && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#E0D9CE] p-4">
                        <label className="mb-2 block text-sm font-semibold">Nombre</label>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => actualizar("nombre")}
                            disabled={Boolean(actualizando)}
                            className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {actualizando === "nombre" ? "Actualizando..." : "Actualizar"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E0D9CE] p-4">
                        <label className="mb-2 block text-sm font-semibold">Teléfono</label>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="tel"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => actualizar("telefono")}
                            disabled={Boolean(actualizando)}
                            className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {actualizando === "telefono" ? "Actualizando..." : "Actualizar"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E0D9CE] p-4">
                        <label className="mb-2 block text-sm font-semibold">Correo</label>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => actualizar("email")}
                            disabled={Boolean(actualizando)}
                            className="rounded-xl bg-[#E8620A] px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {actualizando === "email" ? "Actualizando..." : "Actualizar"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#E0D9CE] p-4">
                        <label className="mb-2 block text-sm font-semibold">Contraseña nueva</label>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                            className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => actualizar("password")}
                            disabled={Boolean(actualizando)}
                            className="rounded-xl bg-[#1A1A1A] px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {actualizando === "password" ? "Actualizando..." : "Actualizar"}
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-[#7A7066]">
                        El ID interno del vendedor no se modifica. Al cambiar el nombre, también se actualiza el nombre del vendedor en las boletas que tengan ese ID asignado.
                      </p>
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
