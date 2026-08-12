import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    empresaSlug: string;
    proyectoSlug: string;
  }>;
};

export default async function ProyectoPage({ params }: PageProps) {
  const { empresaSlug, proyectoSlug } = await params;

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
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
    .select("sales_token")
    .eq("empresa_id", empresa.id)
    .eq("slug", proyectoSlug)
    .eq("estado", "activo")
    .maybeSingle();

  if (!proyecto?.sales_token) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Proyecto no encontrado</h1>
        </section>
      </main>
    );
  }

  redirect(`/o/${encodeURIComponent(proyecto.sales_token)}`);
}
