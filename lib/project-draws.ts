// Calendario de sorteos por proyecto. Hora del sorteo: America/Bogota (UTC-05:00).
// Una fecha del premio mayor es obligatoria; los anticipados pueden ser cero o más.
export type SorteosInput = { premio_mayor: string; anticipados: string[] };
export type SorteosConfig = SorteosInput;

const ISO_COLOMBIA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-05:00$/;
const FECHA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function fechaSorteo(valor: unknown): string {
  if (typeof valor !== "string") throw new Error("Debes indicar fecha y hora de cada sorteo.");
  const match = FECHA_LOCAL.exec(valor.trim());
  if (!match) throw new Error("Las fechas deben incluir día y hora.");
  const [, y, m, d, h, min] = match;
  const fecha = new Date(`${y}-${m}-${d}T${h}:${min}:00-05:00`);
  const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  if (!Number.isFinite(fecha.getTime()) || local.toISOString().slice(0, 16) !== valor.trim()) {
    throw new Error("La fecha del sorteo no es válida.");
  }
  return `${valor.trim()}:00-05:00`;
}

export function validarSorteos(input: unknown): SorteosConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Debes configurar la fecha del premio mayor.");
  }
  const value = input as Record<string, unknown>;
  const premio_mayor = fechaSorteo(value.premio_mayor);
  if (!Array.isArray(value.anticipados)) throw new Error("La lista de anticipados no es válida.");
  if (value.anticipados.length > 100) throw new Error("Puedes configurar hasta 100 anticipados por proyecto.");
  const anticipados = value.anticipados.map(fechaSorteo);
  if (new Set([premio_mayor, ...anticipados]).size !== anticipados.length + 1) {
    throw new Error("Dos sorteos no pueden tener la misma fecha y hora.");
  }
  if (anticipados.some(fecha => new Date(fecha).getTime() >= new Date(premio_mayor).getTime())) {
    throw new Error("Los anticipados deben celebrarse antes del premio mayor.");
  }
  return { premio_mayor, anticipados: anticipados.sort() };
}

export function leerSorteos(raw: unknown): SorteosConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const config = raw as Record<string, unknown>;
  if (typeof config.premio_mayor !== "string" || !ISO_COLOMBIA.test(config.premio_mayor)) return null;
  if (!Array.isArray(config.anticipados) || !config.anticipados.every(s => typeof s === "string" && ISO_COLOMBIA.test(s))) return null;
  return { premio_mayor: config.premio_mayor, anticipados: config.anticipados as string[] };
}

export function fechaFormulario(valor: string): string {
  return valor.slice(0, 16);
}

// Compatibilidad hacia atrás: se consulta en forma separada para que los proyectos existentes
// sigan vendiendo si la migración todavía no está instalada.
export async function leerSorteosProyecto(empresaId: string, proyectoId: string): Promise<SorteosConfig | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { data, error } = await supabaseAdmin
    .from("proyectos")
    .select("sorteos_config")
    .eq("empresa_id", empresaId)
    .eq("id", proyectoId)
    .maybeSingle();
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204" || error.message.includes("sorteos_config")) return null;
    throw error;
  }
  return leerSorteos(data?.sorteos_config);
}
