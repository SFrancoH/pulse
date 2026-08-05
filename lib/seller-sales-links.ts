import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type SellerSalesLink = {
  id: string;
  empresa_id: string;
  proyecto_id: string;
  vendedor_user_id: string;
  token: string;
  estado: "activo" | "revocado";
};

const PUBLIC_SALES_PAGE_URL = process.env.PUBLIC_SELLER_SALES_PAGE_URL || "https://javiertoyotas.com/";

function crearToken() {
  return randomBytes(24).toString("base64url");
}

export function crearUrlPublicaDeVendedor(token: string) {
  const url = new URL(PUBLIC_SALES_PAGE_URL);
  url.searchParams.set("r", token);
  return url.toString();
}

export async function getOrCreateSellerSalesLink(input: {
  empresaId: string;
  proyectoId: string;
  vendedorUserId: string;
}) {
  const { data: existente, error: consultaError } = await supabaseAdmin
    .from("seller_sales_links")
    .select("id,empresa_id,proyecto_id,vendedor_user_id,token,estado")
    .eq("empresa_id", input.empresaId)
    .eq("proyecto_id", input.proyectoId)
    .eq("vendedor_user_id", input.vendedorUserId)
    .maybeSingle();

  if (consultaError) throw consultaError;

  if (existente?.estado === "activo") {
    return existente as SellerSalesLink;
  }

  const token = crearToken();

  if (existente) {
    const { data, error } = await supabaseAdmin
      .from("seller_sales_links")
      .update({ token, estado: "activo", updated_at: new Date().toISOString() })
      .eq("id", existente.id)
      .select("id,empresa_id,proyecto_id,vendedor_user_id,token,estado")
      .single();

    if (error) throw error;
    return data as SellerSalesLink;
  }

  const { data, error } = await supabaseAdmin
    .from("seller_sales_links")
    .insert({
      empresa_id: input.empresaId,
      proyecto_id: input.proyectoId,
      vendedor_user_id: input.vendedorUserId,
      token,
      estado: "activo",
    })
    .select("id,empresa_id,proyecto_id,vendedor_user_id,token,estado")
    .single();

  if (error) throw error;
  return data as SellerSalesLink;
}

export async function getActiveSellerSalesLink(token: string) {
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) return null;

  const { data, error } = await supabaseAdmin
    .from("seller_sales_links")
    .select("id,empresa_id,proyecto_id,vendedor_user_id,token,estado")
    .eq("token", token)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) throw error;
  return (data || null) as SellerSalesLink | null;
}
