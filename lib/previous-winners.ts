import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type PreviousWinner = {
  numero: string;
  fecha: string;
  video_url: string;
  poster_url: string | null;
};

// Los ganadores son de la empresa, nunca del vendedor ni de la empresa vecina.
// Se conservan los registros históricos de "ganadores" sin modificar esa tabla.
export async function getPreviousWinners(empresaId: string): Promise<PreviousWinner[]> {
  const [historicos, nuevos] = await Promise.all([
    supabaseAdmin.from("ganadores")
      .select("numero,fecha,video_url,poster_url")
      .eq("empresa_id", empresaId).eq("activo", true)
      .order("orden", { ascending: true }).order("fecha", { ascending: false }),
    supabaseAdmin.from("pulse_ganadores_publicos")
      .select("numero,fecha,video_url,poster_url")
      .eq("empresa_id", empresaId).eq("activo", true)
      .order("fecha", { ascending: false }),
  ]);

  if (historicos.error) console.error("[PreviousWinners] No se pudieron cargar los ganadores anteriores.");
  if (nuevos.error && !/pulse_ganadores_publicos/.test(nuevos.error.message)) {
    console.error("[PreviousWinners] No se pudieron cargar los ganadores administrados.");
  }

  const registros = [...(nuevos.data || []), ...(historicos.data || [])];
  const claves = new Set<string>();
  return registros
    .filter(v => v.numero && v.fecha && v.video_url)
    .filter(v => {
      const clave = [v.numero, v.fecha, v.video_url].join("|");
      if (claves.has(clave)) return false;
      claves.add(clave);
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha)) as PreviousWinner[];
}
