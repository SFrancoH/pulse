import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    boletaId: string;
  }>;
};

export default async function AsignarBoletaPage({ params }: PageProps) {
  const { boletaId } = await params;

  const { data: boleta, error } = await supabaseAdmin
    .from("boletas")
    .select("id,empresa_id,proyecto_id,numero,estado,vendedor_nombre")
    .eq("id", boletaId)
    .single();

  if (error || !boleta) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Boleta no encontrada</h1>
          <p className="mt-3 text-[#9A9187]">No fue posible encontrar la boleta para asignación.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
      <section className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Asignación de vendedor</p>
          <h1 className="mt-2 text-5xl font-bold">#{boleta.numero}</h1>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-[#E0D9CE] bg-[#F2EDE4] p-5 text-center">
            <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">Estado actual</p>
            <p className="mt-2 text-2xl font-bold text-[#E8620A]">{boleta.estado}</p>
          </div>

          <form
            className="mt-6 space-y-4"
            action="/api/asignar-vendedor"
            method="POST"
          >
            <input type="hidden" name="boleta_id" value={boleta.id} />

            <div>
              <label className="mb-2 block text-sm font-medium">
                Nombre del vendedor
              </label>
              <input
                type="text"
                name="vendedor_nombre"
                required
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Asignar hasta el número (opcional)
              </label>
              <input
                type="text"
                name="numero_hasta"
                placeholder="Ej: 5600"
                className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none"
              />
              <p className="mt-2 text-xs text-[#9A9187]">
                Si este campo está vacío, solo se asignará la boleta {boleta.numero}.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#E8620A] px-6 py-4 text-lg font-semibold text-white"
            >
              Asignar boletas
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
