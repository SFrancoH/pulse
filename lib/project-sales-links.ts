import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ProjectSalesLink = {
  id: string;
  empresa_id: string;
  nombre: string;
  slug: string;
  precio_boleta: number | null;
  formulario_compra_url: string | null;
  flyer_url: string | null;
  sales_token: string;
  estado: string | null;
};

const PUBLIC_PROJECT_SALES_PAGE_URL =
  process.env.PUBLIC_PROJECT_SALES_PAGE_URL ||
  process.env.PUBLIC_SELLER_SALES_PAGE_URL ||
  "https://javiertoyotas.com/proyecto";

export function crearProjectSalesToken() {
  return randomBytes(24).toString("base64url");
}

export function crearUrlPublicaDeProyecto(token: string) {
  const url = new URL(PUBLIC_PROJECT_SALES_PAGE_URL);
  url.searchParams.set("o", token);
  return url.toString();
}

export async function getActiveProjectSalesLink(token: string) {
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) return null;

  const { data, error } = await supabaseAdmin
    .from("proyectos")
    .select("id,empresa_id,nombre,slug,precio_boleta,formulario_compra_url,flyer_url,sales_token,estado")
    .eq("sales_token", token)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) throw error;
  return (data || null) as ProjectSalesLink | null;
}
