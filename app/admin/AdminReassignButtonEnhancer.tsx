"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = {
  enabled: boolean;
};

export default function AdminReassignButtonEnhancer({ enabled }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled || pathname !== "/admin") return;

    let cancelled = false;

    function enhance() {
      const baseDatosLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href^="/admin/proyectos/"][href$="/base-datos"], a[href*="/admin/proyectos/"][href$="/base-datos"]'
        )
      );

      for (const baseDatosLink of baseDatosLinks) {
        const href = baseDatosLink.getAttribute("href") || "";
        const match = href.match(/\/admin\/proyectos\/([^/]+)\/base-datos$/);
        const proyectoId = match?.[1];
        const container = baseDatosLink.parentElement;

        if (!proyectoId || !container) continue;

        const existente = Array.from(
          container.querySelectorAll<HTMLAnchorElement>("a[data-reassign-project]")
        ).some((item) => item.dataset.reassignProject === proyectoId);

        if (existente) continue;

        const link = document.createElement("a");
        link.href = `/admin/proyectos/${proyectoId}/reasignar-numero`;
        link.textContent = "Liberar / reasignar número";
        link.className =
          "rounded-2xl border border-[#E8620A] bg-white px-5 py-4 text-center text-lg font-semibold text-[#E8620A]";
        link.dataset.reassignProject = proyectoId;

        container.insertBefore(link, baseDatosLink);
      }
    }

    const observer = new MutationObserver(() => {
      if (!cancelled) enhance();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    enhance();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [enabled, pathname]);

  return null;
}
