import { hashPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "");
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN || "";

    if (!expected || token !== expected) {
      return Response.json({ success: false, message: "Token inválido." }, { status: 401 });
    }

    if (!email || password.length < 8) {
      return Response.json({ success: false, message: "Email y contraseña mínima de 8 caracteres son obligatorios." }, { status: 400 });
    }

    const { count, error: countError } = await supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return Response.json({ success: false, message: "Bootstrap bloqueado: ya existe un super_admin." }, { status: 403 });
    }

    const password_hash = await hashPassword(password);

    const { error } = await supabaseAdmin.from("admin_users").insert({
      email,
      password_hash,
      role: "super_admin",
      empresa_id: null,
      estado: "activo",
    });

    if (error) throw error;

    return Response.json({ success: true, message: "Super admin creado correctamente." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
