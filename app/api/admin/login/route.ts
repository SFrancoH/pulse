import { cookies } from "next/headers";
import { createAdminSessionToken, getSessionCookieName } from "@/lib/auth-token";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPassword } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const requestOrigin = req.headers.get("origin");
    const expectedOrigin = new URL(req.url).origin;

    if (requestOrigin && requestOrigin !== expectedOrigin) {
      return Response.json({ success: false, message: "Origen no autorizado." }, { status: 403 });
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const { data: user, error } = await supabaseAdmin
      .from("admin_users")
      .select("email,password_hash,role,empresa_id,estado")
      .eq("email", email)
      .maybeSingle();

    if (error || !user || user.estado !== "activo") {
      return Response.json({ success: false, message: "Credenciales inválidas." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      return Response.json({ success: false, message: "Credenciales inválidas." }, { status: 401 });
    }

    const token = createAdminSessionToken({
      email: user.email,
      rol: user.role,
      empresa_id: user.empresa_id,
    });

    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      partitioned: isProduction,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return Response.json({
      success: true,
      redirect_to: "/admin",
      role: user.role,
    });
  } catch {
    return Response.json({ success: false, message: "Error interno." }, { status: 500 });
  }
}
