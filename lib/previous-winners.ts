import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type PreviousWinner = {
  numero: string;
  fecha: string;
  video_url: string;
  poster_url: string | null;
};

export async function getPreviousWinners(empresaId: string): Promise<PreviousWinner[]> {
  const { data, error } = await supabaseAdmin
    .from("ganadores")
    .select("numero,fecha,video_url,poster_url")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("fecha", { ascending: false });

  if (error) {
    console.error("[PreviousWinners] No se pudieron cargar los ganadores.", {
      empresaId,
      message: error.message,
    });
    return [];
  }

  return (data || []).filter((winner) => winner.numero && winner.fecha && winner.video_url) as PreviousWinner[];
}
