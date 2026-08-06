import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * La carte KPI de la bande haute.
 *
 * Un chiffre, son libellé, et une phrase qui dit ce que le chiffre vaut. Sans
 * cette troisième ligne, « 12 » ne renseigne sur rien : c'est le contexte qui
 * transforme une mesure en information.
 *
 * `pending` réserve la place au lieu d'afficher un zéro. Un zéro affiché
 * pendant un chargement est un mensonge court, et c'est bien assez pour faire
 * prendre une mauvaise décision.
 */

export type StatCardProps = {
  label: string;
  value: string | number | null;
  /** La phrase de contexte : « dont 3 en retard », « sur 7 jours ». */
  context?: string;
  /** Qualifie le chiffre lui-même, quand il porte un état. */
  tone?: StatusTone;
  toneLabel?: string;
  icon: LucideIcon;
  href?: string;
  pending?: boolean;
};

export function StatCard({
  label,
  value,
  context,
  tone,
  toneLabel,
  icon: Icon,
  href,
  pending,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-overline text-text-secondary">{label}</p>
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken"
        >
          <Icon strokeWidth={1.75} className="size-4.5 text-text-secondary" />
        </span>
      </div>

      <div className="mt-3">
        {pending ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-stat text-text-primary">{value ?? "—"}</p>
        )}
      </div>

      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-2">
        {tone && toneLabel ? (
          <StatusPill tone={tone}>{toneLabel}</StatusPill>
        ) : null}
        {context ? (
          <span className="text-caption text-text-secondary">{context}</span>
        ) : null}
      </div>
    </>
  );

  const shell =
    "rounded-lg border border-border bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-(--motion-duration) ease-standard";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "focus-visible:ring-ring block hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}

/** La bande haute : quatre cartes, deux colonnes en petit écran. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">{children}</div>;
}
