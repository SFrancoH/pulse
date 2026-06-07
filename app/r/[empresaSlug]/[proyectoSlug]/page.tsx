import { supabaseAdmin } from "@/lib/supabase-admin";
import ProyectoVentaClient from "@/components/ProyectoVentaClient";

type PageProps = {
  params: Promise<{
    empresaSlug: string;
    proyectoSlug: string;
  }>;
};

type BoletaDisponible = {
  id: string;
  numero: string;
};

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];

async function cargarBoletasDisponibles(empresaId: string, proyectoId: string) {
  const { data, error } = await supabaseAdmin
    .from("boletas")
    .select("id,numero")
    .eq("empresa_id", empresaId)
    .eq("proyecto_id", proyectoId)
    .in("estado", ESTADOS_DISPONIBLES)
    .order("numero", { ascending: true })
    .range(0, 999);

  if (error) throw error;

  return (data || []) as BoletaDisponible[];
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
    .select("id,nombre,slug,precio_boleta,formulario_compra_url")
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

  const boletas = await cargarBoletasDisponibles(empresa.id, proyecto.id);

  return (
    <ProyectoVentaClient
      empresaNombre={empresa.nombre}
      proyectoNombre={proyecto.nombre}
      precioBoleta={Number(proyecto.precio_boleta || 0)}
      formularioCompraUrl={proyecto.formulario_compra_url || ""}
      boletas={boletas}
      proyectoId={proyecto.id}
    />
  );
}
