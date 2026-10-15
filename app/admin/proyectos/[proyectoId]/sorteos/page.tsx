"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import SorteosFields from "@/components/SorteosFields";
import type { SorteosInput } from "@/lib/project-draws";

type Props = { params: Promise<{ proyectoId: string }> };
const VACIO: SorteosInput = { premio_mayor: "", anticipados: [] };
function fechaLocal(valor: string) { return valor.slice(0, 16); }

export default function ConfigurarSorteosPage({ params }: Props) {
  const { proyectoId } = use(params);
  const [nombre, setNombre] = useState("");
  const [sorteos, setSorteos] = useState<SorteosInput>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch(`/api/admin/proyectos/${encodeURIComponent(proyectoId)}/sorteos`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.success) throw Error(data.message || "No se pudo cargar el calendario.");
        setNombre(data.proyecto || "");
        if (data.sorteos) setSorteos({
          premio_mayor: fechaLocal(data.sorteos.premio_mayor),
          anticipados: (data.sorteos.anticipados || []).map(fechaLocal),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar.");
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, [proyectoId]);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true); setError(""); setMensaje("");
    try {
      const res = await fetch(`/api/admin/proyectos/${encodeURIComponent(proyectoId)}/sorteos`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sorteos }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw Error(data.message || "No se pudo guardar.");
      setMensaje("Calendario actualizado. Se mostrará en la página pública, administrativa y de vendedores.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally { setGuardando(false); }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#E8620A]">Configurar sorteos</p>
            <h1 className="mt-2 text-2xl font-black">{nombre || "Proyecto"}</h1>
          </div>
          <Link href="/admin" className="rounded-xl border px-4 py-2 font-semibold">Volver</Link>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {mensaje && <p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-green-800">{mensaje}</p>}
        {cargando ? <p>Cargando...</p> : (
          <form onSubmit={guardar} className="space-y-5">
            <SorteosFields value={sorteos} onChange={setSorteos} disabled={guardando} />
            <button type="submit" disabled={guardando} className="w-full rounded-xl bg-[#E8620A] px-5 py-4 font-bold text-white disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar fechas"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
