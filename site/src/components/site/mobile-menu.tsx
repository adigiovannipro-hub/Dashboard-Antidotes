"use client";

import { useEffect, useRef } from "react";

/**
 * Le menu du téléphone : un `<details>` dans la pastille de l'en-tête, qui
 * déplie un panneau de verre juste dessous. Sans JavaScript il s'ouvre et se
 * ferme quand même ; le script ajoute Échap (le focus revient au bouton), le
 * clic à côté, et la fermeture au choix d'une section.
 */
export function MobileMenu({
  links,
  cta,
  labels,
}: {
  links: { href: string; label: string }[];
  cta: { href: string; label: string };
  labels: { menu: string; close: string };
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = menu.current;
    if (!details) return;
    const close = (focus: boolean) => {
      if (!details.open) return;
      details.open = false;
      if (focus) details.querySelector("summary")?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(details.contains(document.activeElement));
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.contains(event.target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
  };
  return (
    <details ref={menu} className="nav-menu lg:hidden">
      <summary className="nav-toggle">
        <span aria-hidden className="nav-toggle-icon" />
        <span className="nav-toggle-text">
          <span className="nav-toggle-label-closed">{labels.menu}</span>
          <span className="nav-toggle-label-open">{labels.close}</span>
        </span>
      </summary>
      <div className="nav-panel">
        <nav aria-label="Sections" className="flex flex-col">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu} className="nav-panel-link">
              {link.label}
            </a>
          ))}
          <a href={cta.href} onClick={closeMenu} className="btn-primary nav-panel-cta">
            {cta.label}
          </a>
        </nav>
      </div>
    </details>
  );
}
