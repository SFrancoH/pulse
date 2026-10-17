import { BOLETA_LIBRE_FILTER } from "@/lib/boleta-availability";
import { extraerSolicitudNumerosAleatorios, validarBearerBoleta } from "@/lib/ghl-boleta-update-payload";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Boleta = { numero: string };

// GET: formato de consulta natural para GHL Custom Webhook con QUERY PARAMETERS.
// POST: conserva compatibilidad con workflows ya configurados con CUSTOM DATA.
// Ambos métodos exigen el mismo Bearer y entregan idéntico formato.
function noAutorizado() {
  return Response.json({ success: false, message: "No autorizado." }, { status: 401 });
}

export async function GET(req: Request) {
  if (!validarBearerBoleta(req, process.env.PULSE_CALLBACK_SECRET || "")) {
    return noAutorizado();
  }

  const url = new URL(req.url);
  return consultarNumeros(Object.fromEntries(url.searchParams.entries()));
}

export async function POST(req: Request) {
  if (!validarBearerBoleta(req, process.env.PULSE_CALLBACK_SECRET || "")) {
    return noAutorizado();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({
      success: false, message: "JSON inválido.", campos_invalidos: ["body"],
    }, { status: 400 });
  }

  return consultarNumeros(body);
}

async function consultarNumeros(body: unknown) {
  const { empresa_id, proyecto_id, cantidad, formato, campos_invalidos } =
    extraerSolicitudNumerosAleatorios(body);
  if (campos_invalidos.length) {
    return Response.json({
      success: false, message: "Datos inválidos.", campos_invalidos,
    }, { status: 400 });
  }

  try {
    const { data: proyecto, error: proyectoError } = await supabaseAdmin
      .from("proyectos")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("id", proyecto_id)
      .maybeSingle();
    if (proyectoError) throw proyectoError;
    if (!proyecto) {
      return Response.json({
        success: false, message: "Proyecto no encontrado para esa empresa.",
      }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("boletas")
      .select("numero")
      .eq("empresa_id", empresa_id)
      .eq("proyecto_id", proyecto_id)
      .eq("estado", "Disponible")
      .or(BOLETA_LIBRE_FILTER)
      .eq("vendedor_nombre", "Oficina")
      .is("vendedor_user_id", null)
      .order("numero", { ascending: true })
      .limit(10000);
    if (error) throw error;

    const disponibles = [...(data || [])] as Boleta[];
    // Fisher-Yates: misma distribución, formato y restricciones que la ruta anterior.
    for (let i = disponibles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
    }
    const numeros = disponibles.slice(0, cantidad)
      .map((boleta) => String(boleta.numero ?? "").trim().padStart(4, "0"));
    const grupos: string[][] = [[], [], []];
    numeros.forEach((numero, index) => grupos[index % 3].push(numero));
    const numeros_texto = grupos.map((grupo) => grupo.join(" - ")).join(" | ");

    if (formato === "texto") {
      return new Response(numeros_texto, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return Response.json({
      success: true,
      proyecto_id,
      cantidad_solicitada: cantidad,
      cantidad_encontrada: numeros.length,
      numeros,
      grupos,
      numeros_texto,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({
      success: false, message: "No fue posible consultar números disponibles.",
    }, { status: 500 });
  }
}
