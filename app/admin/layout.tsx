import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import GestionVendedores from "@/components/GestionVendedores";
import AdminSellerSelectEnhancer from "./AdminSellerSelectEnhancer";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentAdminSession();
  const canManageUsers = session?.rol === "super_admin" || session?.rol === "empresa_admin";

  return (
    <>
      <AdminSellerSelectEnhancer />
      {session && (
        <nav className="sticky top-0 z-[1000] border-b border-[#E0D9CE] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <Link href="/admin" className="font-bold text-[#1A1A1A]">Panel administrativo</Link>
            <div className="flex flex-wrap gap-2">
              {session.rol === "super_admin" && (
                <Link href="/admin/crear-empresa" className="rounded-xl border border-[#1A1A1A] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A]">Crear empresa</Link>
              )}
              {canManageUsers && <GestionVendedores />}
              {canManageUsers && (
                <Link href="/admin/crear-usuario" className="rounded-xl bg-[#E8620A] px-4 py-2 text-sm font-semibold text-white">Crear usuario</Link>
              )}
            </div>
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
