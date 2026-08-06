import { CalendarClock, MessagesSquare, Send } from "lucide-react";

import { NavCard } from "@/components/ds/surface";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { shortDate } from "@/lib/mon-travail/dates";
import type { WorkspaceStats } from "@/lib/mon-travail/overview";
import { cn } from "@/lib/utils";

/**
 * La carte d'un espace, sur la page d'accueil.
 *
 * Elle porte des mesures, pas seulement un nom : une carte qui ne dit qu'où
 * elle mène oblige à l'ouvrir pour savoir s'il fallait l'ouvrir. Trois
 * chiffres suffisent à trancher — ce qui part bientôt, ce qui attend une
 * réponse, ce qui arrive à échéance.
 *
 * Les compteurs à zéro restent affichés : « 0 message en attente » est une
 * information, et une carte dont les lignes disparaissent au gré des données
 * ne se compare plus à sa voisine. Seule une source **absente** — pas de
 * modération sur cet espace — retire sa ligne.
 */
export function WorkspaceCard({
  href,
  name,
  roleLabel,
  accentColor,
  stats,
}: {
  href: string;
  name: string;
  roleLabel: string;
  accentColor: string | null;
  /** `null` tant que les agrégats ne sont pas chargés. */
  stats: WorkspaceStats | null;
}) {
  const state = stateOf(stats);

  return (
    <NavCard href={href} label={`Ouvrir l'espace ${name}`}>
      <div className="flex items-start gap-3 pr-6">
        <span
          aria-hidden
          className="mt-0.5 size-8 shrink-0 rounded-md bg-muted"
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        />
        <div className="min-w-0">
          <p className="text-h3 truncate text-text-primary">{name}</p>
          <p className="text-caption text-text-secondary">{roleLabel}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5">
        <Metric
          icon={Send}
          label="À publier sous 7 jours"
          value={stats ? String(stats.upcoming) : null}
        />
        {stats?.moderation !== null ? (
          <Metric
            icon={MessagesSquare}
            label="Messages en attente"
            value={stats ? String(stats.moderation) : null}
          />
        ) : null}
        <Metric
          icon={CalendarClock}
          label="Prochaine échéance"
          value={
            stats ? (stats.nextDue ? shortDate(stats.nextDue) : "Aucune") : null
          }
        />
      </dl>

      {stats?.monthProgress && stats.monthProgress.total > 0 ? (
        <MonthProgress
          done={stats.monthProgress.done}
          total={stats.monthProgress.total}
        />
      ) : null}

      {state ? (
        <div className="mt-3">
          <StatusPill tone={state.tone}>{state.label}</StatusPill>
        </div>
      ) : null}
    </NavCard>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Send;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className="size-3.5 shrink-0 text-text-tertiary"
      />
      <dt className="text-caption min-w-0 flex-1 truncate text-text-secondary">
        {label}
      </dt>
      <dd className="text-label text-text-primary tabular-nums">
        {value ?? (
          // TODO: valeur indisponible — la carte le dit plutôt que d'afficher
          // un zéro qui se lirait comme une mesure.
          <span className="text-text-tertiary">—</span>
        )}
      </dd>
    </div>
  );
}

/** Avancement du mois en cours : publié sur planifié. */
function MonthProgress({ done, total }: { done: number; total: number }) {
  const ratio = total === 0 ? 0 : done / total;

  return (
    <div className="mt-4">
      <div className="text-caption mb-1.5 flex items-center justify-between text-text-secondary">
        <span>Mois en cours</span>
        <span className="tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} publications parties sur ${total} prévues ce mois`}
        className="h-1 overflow-hidden rounded-pill bg-surface-sunken"
      >
        <div
          className={cn("h-full rounded-pill bg-brand transition-[width]")}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** L'état d'ensemble de l'espace, quand il y a quelque chose à signaler. */
function stateOf(
  stats: WorkspaceStats | null,
): { tone: StatusTone; label: string } | null {
  if (!stats) return null;
  if (stats.moderation !== null && stats.moderation > 0) {
    return { tone: "warning", label: "Modération à traiter" };
  }
  if (stats.upcoming === 0) return null;
  return { tone: "info", label: `${stats.upcoming} programmées` };
}
