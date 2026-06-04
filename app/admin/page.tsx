"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Proyecto = {
  id: string;
  nombre: string;
  slug: string;
  estado?: string | null;
  flyer_url?: string | null;
  ventas_url: string;
  asignar_vendedor_url: string;
};

type EmpresaGrupo = {
  empresa: {
    id: string;
    nombre: string;
    slug: string;
  };
  proyectos: Proyecto[];
};

type ApiResponse = {
  success: boolean;
  role?: string;
  empresas?: EmpresaGrupo[];
  message?: string;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaGrupo[]>([]);
  const [role, setRole] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/proyectos", {
        cache: "no-store",
      });

      const data = (await res.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.message || "No se pudieron cargar los proyectos.");
      }

      setEmpresas(data.empresas || []);
      setRole(data.role || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[3px] text-[#7A7066]">Panel administrativo</p>
            <h1 className="mt-2 text-4xl font-bold">
              {role === "super_admin" ? "Todos los proyectos" : "Proyectos de tu empresa"}
            </h1>
          </div>

          <Link href="/admin/crear-proyecto" className="rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white">
            Crear nuevo proyecto
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl bg-white p-10 text-center text-lg shadow-sm">
            Cargando proyectos...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && empresas.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            No hay proyectos disponibles.
          </div>
        )}

        <div className="space-y-12">
          {empresas.map((grupo) => (
            <section key={grupo.empresa.id}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">{grupo.empresa.nombre}</h2>

                <Link href="/admin/crear-proyecto" className="rounded-xl border border-[#1A1A1A] bg-white px-5 py-3 font-semibold">
                  Crear nuevo proyecto
                </Link>
              </div>

              {grupo.proyectos.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 shadow-sm">
                  Esta empresa aún no tiene proyectos.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.proyectos.map((proyecto) => (
                    <article key={proyecto.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                      <div className="aspect-[16/10] bg-[#E7DED3]">
                        {proyecto.flyer_url ? (
                          <img src={proyecto.flyer_url} alt={proyecto.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-center text-sm text-[#7A7066]">
                            Sin imagen del proyecto
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="mb-4">
                          <h3 className="text-2xl font-bold">{proyecto.nombre}</h3>
                          <p className="mt-1 text-sm uppercase tracking-[2px] text-[#7A7066]">
                            {proyecto.estado || "Sin estado"}
                          </p>
                        </div>

                        <div className="grid gap-3">
                          <Link href={proyecto.asignar_vendedor_url} className="rounded-2xl bg-[#1A1A1A] px-5 py-4 text-center text-lg font-semibold text-white">
                            Asignar vendedor
                          </Link>

                          <a href={proyecto.ventas_url} className="rounded-2xl bg-[#E8620A] px-5 py-4 text-center text-lg font-semibold text-white">
                            Página de ventas
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
