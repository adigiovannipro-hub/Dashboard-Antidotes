"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  firstDirectionOf,
  parseBoardSort,
  serializeBoardSort,
  type BoardSortField,
} from "@/lib/billing/board-sort";

/**
 * Le tri d'un groupe, posé sur ses propres en-têtes de colonnes.
 *
 * Un contrôle à part au-dessus des lignes aurait ajouté une rangée à quatre
 * groupes ; l'en-tête de colonnes dit déjà ce qu'il range, il suffit de le
 * rendre cliquable. Le tri vit dans l'URL, sous le nom du groupe — il se
 * partage par lien et survit au retour arrière, comme tous les filtres de
 * l'application.
 *
 * Trois clics font le tour : le sens naturel de la colonne, l'inverse, puis
 * **l'ordre par défaut du groupe** — celui-là encode une décision produit
 * (les retards en bas de « Facturée », les payées du plus récent au plus
 * ancien) et doit rester joignable d'un clic.
 */
export function SortHead({
  param,
  field,
  label,
  align,
  announce,
}: {
  /** Le paramètre d'URL du groupe : un tri local, jamais partagé. */
  param: string;
  field: BoardSortField;
  label: string;
  align?: "right";
  /** Ce que le lecteur d'écran entend, quand le libellé visible porte une
      ponctuation qui s'écoute mal — « Client · Projet ». */
  announce?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = parseBoardSort(searchParams.get(param));
  const active = current?.field === field;
  const naturel = firstDirectionOf(field);

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (!active) {
      next.set(param, serializeBoardSort({ field, direction: naturel }));
    } else if (current.direction === naturel) {
      next.set(
        param,
        serializeBoardSort({ field, direction: naturel === "asc" ? "desc" : "asc" }),
      );
    } else {
      next.delete(param);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Trier par ${announce ?? label.toLowerCase()}`}
      className={cn(
        "focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm transition-colors duration-(--motion-duration) ease-standard hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none",
        active && "text-text-primary",
        align === "right" && "justify-end",
      )}
    >
      {label}
      {active ? (
        current.direction === "asc" ? (
          <ArrowUp aria-hidden strokeWidth={1.75} className="size-3" />
        ) : (
          <ArrowDown aria-hidden strokeWidth={1.75} className="size-3" />
        )
      ) : null}
    </button>
  );
}
