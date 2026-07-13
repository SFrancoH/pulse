"use client";

import { useEffect, useState } from "react";

type AdminRole = "super_admin" | "empresa_admin" | "vendedor";

type SessionResponse = {
  success: boolean;
  role?: AdminRole;
  empresa_id?: string | null;
  message?: string;
};

export default function CrearUsuarioPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("empresa_admin");
  const [currentRole, setCurrentRole] = useState<AdminRole | "">("");
  const [empresaId, setEmpresaId] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/admin/proyectos", { cache: "no-store", credentials: "include" });
        const data = (await res.json()) as SessionResponse;

        if (!res.ok || !data.success || !data.role) {
          throw new Error(data.message || "No fue posible cargar la sesión.");
        }

        if (data.role !== "super_admin" && data.role !== "empresa_admin") {
          throw new Error("No tienes permisos para crear usuarios.");
        }

        setCurrentRole(data.role);
        setEmpresaId(data.empresa_id || "");
        setRole("empresa_admin");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando la sesión.");
      } finally {
        setLoadingSession(false);
      }
    }

    loadSession();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/crear-usuario", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role,
          empresa_id: currentRole === "empresa_admin" ? undefined : role === "super_admin" ? null : empresaId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo crear el usuario.");
      }

      setMessage("Usuario creado correctamente.");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const allowedRoles: AdminRole[] =
    currentRole === "super_admin"
      ? ["empresa_admin", "vendedor", "super_admin"]
      : ["empresa_admin", "vendedor"];

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-6 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Administración</p>
          <h1 className="mt-2 text-4xl font-bold">Crear usuario</h1>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

          {loadingSession ? (
            <div className="rounded-xl bg-[#F2EDE4] px-4 py-3 text-sm">Cargando permisos...</div>
          ) : currentRole ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Rol</label>
                <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none">
                  {allowedRoles.map((allowedRole) => (
                    <option key={allowedRole} value={allowedRole}>{allowedRole}</option>
                  ))}
                </select>
              </div>

              {currentRole === "super_admin" && role !== "super_admin" && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Empresa ID</label>
                  <input type="text" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none" required />
                </div>
              )}

              {currentRole === "empresa_admin" && (
                <div className="rounded-xl bg-[#F2EDE4] px-4 py-3 text-sm text-[#5E554D]">
                  El usuario quedará asociado automáticamente a tu empresa.
                </div>
              )}

              <button disabled={loading} className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
                {loading ? "Creando..." : "Crear usuario"}
              </button>
            </>
          ) : null}
        </form>
      </section>
    </main>
  );
}
