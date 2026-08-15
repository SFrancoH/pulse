"use client";

import { useState } from "react";

type LoginResponse = {
  success?: boolean;
  message?: string;
  redirect_to?: string;
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const responseText = await res.text();
      let data: LoginResponse = {};

      try {
        data = responseText ? (JSON.parse(responseText) as LoginResponse) : {};
      } catch {
        throw new Error("El servidor no respondió correctamente.");
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Credenciales inválidas.");
      }

      window.location.assign(data.redirect_to || "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error interno");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2EDE4] px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[4px] text-[#9A9187]">Pulse Admin</p>
          <h1 className="mt-3 text-4xl font-bold text-[#1A1A1A]">Iniciar sesión</h1>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[#E0D9CE] bg-white px-4 py-4 text-black caret-black opacity-100 outline-none placeholder:text-[#7A7066] focus:border-[#E8620A]"
              style={{ WebkitTextFillColor: "#000000" }}
              placeholder="admin@pulse.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#E0D9CE] bg-white px-4 py-4 pr-36 text-black caret-black opacity-100 outline-none placeholder:text-[#7A7066] focus:border-[#E8620A]"
                style={{ WebkitTextFillColor: "#000000" }}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#1A1A1A] hover:text-[#E8620A] focus:outline-none"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
