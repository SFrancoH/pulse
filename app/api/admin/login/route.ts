import { cookies } from "next/headers";
import { createAdminSessionToken, getSessionCookieName } from "@/lib/auth-token";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "");

    if (email !== adminEmail || password !== adminPassword) {
      return Response.json({ success: false, message: "Credenciales inválidas." }, { status: 401 });
    }

    const token = createAdminSessionToken({
      email,
      rol: "super_admin",
      empresa_id: null,
    });

    const cookieStore = await cookies();

    cookieStore.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, message: "Error interno." }, { status: 500 });
  }
}
