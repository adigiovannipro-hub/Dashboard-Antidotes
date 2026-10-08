"use client";

import { useEffect, useId, useState } from "react";

export function MobileMenu({
  links,
  cta,
  labels,
}: {
  links: { href: string; label: string }[];
  cta: { href: string; label: string };
  labels: { menu: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="type-small rounded-pill border border-line px-3 py-1.5 text-text"
      >
        {open ? labels.close : labels.menu}
      </button>
      {open ? (
        <div id={id} className="absolute inset-x-0 top-16 border-b border-line bg-ink-0/95 backdrop-blur-xl">
          <nav aria-label="Sections" className="container-site flex flex-col gap-1 py-4">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="type-body rounded-md px-2 py-3 text-text-2 hover:text-text">
                {link.label}
              </a>
            ))}
            <a href={cta.href} onClick={() => setOpen(false)} className="type-body mt-2 rounded-pill bg-text px-4 py-3 text-center font-medium text-text-on-light">
              {cta.label}
            </a>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
