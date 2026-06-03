import { getCurrentAdminSession, hashPassword, requireSuperAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROLES = new Set(["super_admin", "empresa_admin"]);

export async function POST(req: Request) {
  try {
    const session = await getCurrentAdminSession();
    requireSuperAdmin(session);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "empresa_admin").trim();
    const empresa_id = String(body.empresa_id || "").trim() || null;

    if (!email || password.length < 8) {
      return Response.json(
        { success: false, message: "Email y contraseña mínima de 8 caracteres son obligatorios." },
        { status: 400 }
      );
    }

    if (!ROLES.has(role)) {
      return Response.json({ success: false, message: "Rol inválido." }, { status: 400 });
    }

    if (role === "empresa_admin" && !empresa_id) {
      return Response.json(
        { success: false, message: "empresa_id es obligatorio para empresa_admin." },
        { status: 400 }
      );
    }

    const password_hash = await hashPassword(password);

    const { error } = await supabaseAdmin
      .from("admin_users")
      .upsert(
        {
          email,
          password_hash,
          role,
          empresa_id: role === "super_admin" ? null : empresa_id,
          estado: "activo",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    if (error) throw error;

    return Response.json({ success: true, message: "Usuario creado correctamente." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message === "No autorizado." ? 403 : 500;
    return Response.json({ success: false, message }, { status });
  }
}
