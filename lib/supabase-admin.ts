import { createClient } from "@supabase/supabase-js";

/**
 * Cliente PRIVADO de Supabase.
 *
 * Usa la SERVICE ROLE KEY.
 *
 * Esta llave tiene acceso completo a la base de datos,
 * por eso SOLO debe usarse en backend.
 *
 * Nunca importes este archivo en componentes visuales.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
