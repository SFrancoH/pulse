"use client";

import { useState } from "react";

export default function AdminBootstrapPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "No se pudo crear el administrador.");
      }

      setMessage("Super admin creado correctamente. Ya puedes ir a /admin/login.");
      setToken("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Configuración inicial</p>
          <h1 className="mt-2 text-4xl font-bold">Crear primer admin</h1>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

          <div>
            <label className="mb-2 block text-sm font-medium">Token bootstrap</label>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Email admin</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
          </div>

          <button disabled={loading} className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
            {loading ? "Creando..." : "Crear super admin"}
          </button>
        </form>
      </section>
    </main>
  );
}
