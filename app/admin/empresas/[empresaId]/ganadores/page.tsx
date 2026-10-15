"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Ganador = {
  id: string; numero: string; fecha: string;
  poster_url: string; video_url: string; activo: boolean;
};
type Valores = { numero: string; fecha: string; poster_url: string; video_url: string };
type Props = { params: Promise<{ empresaId: string }> };
const VACIO: Valores = { numero: "", fecha: "", poster_url: "", video_url: "" };

export default function GestionGanadoresPage({ params }: Props) {
  const { empresaId } = use(params);
  const [ganadores, setGanadores] = useState<Ganador[]>([]);
  const [form, setForm] = useState<Valores>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const endpoint = `/api/admin/empresas/${encodeURIComponent(empresaId)}/ganadores`;

  const cargar = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw Error(data.message || "No se pudieron cargar los ganadores.");
    setGanadores(data.ganadores || []);
  }, [endpoint]);

  useEffect(() => {
    void cargar().catch(err => setError(err instanceof Error ? err.message : "Error al cargar.")).finally(() => setCargando(false));
  }, [cargar]);

  function editar(item: Ganador) {
    setEditando(item.id);
    setForm({ numero: item.numero, fecha: item.fecha, poster_url: item.poster_url, video_url: item.video_url });
    setError(""); setMensaje("");
  }
  function cancelarEdicion() { setEditando(null); setForm(VACIO); }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setGuardando(true); setError(""); setMensaje("");
    try {
      const res = await fetch(endpoint, {
        method: editando ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editando ? { id: editando } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw Error(data.message || "No se pudo guardar.");
      cancelarEdicion();
      await cargar();
      setMensaje(data.message || "Ganador guardado.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }

  async function eliminar(item: Ganador) {
    if (!window.confirm(`¿Eliminar el ganador ${item.numero} del ${item.fecha}?`)) return;
    setGuardando(true); setError(""); setMensaje("");
    try {
      const res = await fetch(endpoint, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw Error(data.message || "No se pudo eliminar.");
      await cargar();
      setMensaje("Ganador eliminado.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo eliminar."); }
    finally { setGuardando(false); }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#E8620A]">Ganadores de la empresa</p>
            <h1 className="mt-1 text-3xl font-black">Administrar ganadores</h1>
            <p className="mt-2 text-sm text-[#6F665C]">Los ganadores de esta empresa aparecerán en las páginas de venta de sus proyectos.</p>
          </div>
          <Link href="/admin" className="rounded-xl border bg-white px-4 py-3 font-semibold">Volver al panel</Link>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {mensaje && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{mensaje}</p>}

        <form onSubmit={guardar} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">{editando ? "Editar ganador" : "Agregar ganador"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">Número ganador (4 dígitos) *</label>
              <input required maxLength={4} pattern="[0-9]{4}" placeholder="0045" value={form.numero}
                onChange={e => setForm({ ...form, numero: e.target.value })}
                className="w-full rounded-xl border p-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Fecha del sorteo *</label>
              <input required type="date" value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full rounded-xl border p-3" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Enlace del flyer / imagen del ganador *</label>
            <input required type="url" placeholder="https://..." value={form.poster_url}
              onChange={e => setForm({ ...form, poster_url: e.target.value })}
              className="w-full rounded-xl border p-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Enlace del video de entrega *</label>
            <input required type="url" placeholder="https://..." value={form.video_url}
              onChange={e => setForm({ ...form, video_url: e.target.value })}
              className="w-full rounded-xl border p-3" />
          </div>
          <p className="text-sm text-[#6F665C]">Usa enlaces HTTPS directos a imagen y video reproducible para que funcione la vista pública.</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={guardando} type="submit" className="rounded-xl bg-[#E8620A] px-6 py-3 font-bold text-white disabled:opacity-50">
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Agregar ganador"}
            </button>
            {editando && <button disabled={guardando} type="button" onClick={cancelarEdicion} className="rounded-xl border px-5 py-3 font-semibold">Cancelar edición</button>}
          </div>
        </form>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black">Ganadores registrados</h2>
          {cargando ? <p>Cargando...</p> : ganadores.length === 0 ? <p className="text-[#6F665C]">Todavía no hay ganadores agregados desde este panel.</p> : (
            <div className="space-y-3">
              {ganadores.map(item => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <img src={item.poster_url} alt={`Ganador ${item.numero}`} className="h-16 w-12 rounded-lg object-cover" />
                    <div><p className="font-black">Boleta {item.numero}</p><p className="text-sm text-[#6F665C]">{item.fecha}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={guardando} onClick={() => editar(item)} className="rounded-lg border px-4 py-2 font-semibold">Editar</button>
                    <button type="button" disabled={guardando} onClick={() => void eliminar(item)} className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
