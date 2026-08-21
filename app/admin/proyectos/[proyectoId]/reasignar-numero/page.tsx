"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";

type Props = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Vendedor = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string;
};

type Boleta = {
  id: string;
  numero: string;
  estado: string | null;
  canal: string | null;
  vendedor_nombre: string | null;
  vendedor_user_id: string | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  puede_reasignar: boolean;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  vendedores?: Vendedor[];
  boleta?: Boleta;
  sheet_sync?: {
    success?: boolean;
    skipped?: boolean;
    warning?: string | null;
  };
};

function normalizarNumero(valor: string) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

export default function ReasignarNumeroPage({ params }: Props) {
  const { proyectoId } = use(params);
  const [numero, setNumero] = useState("");
  const [boleta, setBoleta] = useState<Boleta | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [destino, setDestino] = useState("oficina");
  const [loadingVendedores, setLoadingVendedores] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [syncWarning, setSyncWarning] = useState("");

  useEffect(() => {
    cargarVendedores();
  }, [proyectoId]);

  async function leerJson(res: Response) {
    const text = await res.text();

    try {
      return JSON.parse(text) as ApiResponse;
    } catch {
      throw new Error(text || "El servidor no respondió JSON válido.");
    }
  }

  async function cargarVendedores() {
    setLoadingVendedores(true);

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/vendedores`, {
        cache: "no-store",
      });
      const data = await leerJson(res);

      if (!data.success) {
        throw new Error(data.message || "No se pudieron cargar los vendedores.");
      }

      setVendedores(data.vendedores || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los vendedores.");
    } finally {
      setLoadingVendedores(false);
    }
  }

  function destinoActual(ticket: Boleta) {
    if (!ticket.vendedor_user_id || String(ticket.vendedor_nombre || "").trim().toLowerCase() === "oficina") {
      return "oficina";
    }

    return ticket.vendedor_user_id;
  }

  async function buscar(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const normalizado = normalizarNumero(numero);

    if (!normalizado) {
      setError("Ingresa un número válido.");
      return;
    }

    setBuscando(true);
    setError("");
    setMensaje("");
    setSyncWarning("");
    setBoleta(null);

    try {
      const res = await fetch(
        `/api/proyectos/${proyectoId}/reasignar-numero?numero=${encodeURIComponent(normalizado)}`,
        { cache: "no-store" }
      );
      const data = await leerJson(res);

      if (!data.success || !data.boleta) {
        throw new Error(data.message || "No se pudo consultar el número.");
      }

      setNumero(data.boleta.numero);
      setBoleta(data.boleta);
      setDestino(destinoActual(data.boleta));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el número.");
    } finally {
      setBuscando(false);
    }
  }

  async function reasignar() {
    if (!boleta) return;

    const esOficina = destino === "oficina";
    const vendedorSeleccionado = esOficina
      ? null
      : vendedores.find((item) => item.id === destino) || null;

    if (!esOficina && !vendedorSeleccionado) {
      setError("Selecciona un vendedor válido.");
      return;
    }

    const nombreDestino = esOficina
      ? "Oficina"
      : vendedorSeleccionado?.nombre || vendedorSeleccionado?.email || "el vendedor";

    const confirmado = window.confirm(
      `¿Confirmas mover el número ${boleta.numero} a ${nombreDestino}?`
    );

    if (!confirmado) return;

    setGuardando(true);
    setError("");
    setMensaje("");
    setSyncWarning("");

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reasignar-numero`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numero: boleta.numero,
          destino: esOficina ? "oficina" : "vendedor",
          vendedor_user_id: esOficina ? undefined : destino,
        }),
      });

      const data = await leerJson(res);

      if (!data.success) {
        throw new Error(data.message || "No se pudo reasignar el número.");
      }

      setMensaje(data.message || "Número actualizado correctamente.");
      setSyncWarning(data.sheet_sync?.warning || "");
      await buscar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reasignar el número.");
    } finally {
      setGuardando(false);
    }
  }

  const asignacionActual = boleta?.vendedor_user_id
    ? boleta.vendedor_nombre || "Vendedor"
    : "Oficina";

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Administración de boletas</p>
          <h1 className="mt-2 text-4xl font-bold">Liberar o reasignar número</h1>
          <p className="mt-3 break-all text-sm text-white/70">Proyecto: {proyectoId}</p>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-[#6F665C]">
              Busca un número disponible y muévelo a Oficina o a otro vendedor activo. No se modifican datos del cliente ni pagos.
            </p>
            <Link href="/admin" className="rounded-xl border border-[#1A1A1A] px-4 py-2 text-sm font-semibold">
              Volver al panel
            </Link>
          </div>

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

          {syncWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              La reasignación quedó guardada, pero Google Sheets reportó: {syncWarning}
            </div>
          )}

          <form onSubmit={buscar} className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-5">
            <label className="mb-2 block text-sm font-semibold">Número de boleta</label>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                inputMode="numeric"
                placeholder="Ej: 0012"
                maxLength={4}
                className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 text-lg outline-none"
              />
              <button
                type="submit"
                disabled={buscando}
                className="rounded-xl bg-[#E8620A] px-6 py-3 font-semibold text-white disabled:opacity-50"
              >
                {buscando ? "Buscando..." : "Buscar número"}
              </button>
            </div>
          </form>

          {boleta && (
            <div className="space-y-5 rounded-2xl border border-[#E0D9CE] p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-[#F9F6F1] p-4">
                  <p className="text-xs uppercase tracking-[2px] text-[#7A7066]">Número</p>
                  <p className="mt-2 text-3xl font-bold">{boleta.numero}</p>
                </div>
                <div className="rounded-xl bg-[#F9F6F1] p-4">
                  <p className="text-xs uppercase tracking-[2px] text-[#7A7066]">Estado</p>
                  <p className="mt-2 text-lg font-bold">{boleta.estado || "Sin estado"}</p>
                </div>
                <div className="rounded-xl bg-[#F9F6F1] p-4">
                  <p className="text-xs uppercase tracking-[2px] text-[#7A7066]">Asignación actual</p>
                  <p className="mt-2 text-lg font-bold">{asignacionActual}</p>
                </div>
              </div>

              {!boleta.puede_reasignar ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  Este número no se puede mover porque su estado es <strong>{boleta.estado || "sin estado"}</strong>. Solo se permiten números en estado Disponible.
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Nueva asignación</label>
                    <select
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      disabled={loadingVendedores || guardando}
                      className="w-full rounded-xl border border-[#E0D9CE] bg-white px-4 py-3 outline-none disabled:opacity-60"
                    >
                      <option value="oficina">Oficina — liberar número</option>
                      {vendedores.map((vendedor) => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.nombre || vendedor.email}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-[#6F665C]">
                      Oficina deja el número disponible para venta general. Un vendedor lo retira de la disponibilidad de Oficina.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={reasignar}
                    disabled={guardando || loadingVendedores}
                    className="w-full rounded-2xl bg-[#1A1A1A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando..."
                      : destino === "oficina"
                        ? "Liberar a Oficina"
                        : "Reasignar a vendedor"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
