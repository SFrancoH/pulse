import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    boletaId: string;
  }>;
};

function ocultarTelefono(telefono?: string | null) {
  if (!telefono) return "No registrado";
  const limpio = telefono.replace(/\D/g, "");
  if (limpio.length <= 4) return telefono;
  return `******${limpio.slice(-4)}`;
}

function formatearCOP(valor?: number | null) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function estadoLabel(estado?: string | null) {
  const value = estado || "desconocido";

  const labels: Record<string, string> = {
    disponible: "Disponible",
    asignada: "Asignada a vendedor",
    reservado: "Reservada",
    abonado: "Abonada",
    pagado: "Pagada",
    cancelado: "Cancelada",
  };

  return labels[value] || value;
}

export default async function BoletaPage({ params }: PageProps) {
  const { boletaId } = await params;

  const { data: boleta, error } = await supabaseAdmin
    .from("boletas")
    .select("id,empresa_id,proyecto_id,numero,estado,nombre_cliente,telefono_cliente,email_cliente,valor_pagado,metodo_pago,pagado_en,vendedor_nombre,vendedor_asignado_en")
    .eq("id", boletaId)
    .single();

  if (error || !boleta) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] px-4 py-10 text-[#1A1A1A]">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">Boleta no encontrada</h1>
          <p className="mt-3 text-[#9A9187]">No fue posible encontrar la información de esta boleta.</p>
        </section>
      </main>
    );
  }

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("nombre,slug")
    .eq("id", boleta.empresa_id)
    .maybeSingle();

  const { data: proyecto } = await supabaseAdmin
    .from("proyectos")
    .select("nombre,slug,precio_boleta")
    .eq("id", boleta.proyecto_id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#F2EDE4] px-4 py-8 text-[#1A1A1A]">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-[#1A1A1A] px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-[3px] text-white/60">Verificación de boleta</p>
          <h1 className="mt-2 text-5xl font-bold">#{boleta.numero}</h1>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-[#E0D9CE] bg-[#F2EDE4] p-5 text-center">
            <p className="text-sm uppercase tracking-[3px] text-[#9A9187]">Estado actual</p>
            <p className="mt-2 text-3xl font-bold text-[#E8620A]">{estadoLabel(boleta.estado)}</p>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="rounded-xl border border-[#E0D9CE] p-4">
              <p className="text-[#9A9187]">Empresa</p>
              <p className="mt-1 text-lg font-semibold">{empresa?.nombre || boleta.empresa_id}</p>
            </div>

            <div className="rounded-xl border border-[#E0D9CE] p-4">
              <p className="text-[#9A9187]">Proyecto</p>
              <p className="mt-1 text-lg font-semibold">{proyecto?.nombre || boleta.proyecto_id}</p>
            </div>

            <div className="rounded-xl border border-[#E0D9CE] p-4">
              <p className="text-[#9A9187]">Comprador</p>
              <p className="mt-1 text-lg font-semibold">{boleta.nombre_cliente || "No registrado"}</p>
            </div>

            <div className="rounded-xl border border-[#E0D9CE] p-4">
              <p className="text-[#9A9187]">Teléfono</p>
              <p className="mt-1 text-lg font-semibold">{ocultarTelefono(boleta.telefono_cliente)}</p>
            </div>

            <div className="rounded-xl border border-[#E0D9CE] p-4">
              <p className="text-[#9A9187]">Valor pagado</p>
              <p className="mt-1 text-lg font-semibold">{formatearCOP(boleta.valor_pagado)}</p>
            </div>

            {boleta.vendedor_nombre && (
              <div className="rounded-xl border border-[#E0D9CE] p-4">
                <p className="text-[#9A9187]">Vendedor asignado</p>
                <p className="mt-1 text-lg font-semibold">{boleta.vendedor_nombre}</p>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-[#9A9187]">
            Esta página muestra el estado registrado actualmente en el sistema.
          </p>
        </div>
      </section>
    </main>
  );
}
