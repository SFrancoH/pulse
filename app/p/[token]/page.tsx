import PreviousWinners from "@/components/PreviousWinners";
import ProyectoSalesHero from "@/components/ProyectoSalesHero";
import ProyectoVentaReservaClient from "@/components/ProyectoVentaReservaClient";
import { getActiveSellerSalesLink } from "@/lib/seller-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];
const OCTOBER_PROJECT_ID = "z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre";

export default async function SellerPublicSalesPage({ params }: Props) {
  const { token } = await params;
  const link = await getActiveSellerSalesLink(token);

  if (!link) return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;

  const [{ data: empresa }, { data: proyecto }, { data: vendedor }, { data: boletas, error: boletasError }] = await Promise.all([
    supabaseAdmin.from("empresas").select("nombre").eq("id", link.empresa_id).maybeSingle(),
    supabaseAdmin
      .from("proyectos")
      .select("id,nombre,precio_boleta,formulario_compra_url,flyer_url,estado")
      .eq("id", link.proyecto_id)
      .eq("empresa_id", link.empresa_id)
      .eq("estado", "activo")
      .maybeSingle(),
    supabaseAdmin.from("admin_users").select("nombre,email,telefono").eq("id", link.vendedor_user_id).eq("estado", "activo").maybeSingle(),
    supabaseAdmin.from("boletas").select("id,numero").eq("empresa_id", link.empresa_id).eq("proyecto_id", link.proyecto_id).eq("vendedor_user_id", link.vendedor_user_id).in("estado", ESTADOS_DISPONIBLES).order("numero", { ascending: true }).range(0, 999),
  ]);

  if (!empresa || !proyecto || !vendedor || boletasError) {
    return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;
  }

  const vendedorNombre = vendedor.nombre?.trim() || vendedor.email;
  const vendedorTelefono = vendedor.telefono?.trim() || "";
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
        boletasEndpoint={`/api/public/sales-links/${token}/boletas`}
        reservationEndpoint={`/api/public/sales-links/${token}/reserva-temporal`}
        formTrackingParams={{
          ref: token,
          sales_rep: vendedorNombre,
          vendedor_id: link.vendedor_user_id,
          vendedor_nombre: vendedorNombre,
          vendedor_telefono: vendedorTelefono,
        }}
        officeWhatsappUrl="https://wa.me/573147903518"
      />

      {esSorteoOctubre && <PreviousWinners />}
    </>
  );
}
