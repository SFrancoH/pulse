import { createClient } from "@supabase/supabase-js";

/**
 * Cliente PUBLICO de Supabase.
 *
 * Este cliente usa la ANON KEY.
 * Se puede usar en frontend para lectura.
 */
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
