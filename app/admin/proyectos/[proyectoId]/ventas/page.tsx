import AdminSalesReservationMonitor from "@/components/AdminSalesReservationMonitor";
import PreviousWinners from "@/components/PreviousWinners";
import ProyectoSalesHero from "@/components/ProyectoSalesHero";
import ProyectoVentaReservaClient from "@/components/ProyectoVentaReservaClient";
import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = {
  params: Promise<{
    proyectoId: string;
  }>;
};

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const OCTOBER_PROJECT_ID = "z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre";

export default async function AdminProjectSalesPage({ params }: Props) {
  const { proyectoId } = await params;
  const baselineReservas = new Date().toISOString();
  const { proyecto: proyectoAutorizado, error: authError } = await requireProjectManagerAccess(proyectoId);

  if (authError || !proyectoAutorizado) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">
        No tienes permisos para acceder a esta página de ventas.
      </main>
    );
  }

  const [{ data: proyecto, error: proyectoError }, { data: empresa }, { data: boletas, error: boletasError }] =
    await Promise.all([
      supabaseAdmin
        .from("proyectos")
        .select("id,empresa_id,nombre,precio_boleta,formulario_compra_url,flyer_url,sales_token,estado")
        .eq("id", proyectoId)
        .eq("empresa_id", proyectoAutorizado.empresa_id)
        .maybeSingle(),
      supabaseAdmin
        .from("empresas")
        .select("nombre")
        .eq("id", proyectoAutorizado.empresa_id)
        .maybeSingle(),
      supabaseAdmin
        .from("boletas")
        .select("id,numero")
        .eq("empresa_id", proyectoAutorizado.empresa_id)
        .eq("proyecto_id", proyectoId)
        .eq("vendedor_nombre", "Oficina")
        .is("vendedor_user_id", null)
        .in("estado", ESTADOS_DISPONIBLES)
        .order("numero", { ascending: true })
        .range(0, 999),
    ]);

  if (!proyecto || proyectoError || !empresa || boletasError) {
    return (
      <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">
        No fue posible cargar la página de ventas del proyecto.
      </main>
    );
  }

  const esSorteoOctubre = proyecto.id === OCTOBER_PROJECT_ID;

  return (
    <>
      <div className="sticky top-0 z-[800] border-b border-[#D8CFC3] bg-[#1A1A1A] px-4 py-2 text-center text-sm font-semibold text-white">
        Modo administrativo · Las nuevas reservas bloquearán esta pantalla hasta actualizar los números.
      </div>

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
        boletasEndpoint={`/api/public/project-sales/${proyecto.sales_token}/boletas`}
        reservationEndpoint={`/api/admin/proyectos/${proyectoId}/reserva-temporal`}
        formTrackingParams={{
          ref: proyecto.sales_token,
          sales_rep: "Creacion Manual",
          vendedor_nombre: "Creacion Manual",
        }}
      />

      {esSorteoOctubre && <PreviousWinners />}

      <AdminSalesReservationMonitor proyectoId={proyectoId} baseline={baselineReservas} />
    </>
  );
}
