import { cookies } from "next/headers";
import { getSessionCookieName } from "@/lib/auth-token";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: getSessionCookieName(),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return Response.json({ success: true });
}
