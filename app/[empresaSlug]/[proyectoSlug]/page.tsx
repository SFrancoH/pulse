import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    empresaSlug: string;
    proyectoSlug: string;
  }>;
};

function formatearCOP(valor?: number | null) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

export default async function ProyectoPage({ params }: PageProps) {
  const { empresaSlug, proyectoSlug } = await params;

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id,nombre,slug")
    .eq("slug", empresaSlug)
    .maybeSingle();

  if (!empresa) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Empresa no encontrada</h1>
        </section>
      </main>
    );
  }

  const { data: proyecto } = await supabaseAdmin
    .from("proyectos")
    .select("id,nombre,slug,precio_boleta,descripcion_landing,imagen_principal_url")
    .eq("empresa_id", empresa.id)
    .eq("slug", proyectoSlug)
    .maybeSingle();

  if (!proyecto) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Proyecto no encontrado</h1>
        </section>
      </main>
    );
  }

  const { data: boletas } = await supabaseAdmin
    .from("boletas")
    .select("id,numero,estado")
    .eq("empresa_id", empresa.id)
    .eq("proyecto_id", proyecto.id)
    .eq("estado", "disponible")
    .order("numero", { ascending: true })
    .limit(300);

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
      <section className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b border-[#E0D9CE] px-6 py-8">
          <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">{empresa.nombre}</p>
          <h1 className="mt-3 text-5xl font-bold">{proyecto.nombre}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#6F665C]">
            <div className="rounded-full border border-[#E0D9CE] px-4 py-2">
              Valor boleta: {formatearCOP(proyecto.precio_boleta)}
            </div>

            <div className="rounded-full border border-[#E0D9CE] px-4 py-2">
              Disponibles: {boletas?.length || 0}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {(boletas || []).map((boleta) => (
              <Link
                key={boleta.id}
                href={`/boleta/${boleta.id}`}
                className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] px-4 py-5 text-center transition hover:border-[#E8620A] hover:bg-[#FFF4EC]"
              >
                <p className="text-xs uppercase tracking-[2px] text-[#9A9187]">Boleta</p>
                <p className="mt-2 text-2xl font-bold">{boleta.numero}</p>
                <p className="mt-2 text-xs text-[#E8620A]">Disponible</p>
              </Link>
            ))}
          </div>

          {(!boletas || boletas.length === 0) && (
            <div className="rounded-2xl border border-[#E0D9CE] bg-[#F9F6F1] p-10 text-center text-[#6F665C]">
              No hay boletas disponibles actualmente.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
