"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Vendedor = {
  id: string;
  nombre?: string | null;
  telefono?: string | null;
  email: string;
};

type VendedoresResponse = {
  success: boolean;
  vendedores?: Vendedor[];
  message?: string;
};

export default function AdminSellerSelectEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/admin\/proyectos\/([^/]+)\/asignar-vendedor$/);
    if (!match) return;

    const proyectoId = match[1];
    let cancelled = false;

    async function enhance() {
      const labels = Array.from(document.querySelectorAll("label"));
      const label = labels.find((item) => item.textContent?.trim() === "Nombre del vendedor");
      const input = label?.parentElement?.querySelector("input");
      if (!label || !input || input.dataset.sellerSelectEnhanced === "true") return;

      input.dataset.sellerSelectEnhanced = "true";

      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/vendedores`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json()) as VendedoresResponse;

        if (!res.ok || !data.success) {
          throw new Error(data.message || "No se pudieron cargar los vendedores.");
        }

        const select = document.createElement("select");
        select.className = input.className;
        select.required = true;
        select.setAttribute("aria-label", "Vendedor");

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = data.vendedores?.length
          ? "Selecciona un vendedor"
          : "No hay vendedores asociados";
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        for (const vendedor of data.vendedores || []) {
          const option = document.createElement("option");
          option.value = vendedor.id;
          const nombre = vendedor.nombre?.trim() || vendedor.email;
          const telefono = vendedor.telefono?.trim();
          option.textContent = telefono ? `${nombre} · ${telefono}` : nombre;
          select.appendChild(option);
        }

        select.disabled = !data.vendedores?.length;
        select.addEventListener("change", () => {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set;
          setter?.call(input, select.value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });

        input.style.display = "none";
        input.insertAdjacentElement("afterend", select);
        label.textContent = "Vendedor";
      } catch (error) {
        input.dataset.sellerSelectEnhanced = "false";
        console.error(error);
      }
    }

    const observer = new MutationObserver(() => {
      if (!cancelled) void enhance();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    void enhance();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
