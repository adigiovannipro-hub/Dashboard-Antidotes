"use client";

import { useId, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";

import { formatDayFr, maskDayFr, parseDayFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Un champ de date qui se tape en JJ/MM/AAAA et s'ouvre au clic du calendrier.
 *
 * Deux raisons de ne pas se contenter d'un `<input type="date">` :
 *
 *   • **Le format suit le navigateur, pas la page.** Le même écran montre
 *     05/08/2026 à Paris et 08/05/2026 à New York, sans rien pour les
 *     distinguer. Le texte est donc rendu ici, en français, toujours.
 *   • **Le calendrier ne s'ouvre pas où on croit.** Chrome ne le déplie qu'au
 *     clic sur sa petite icône, dont la zone est minuscule et invisible au
 *     survol ; ailleurs dans le champ, le clic ne fait que placer le curseur.
 *
 * D'où la construction : un champ texte pour la frappe, un bouton explicite
 * pour le calendrier, et un `<input type="date">` réduit à un point,
 * uniquement là pour porter le sélecteur natif du système. Ce n'est pas un
 * contournement de plus — c'est le seul moyen d'avoir le sélecteur de
 * l'appareil (précieux au doigt, sur téléphone) sans en subir le format.
 *
 * La valeur échangée est toujours l'ISO `AAAA-MM-JJ`, celui de l'URL et de la
 * base. `null` signifie « pas de borne », pas « date invalide » : tant que la
 * saisie est incomplète, le champ garde son texte et ne remonte rien — sans
 * quoi taper « 05 » filtrerait sur l'an 5.
 */
export function DateField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  className?: string;
}) {
  const fieldId = useId();
  const nativeRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatDayFr(value));

  /* La valeur peut changer sans passer par la frappe — bouton
     « Réinitialiser », retour arrière du navigateur, lien partagé. Le champ
     suit alors l'URL, qui fait autorité.
     Ajusté pendant le rendu et non dans un effet : React redémarre alors le
     rendu immédiatement, sans passer par un affichage intermédiaire où le
     champ montrerait encore l'ancienne date. */
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatDayFr(value));
  }

  function handleText(raw: string) {
    const masked = maskDayFr(raw);
    setText(masked);

    if (masked === "") {
      onChange(null);
      return;
    }
    const iso = parseDayFr(masked);
    if (iso) onChange(iso);
  }

  function openPicker() {
    const native = nativeRef.current;
    if (!native) return;
    try {
      native.showPicker();
    } catch {
      // Navigateur sans `showPicker` : le focus déplie le sélecteur sur la
      // plupart des mobiles, et ne coûte rien ailleurs.
      native.focus();
    }
  }

  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={fieldId} className="type-overline text-text-secondary">
        {label}
      </label>

      <div className="border-border-line bg-surface focus-within:ring-ring relative flex h-10 items-center rounded-md border focus-within:ring-2">
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="JJ/MM/AAAA"
          value={text}
          onChange={(event) => handleText(event.target.value)}
          /* Le calendrier s'ouvre aussi au clic sur le champ, pas seulement
             sur l'icône : à la souris, c'est le geste attendu. La frappe
             reste possible — le sélecteur natif n'avale pas le clavier, et
             Échap le referme. */
          onClick={openPicker}
          onBlur={() => {
            // À la sortie du champ, une saisie qui n'est pas une date se
            // rétracte sur la dernière valeur retenue plutôt que de rester à
            // l'écran en prétendant filtrer.
            if (text !== "" && !parseDayFr(text)) setText(formatDayFr(value));
          }}
          className="type-body text-text-primary placeholder:text-text-tertiary w-28 bg-transparent px-3 tabular-nums outline-none"
        />

        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Effacer"
            className="text-text-tertiary hover:text-text-primary focus-visible:ring-ring rounded-md p-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
          >
            <X strokeWidth={1.75} className="size-4" aria-hidden />
            <span className="sr-only">Effacer {label.toLowerCase()}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={openPicker}
          title="Ouvrir le calendrier"
          className="text-text-tertiary hover:text-text-primary focus-visible:ring-ring mr-1 rounded-md p-1.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
        >
          <CalendarDays strokeWidth={1.75} className="size-4.5" aria-hidden />
          <span className="sr-only">Ouvrir le calendrier — {label}</span>
        </button>

        {/* Réduit à un point, jamais à `display:none` ni à une taille nulle :
            `showPicker()` lève une exception sur un élément qui ne produit pas
            de boîte. Placé sous le bouton pour que le sélecteur natif s'ancre
            là où on vient de cliquer. */}
        <input
          ref={nativeRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className="pointer-events-none absolute right-3 bottom-0 size-px opacity-0"
        />
      </div>
    </div>
  );
}
