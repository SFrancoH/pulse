import { getCurrentAdminSession, hashPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SUPER_ADMIN_ROLES = new Set(["super_admin", "empresa_admin", "vendedor"]);
const EMPRESA_ADMIN_ROLES = new Set(["vendedor"]);

export async function POST(req: Request) {
  try {
    const session = await getCurrentAdminSession();

    if (!session || (session.rol !== "super_admin" && session.rol !== "empresa_admin")) {
      return Response.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const body = await req.json();
    const nombre = String(body.nombre || "").trim();
    const telefono = String(body.telefono || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "empresa_admin").trim();

    const allowedRoles = session.rol === "super_admin" ? SUPER_ADMIN_ROLES : EMPRESA_ADMIN_ROLES;

    if (!email || password.length < 8) {
      return Response.json(
        { success: false, message: "Email y contraseña mínima de 8 caracteres son obligatorios." },
        { status: 400 }
      );
    }

    if (!allowedRoles.has(role)) {
      return Response.json({ success: false, message: "No puedes crear usuarios con ese rol." }, { status: 403 });
    }

    if (role === "vendedor" && (!nombre || !telefono)) {
      return Response.json(
        { success: false, message: "Nombre y teléfono son obligatorios para los vendedores." },
        { status: 400 }
      );
    }

    let empresaId: string | null = null;

    if (role !== "super_admin") {
      empresaId =
        session.rol === "empresa_admin"
          ? session.empresa_id || null
          : String(body.empresa_id || "").trim() || null;

      if (!empresaId) {
        return Response.json(
          { success: false, message: "No fue posible determinar la empresa del usuario." },
          { status: 400 }
        );
      }
    }

    const password_hash = await hashPassword(password);

    const { error } = await supabaseAdmin
      .from("admin_users")
      .insert({
        nombre: nombre || null,
        telefono: telefono || null,
        email,
        password_hash,
        role,
        empresa_id: role === "super_admin" ? null : empresaId,
        estado: "activo",
        updated_at: new Date().toISOString(),
      });

    if (error?.code === "23505") {
      return Response.json({ success: false, message: "Ya existe un usuario con ese correo." }, { status: 409 });
    }

    if (error) throw error;

    return Response.json({ success: true, message: "Usuario creado correctamente." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
