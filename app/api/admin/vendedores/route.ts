import { getCurrentAdminSession, hashPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CampoEditable = "nombre" | "telefono" | "email" | "password";

function puedeGestionarVendedores(role?: string | null) {
  return role === "super_admin" || role === "empresa_admin";
}

async function obtenerVendedor(vendedorId: string) {
  return supabaseAdmin
    .from("admin_users")
    .select("id,nombre,telefono,email,role,empresa_id,estado")
    .eq("id", vendedorId)
    .maybeSingle();
}

export async function GET() {
  try {
    const session = await getCurrentAdminSession();

    if (!session || !puedeGestionarVendedores(session.rol)) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("admin_users")
      .select("id,nombre,telefono,email,empresa_id")
      .eq("role", "vendedor")
      .eq("estado", "activo")
      .order("nombre", { ascending: true });

    if (session.rol === "empresa_admin") {
      if (!session.empresa_id) {
        return Response.json({ success: false, message: "Usuario sin empresa asignada." }, { status: 403 });
      }

      query = query.eq("empresa_id", session.empresa_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({
      success: true,
      vendedores: (data || []).map((vendedor) => ({
        id: vendedor.id,
        nombre: vendedor.nombre || vendedor.email,
        telefono: vendedor.telefono || "",
        email: vendedor.email || "",
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getCurrentAdminSession();

    if (!session || !puedeGestionarVendedores(session.rol)) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const body = await req.json();
    const vendedorId = String(body.vendedor_id || "").trim();
    const campo = String(body.campo || "").trim() as CampoEditable;
    const valorOriginal = String(body.valor ?? "");

    if (!vendedorId || !["nombre", "telefono", "email", "password"].includes(campo)) {
      return Response.json({ success: false, message: "Solicitud inválida." }, { status: 400 });
    }

    const { data: vendedor, error: vendedorError } = await obtenerVendedor(vendedorId);
    if (vendedorError) throw vendedorError;

    if (!vendedor || vendedor.role !== "vendedor" || vendedor.estado !== "activo") {
      return Response.json({ success: false, message: "Vendedor no encontrado." }, { status: 404 });
    }

    if (session.rol === "empresa_admin" && vendedor.empresa_id !== session.empresa_id) {
      return Response.json({ success: false, message: "No autorizado para modificar este vendedor." }, { status: 403 });
    }

    const updatedAt = new Date().toISOString();
    const cambios: Record<string, string> = { updated_at: updatedAt };

    if (campo === "nombre") {
      const nombre = valorOriginal.trim();
      if (!nombre) {
        return Response.json({ success: false, message: "El nombre no puede estar vacío." }, { status: 400 });
      }
      cambios.nombre = nombre;
    }

    if (campo === "telefono") {
      const telefono = valorOriginal.trim();
      if (!telefono) {
        return Response.json({ success: false, message: "El teléfono no puede estar vacío." }, { status: 400 });
      }
      cambios.telefono = telefono;
    }

    if (campo === "email") {
      const email = valorOriginal.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return Response.json({ success: false, message: "Ingresa un correo válido." }, { status: 400 });
      }
      cambios.email = email;
    }

    if (campo === "password") {
      if (valorOriginal.length < 8) {
        return Response.json(
          { success: false, message: "La contraseña debe tener mínimo 8 caracteres." },
          { status: 400 }
        );
      }
      cambios.password_hash = await hashPassword(valorOriginal);
    }

    const { error: updateError } = await supabaseAdmin
      .from("admin_users")
      .update(cambios)
      .eq("id", vendedorId);

    if (updateError?.code === "23505") {
      return Response.json({ success: false, message: "Ya existe un usuario con ese correo." }, { status: 409 });
    }

    if (updateError) throw updateError;

    if (campo === "nombre") {
      const { error: boletasError } = await supabaseAdmin
        .from("boletas")
        .update({ vendedor_nombre: cambios.nombre, updated_at: updatedAt })
        .eq("vendedor_user_id", vendedorId);

      if (boletasError) {
        await supabaseAdmin
          .from("admin_users")
          .update({ nombre: vendedor.nombre, updated_at: new Date().toISOString() })
          .eq("id", vendedorId);
        throw boletasError;
      }
    }

    const { data: actualizado, error: actualizadoError } = await supabaseAdmin
      .from("admin_users")
      .select("id,nombre,telefono,email")
      .eq("id", vendedorId)
      .maybeSingle();

    if (actualizadoError) throw actualizadoError;

    return Response.json({
      success: true,
      message:
        campo === "password"
          ? "Contraseña actualizada correctamente."
          : `${campo.charAt(0).toUpperCase() + campo.slice(1)} actualizado correctamente.`,
      vendedor: actualizado,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
