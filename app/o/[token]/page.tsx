import PreviousWinners from "@/components/PreviousWinners";
import ProyectoSalesHero from "@/components/ProyectoSalesHero";
import ProyectoVentaReservaClient from "@/components/ProyectoVentaReservaClient";
import { getPreviousWinners } from "@/lib/previous-winners";
import { getActiveProjectSalesLink } from "@/lib/project-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const OCTOBER_PROJECT_ID = "z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre";

export default async function OfficePublicSalesPage({ params }: Props) {
  const { token } = await params;
  const proyecto = await getActiveProjectSalesLink(token);

  if (!proyecto) {
    return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;
  }

  const [{ data: empresa }, { data: boletas, error: boletasError }, ganadores] = await Promise.all([
    supabaseAdmin.from("empresas").select("nombre").eq("id", proyecto.empresa_id).maybeSingle(),
    supabaseAdmin
      .from("boletas")
      .select("id,numero")
      .eq("empresa_id", proyecto.empresa_id)
      .eq("proyecto_id", proyecto.id)
      .eq("vendedor_nombre", "Oficina")
      .is("vendedor_user_id", null)
      .in("estado", ESTADOS_DISPONIBLES)
      .order("numero", { ascending: true })
      .range(0, 999),
    getPreviousWinners(proyecto.empresa_id),
  ]);

  if (!empresa || boletasError) {
    return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;
  }

  const esSorteoOctubre = proyecto.id === OCTOBER_PROJECT_ID;

  return (
    <>
      <ProyectoSalesHero
        proyectoNombre={proyecto.nombre || ""}
        flyerUrl={proyecto.flyer_url}
        showOctoberPromo={esSorteoOctubre}
      />

      <ProyectoVentaReservaClient
        empresaNombre={empresa.nombre || ""}
        proyectoNombre={proyecto.nombre || ""}
        precioBoleta={Number(proyecto.precio_boleta || 0)}
        formularioCompraUrl={proyecto.formulario_compra_url || ""}
        boletas={boletas || []}
        boletasEndpoint={`/api/public/project-sales/${token}/boletas`}
        reservationEndpoint={`/api/public/project-sales/${token}/reserva-temporal`}
        formTrackingParams={{ ref: token, sales_rep: "Oficina" }}
      />

      <PreviousWinners winners={ganadores} />
    </>
  );
}
