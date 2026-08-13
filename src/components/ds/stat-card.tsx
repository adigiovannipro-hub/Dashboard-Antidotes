import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { LinkPending } from "@/components/ds/route-progress";
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
  /** `ReactNode` et non `string` : certaines cartes portent une commande à
      côté de leur libellé — l'œil qui masque la trésorerie, par exemple. */
  label: React.ReactNode;
  value: React.ReactNode;
  /** La phrase de contexte : « dont 3 en retard », « sur 7 jours ». */
  context?: string;
  /** Qualifie le chiffre lui-même, quand il porte un état. */
  tone?: StatusTone;
  toneLabel?: string;
  /** Colore le chiffre. Toujours une **encre** de la charte, jamais la teinte
      vive — le vert de marque est à 2,71:1 sur blanc, illisible en texte. */
  valueTone?: "accent" | "warning" | "danger";
  icon: LucideIcon;
  href?: string;
  pending?: boolean;
};

const VALUE_TONE_CLASS: Record<NonNullable<StatCardProps["valueTone"]>, string> = {
  accent: "text-accent-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
};

export function StatCard({
  label,
  value,
  context,
  tone,
  toneLabel,
  valueTone,
  icon: Icon,
  href,
  pending,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="type-overline text-text-secondary">{label}</p>
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
          <p
            className={cn(
              "type-stat",
              valueTone ? VALUE_TONE_CLASS[valueTone] : "text-text-primary",
            )}
          >
            {value ?? "—"}
          </p>
        )}
      </div>

      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-2">
        {tone && toneLabel ? (
          <StatusPill tone={tone}>{toneLabel}</StatusPill>
        ) : null}
        {context ? (
          <span className="type-caption text-text-secondary">{context}</span>
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
      <LinkPending />
      {body}
    </Link>
  );
}

/**
 * La bande haute : quatre cartes, deux colonnes en petit écran.
 *
 * Les cartes entrent en cascade — quarante millisecondes d'écart, de gauche à
 * droite —, et c'est la seule chose qui dise que l'écran vient d'arriver. Le
 * cadre ne bouge pas d'une page à l'autre : rail, barre de page, onglets sont
 * les mêmes. Sans ce mouvement, changer de section ressemble à un
 * rafraîchissement, pas à un déplacement.
 *
 * L'animation ne rejoue qu'au **montage** des cartes — donc en changeant de
 * page, pas à chaque rendu. Une bande qui se rallumerait à chaque frappe dans
 * un champ serait insupportable.
 *
 * Le décalage est porté par la grille et non par chaque appelant : les pages
 * qui posent une bande de mesures n'ont rien à savoir de tout ça.
 */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    // `enter-stagger` décale les enfants directs en CSS, par `nth-child` : une
    // enveloppe React autour de chaque carte aurait cassé l'égalisation des
    // hauteurs, les cartes n'étant alors plus les éléments de la grille.
    <div className="grid gap-5 grid-cols-2 lg:grid-cols-4 enter-stagger">
      {children}
    </div>
  );
}
