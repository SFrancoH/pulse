import { createClient } from "@supabase/supabase-js";

/**
 * Cliente PRIVADO de Supabase.
 *
 * Este archivo solo se usa en backend: rutas /api y server code.
 *
 * Acepta tanto las variables manuales como las que crea la integración
 * nativa de Supabase + Vercel.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Falta la URL de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL en Vercel."
  );
}

if (!supabaseServiceKey) {
  throw new Error(
    "Falta la llave privada de Supabase. Configura SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY o SUPABASE_SECRET_KEY en Vercel."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
