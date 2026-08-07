import { CircleAlert, RefreshCw } from "lucide-react";

import type { FinanceSyncRun } from "@/lib/finance/types";

/**
 * L'horodatage du dernier passage de la synchronisation Airwallex.
 *
 * L'heure affichée est celle du **dernier passage tenté**, réussi ou non — un
 * passage en échec dont on n'afficherait que le prédécesseur réussi ferait
 * passer des chiffres d'avant-hier pour ceux d'hier.
 *
 * Il n'y a plus de bouton « Synchroniser maintenant », et c'est une correction
 * et non un retrait de fonctionnalité : Airwallex refuse les adresses IP de
 * Vercel. Le bouton partait donc de l'hébergeur pour se faire renvoyer un
 * « 403 Forbidden » à tous les coups — une commande qui ne pouvait pas
 * aboutir. La synchronisation part désormais d'une machine GitHub, toutes les
 * heures, et n'a rien à déclencher à la main.
 */
export function SyncBanner({ lastRun }: { lastRun: FinanceSyncRun | null }) {
  if (!lastRun) {
    return (
      <p className="type-caption text-text-secondary flex items-center gap-1.5">
        <CircleAlert
          strokeWidth={1.75}
          className="size-4 text-text-tertiary"
          aria-hidden
        />
        Aucune synchronisation encore passée.
      </p>
    );
  }

  return (
    <p className="type-caption text-text-secondary flex items-center gap-1.5">
      <RefreshCw
        strokeWidth={1.75}
        className="size-4 text-text-tertiary"
        aria-hidden
      />
      Synchronisé{" "}
      <time dateTime={lastRun.started_at} className="tabular-nums">
        {formatInstant(lastRun.started_at)}
      </time>
      {lastRun.status === "error" ? (
        <span className="text-danger-ink">— en échec</span>
      ) : (
        <span className="text-text-tertiary">· mise à jour chaque heure</span>
      )}
    </p>
  );
}

const INSTANT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return INSTANT.format(date);
}
