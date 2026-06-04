import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    empresaSlug: string;
  }>;
};

type Proyecto = {
  id: string;
  nombre: string;
  slug: string;
  estado: string | null;
  flyer_url: string | null;
};

export default async function EmpresaPublicaPage({ params }: PageProps) {
  const { empresaSlug } = await params;

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id,nombre,slug")
    .eq("slug", empresaSlug)
    .maybeSingle();

  if (!empresa) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Empresa no encontrada</h1>
        </section>
      </main>
    );
  }

  const { data: proyectos, error } = await supabaseAdmin
    .from("proyectos")
    .select("id,nombre,slug,estado,flyer_url")
    .eq("empresa_id", empresa.id)
    .eq("estado", "activo")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">No se pudieron cargar los proyectos</h1>
        </section>
      </main>
    );
  }

  const proyectosActivos = (proyectos || []) as Proyecto[];

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl bg-[#1A1A1A] px-6 py-8 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Proyectos activos</p>
          <h1 className="mt-2 text-4xl font-bold">{empresa.nombre}</h1>
          <p className="mt-3 text-white/70">Selecciona un proyecto para ir a la página de ventas.</p>
        </div>

        {proyectosActivos.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            No hay proyectos activos disponibles.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {proyectosActivos.map((proyecto) => {
              const ventasUrl = `/r/${empresa.slug}/${proyecto.slug}`;

              return (
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
                    <h2 className="text-2xl font-bold">{proyecto.nombre}</h2>
                    <p className="mt-1 text-sm uppercase tracking-[2px] text-[#7A7066]">Activo</p>

                    <a href={ventasUrl} className="mt-5 block rounded-2xl bg-[#E8620A] px-5 py-4 text-center text-lg font-semibold text-white">
                      Página de ventas
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
