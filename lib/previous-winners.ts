import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type PreviousWinner = {
  numero: string;
  fecha: string;
  video_url: string;
  poster_url: string | null;
};

// Fuente única: tabla histórica public.ganadores, filtrada por empresa.
export async function getPreviousWinners(empresaId: string): Promise<PreviousWinner[]> {
  const { data, error } = await supabaseAdmin
    .from("ganadores")
    .select("numero,fecha,video_url,poster_url")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("fecha", { ascending: false });

  if (error) {
    console.error("[PreviousWinners] No se pudieron cargar los ganadores.");
    return [];
  }
  return (data || []).filter(w => w.numero && w.fecha && w.video_url) as PreviousWinner[];
}
