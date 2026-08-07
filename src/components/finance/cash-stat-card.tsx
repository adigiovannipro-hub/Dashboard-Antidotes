"use client";

import { useState } from "react";
import { Eye, EyeOff, Landmark } from "lucide-react";

import { StatCard } from "@/components/ds/stat-card";
import { CASH_HIDDEN_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/ui-preferences";

/**
 * La carte « Disponible » et l'œil qui masque son montant.
 *
 * Le geste sert à un moment précis : ouvrir son dashboard devant quelqu'un.
 * D'où le défaut « visible » — un chiffre caché par défaut coûterait un clic à
 * chaque ouverture pour un besoin qui, lui, est occasionnel.
 *
 * L'état initial vient du serveur, lu dans un cookie : c'est lui qui rend la
 * première image, et un état gardé dans le stockage local laisserait le
 * montant apparaître le temps d'un battement avant de se cacher — exactement
 * ce que le masque est censé éviter.
 *
 * L'œil est posé **à côté du libellé** et non du chiffre. Les deux avaient été
 * essayés : sur deux colonnes à 390 px, la carte laisse 113 px au montant, et
 * l'œil lui en prenait 22 — assez pour couper « 8 742,19 € » en deux lignes,
 * ou pour se faire tronquer lui-même. La ligne du libellé, elle, est à moitié
 * vide.
 *
 * La carte entière vit donc ici, et non seulement le montant : le libellé et
 * le chiffre sont deux emplacements de `StatCard` que le même état commande.
 */
export function CashStatCard({
  value,
  accountCount,
  initialHidden,
}: {
  value: string | null;
  accountCount: number;
  initialHidden: boolean;
}) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    document.cookie = `${CASH_HIDDEN_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${PREFERENCE_MAX_AGE}; samesite=lax`;
  }

  const Icon = hidden ? EyeOff : Eye;

  return (
    <StatCard
      label={
        <span className="inline-flex items-center gap-1.5">
          Disponible
          <button
            type="button"
            onClick={toggle}
            aria-pressed={hidden}
            title={hidden ? "Afficher le montant" : "Masquer le montant"}
            className="text-text-tertiary hover:text-text-primary focus-visible:ring-ring -my-1 rounded-md p-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon strokeWidth={1.75} className="size-4" aria-hidden />
            <span className="sr-only">
              {hidden
                ? "Afficher le montant disponible"
                : "Masquer le montant disponible"}
            </span>
          </button>
        </span>
      }
      value={
        hidden ? (
          <>
            {/* `--text-secondary` et non `--text-tertiary` : le second est à
                2,79:1, réservé aux icônes. Ces points-là se lisent, ils
                occupent la place du chiffre. `aria-hidden` parce que
                « •••• » se lirait « puce puce puce ». */}
            <span aria-hidden className="text-text-secondary tracking-widest">
              ••••
            </span>
            <span className="sr-only">Montant masqué</span>
          </>
        ) : (
          (value ?? "—")
        )
      }
      context={
        accountCount > 0
          ? `${accountCount} wallet${accountCount > 1 ? "s" : ""} EUR`
          : "aucun compte synchronisé"
      }
      /* Le vert de la charte, en encre lisible — pas la teinte vive. Retiré
         quand le montant est masqué : des points verts n'annoncent rien. */
      valueTone={hidden ? undefined : "accent"}
      icon={Landmark}
    />
  );
}
