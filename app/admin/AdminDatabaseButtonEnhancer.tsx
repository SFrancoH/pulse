"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AdminDatabaseButtonEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/admin") return;

    function enhance() {
      const buttons = Array.from(document.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Actualizar base de datos"
      );

      for (const button of buttons) {
        if (button.dataset.databaseEnhanced === "true") continue;
        const article = button.closest("article");
        const assignLink = article?.querySelector<HTMLAnchorElement>('a[href*="/admin/proyectos/"][href$="/asignar-vendedor"]');
        const match = assignLink?.getAttribute("href")?.match(/\/admin\/proyectos\/([^/]+)\/asignar-vendedor$/);
        if (!match) continue;

        const link = document.createElement("a");
        link.href = `/admin/proyectos/${match[1]}/base-datos`;
        link.className = button.className;
        link.textContent = "Gestionar base de datos";
        link.style.display = "block";
        link.style.textAlign = "center";
        button.dataset.databaseEnhanced = "true";
        button.replaceWith(link);
      }
    }

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
