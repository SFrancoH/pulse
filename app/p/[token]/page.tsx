import ProyectoVentaClient from "@/components/ProyectoVentaClient";
import { getActiveSellerSalesLink } from "@/lib/seller-sales-links";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

const ESTADOS_DISPONIBLES = ["Disponible", "disponible"];

export default async function SellerPublicSalesPage({ params }: Props) {
  const { token } = await params;
  const link = await getActiveSellerSalesLink(token);

  if (!link) return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;

  const [{ data: empresa }, { data: proyecto }, { data: vendedor }, { data: boletas, error: boletasError }] = await Promise.all([
    supabaseAdmin.from("empresas").select("nombre").eq("id", link.empresa_id).maybeSingle(),
    supabaseAdmin.from("proyectos").select("nombre,precio_boleta,formulario_compra_url,estado").eq("id", link.proyecto_id).eq("empresa_id", link.empresa_id).eq("estado", "activo").maybeSingle(),
    supabaseAdmin.from("admin_users").select("nombre,email").eq("id", link.vendedor_user_id).eq("estado", "activo").maybeSingle(),
    supabaseAdmin.from("boletas").select("id,numero").eq("empresa_id", link.empresa_id).eq("proyecto_id", link.proyecto_id).eq("vendedor_user_id", link.vendedor_user_id).in("estado", ESTADOS_DISPONIBLES).order("numero", { ascending: true }).range(0, 999),
  ]);

  if (!empresa || !proyecto || !vendedor || boletasError) {
    return <main className="min-h-screen bg-[#F2EDE4] p-10 text-center text-[#1A1A1A]">Enlace de venta no disponible.</main>;
  }

  const vendedorNombre = vendedor.nombre?.trim() || vendedor.email;

  return (
    <ProyectoVentaClient
      empresaNombre={empresa.nombre || ""}
      proyectoNombre={proyecto.nombre || ""}
      precioBoleta={Number(proyecto.precio_boleta || 0)}
      formularioCompraUrl={proyecto.formulario_compra_url || ""}
      boletas={boletas || []}
      boletasEndpoint={`/api/public/sales-links/${token}/boletas`}
      formTrackingParams={{ ref: token, sales_rep: vendedorNombre }}
      officeWhatsappUrl="https://wa.me/573147903518"
    />
  );
}
