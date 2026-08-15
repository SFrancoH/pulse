"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Credenciales inválidas.");
      }

      router.replace(data.redirect_to || "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error interno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2EDE4] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[4px] text-[#9A9187]">Pulse</p>
          <h1 className="mt-3 text-4xl font-bold text-[#1A1A1A]">Iniciar sesión</h1>
          <p className="mt-3 text-sm text-[#7A7066]">
            Ingresa con las credenciales asignadas a tu cuenta.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-[#E0D9CE] bg-white px-4 py-4 text-black caret-black opacity-100 outline-none placeholder:text-[#7A7066] focus:border-[#E8620A]"
              style={{ WebkitTextFillColor: "#000000" }}
              placeholder="correo@empresa.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
            className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
