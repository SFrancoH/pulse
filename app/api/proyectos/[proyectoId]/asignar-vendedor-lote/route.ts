import { requireProjectManagerAccess } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Payload = {
  vendedor_user_id?: string;
  vendedor_nombre?: string;
  numeros?: string[];
};

type Vendedor = {
  id: string;
  empresa_id: string;
  nombre: string | null;
  telefono: string | null;
  email: string;
};

function normalizarNumero(valor: string) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) return "";
  return limpio.padStart(4, "0").slice(-4);
}

function extraerNumeroEscaneado(valor: string, proyectoId: string) {
  const texto = String(valor || "").trim();

  if (texto.includes("|")) {
    const [proyectoEscaneado, numeroEscaneado] = texto.split("|");

    if (proyectoEscaneado && proyectoEscaneado !== proyectoId) {
      return {
        numero: "",
        error: `El código pertenece a otro proyecto: ${proyectoEscaneado}`,
      };
    }

    return {
      numero: normalizarNumero(numeroEscaneado || ""),
      error: "",
    };
  }

  return {
    numero: normalizarNumero(texto),
    error: "",
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function esUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function buscarVendedor(empresaId: string, identificador: string): Promise<Vendedor | null> {
  const campos = "id,empresa_id,nombre,telefono,email";

  if (esUuid(identificador)) {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select(campos)
      .eq("id", identificador)
      .eq("empresa_id", empresaId)
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .maybeSingle();

    if (error) throw error;
    if (data) return data as Vendedor;
  }

  const email = identificador.trim().toLowerCase();
  if (email.includes("@")) {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select(campos)
      .eq("email", email)
      .eq("empresa_id", empresaId)
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .maybeSingle();

    if (error) throw error;
    if (data) return data as Vendedor;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(campos)
    .eq("nombre", identificador.trim())
    .eq("empresa_id", empresaId)
    .eq("role", "vendedor")
    .eq("estado", "activo")
    .limit(2);

  if (error) throw error;
  if ((data || []).length === 1) return data![0] as Vendedor;
  if ((data || []).length > 1) {
    throw new Error("Hay más de un vendedor con ese nombre. Selecciónalo desde la lista usando su ID.");
  }

  return null;
}

export async function POST(req: Request, { params }: PageProps) {
  const errores: string[] = [];

  try {
    const { proyectoId } = await params;
    const auth = await requireProjectManagerAccess(proyectoId);
    if (auth.error || !auth.session || !auth.proyecto) return auth.error;

    const session = auth.session;
    const proyecto = auth.proyecto;
    const body = (await req.json()) as Payload;
    const identificadorVendedor = String(body.vendedor_user_id || body.vendedor_nombre || "").trim();
    const numerosRaw = Array.isArray(body.numeros) ? body.numeros : [];

    if (!identificadorVendedor) {
      return Response.json({ success: false, message: "Debes seleccionar un vendedor." }, { status: 400 });
    }

    if (numerosRaw.length === 0) {
      return Response.json({ success: false, message: "Debes enviar al menos un número." }, { status: 400 });
    }

    const vendedor = await buscarVendedor(proyecto.empresa_id, identificadorVendedor);
    if (!vendedor) {
      return Response.json(
        { success: false, message: "El vendedor no existe, no está activo o no pertenece a la empresa del proyecto." },
        { status: 400 }
      );
    }

    const vendedorNombre = vendedor.nombre?.trim() || vendedor.email;

    const numeros = Array.from(
      new Set(
        numerosRaw
          .map((item) => {
            const resultado = extraerNumeroEscaneado(item, proyectoId);
            if (resultado.error) errores.push(resultado.error);
            return resultado.numero;
          })
          .filter(Boolean)
      )
    );

    if (numeros.length === 0) {
      return Response.json({ success: false, message: errores[0] || "No se encontraron números válidos.", errores }, { status: 400 });
    }

    const { data: boletas, error: boletasError } = await supabaseAdmin
      .from("boletas")
      .select("id,empresa_id,proyecto_id,numero,estado")
      .eq("proyecto_id", proyectoId)
      .eq("empresa_id", proyecto.empresa_id)
      .in("numero", numeros);

    if (boletasError) {
      return Response.json({ success: false, message: `Error consultando boletas: ${boletasError.message}` }, { status: 500 });
    }

    const encontradasLista = boletas || [];
    const asignables = encontradasLista.filter(
      (boleta) => String(boleta.estado || "").toLowerCase() === "disponible"
    );
    const idsAsignables = asignables.map((boleta) => boleta.id);

    if (idsAsignables.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("boletas")
        .update({
          estado: "No disponible",
          canal: "Vendedores",
          vendedor_nombre: vendedorNombre,
          vendedor_user_id: vendedor.id,
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", proyecto.empresa_id)
        .eq("proyecto_id", proyectoId)
        .in("id", idsAsignables);

      if (updateError) {
        return Response.json({ success: false, message: `Error actualizando boletas: ${updateError.message}` }, { status: 500 });
      }
    }

    if (asignables.length > 0) {
      const ordenadas = [...asignables].sort((a, b) => a.numero.localeCompare(b.numero));

      const { error: historialError } = await supabaseAdmin
        .from("asignaciones_vendedores")
        .insert({
          empresa_id: proyecto.empresa_id,
          proyecto_id: proyectoId,
          vendedor_user_id: vendedor.id,
          asignado_por_user_id: session.user_id || null,
          vendedor_nombre: vendedorNombre,
          numero_desde: ordenadas[0].numero,
          numero_hasta: ordenadas[ordenadas.length - 1].numero,
          cantidad: asignables.length,
          boleta_inicial_id: ordenadas[0].id,
        });

      if (historialError) {
        errores.push(`Historial: ${historialError.message}`);
      }
    }

    const encontradas = encontradasLista.length;
    const asignadas = asignables.length;
    const noEncontradas = numeros.filter((numero) => !encontradasLista.some((boleta) => boleta.numero === numero));

    return Response.json({
      success: true,
      message: "Asignación por lote procesada correctamente.",
      vendedor_user_id: vendedor.id,
      vendedor_nombre: vendedorNombre,
      solicitadas: numeros.length,
      encontradas,
      asignadas,
      omitidas: encontradas - asignadas,
      no_encontradas: noEncontradas,
      errores,
    });
  } catch (error: unknown) {
    return Response.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
  }
}
