"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { CASH_HIDDEN_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/ui-preferences";

/**
 * Le montant disponible, et l'œil qui le masque.
 *
 * Le geste sert à un moment précis : ouvrir son dashboard devant quelqu'un.
 * D'où le défaut « visible » — un chiffre caché par défaut coûterait un clic à
 * chaque ouverture pour un besoin qui, lui, est occasionnel.
 *
 * L'état initial vient du serveur, lu dans un cookie : c'est lui qui rend la
 * première image, et un état gardé dans le stockage local laisserait le
 * montant apparaître le temps d'un battement avant de se cacher — exactement
 * ce que le masque est censé éviter.
 */
export function CashAmount({
  value,
  initialHidden,
}: {
  value: string | null;
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
    <span className="flex items-center gap-2">
      {/* `aria-hidden` sur les points : « •••• » se lirait « puce puce puce ».
          Le texte pour lecteur d'écran dit ce qu'il en est. */}
      {hidden ? (
        <>
          <span aria-hidden className="text-text-tertiary tracking-widest">
            ••••
          </span>
          <span className="sr-only">Montant masqué</span>
        </>
      ) : (
        (value ?? "—")
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={hidden}
        title={hidden ? "Afficher le montant" : "Masquer le montant"}
        className="text-text-tertiary hover:text-text-primary focus-visible:ring-ring rounded-md p-0.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon strokeWidth={1.75} className="size-4.5" aria-hidden />
        <span className="sr-only">
          {hidden ? "Afficher le montant disponible" : "Masquer le montant disponible"}
        </span>
      </button>
    </span>
  );
}
