import { Flag, UserRound, type LucideIcon } from "lucide-react";

import type { StatusTone } from "@/components/ds/status-pill";
import { campaignColor, initialsOf, scoreTone } from "@/lib/antidotes/colors";
import type { Contact } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Les petites pièces du pipeline, partagées entre la carte, le tableau et
 * la barre de filtres : l'étiquette de campagne, le drapeau de score, une
 * pastille de compteur, l'avatar du contact, le point d'un statut.
 *
 * Une seule règle : la couleur vit dans le point, le drapeau ou la pastille ;
 * le texte reste à l'encre sur une surface claire, et se lit sans elle.
 */

const CHIP =
  "type-caption inline-flex max-w-full min-w-0 items-center gap-1 rounded-pill bg-surface-sunken px-1.5 py-0.5 text-text-primary tabular-nums";

/** Le point de couleur d'une campagne — ou du repli sans campagne. */
export function CampaignDot({
  campaignId,
  className,
}: {
  campaignId: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-pill", className)}
      style={{ backgroundColor: campaignColor(campaignId) }}
    />
  );
}

/**
 * La campagne d'un prospect, ou son client de référence quand il n'en a pas
 * (« Miroir de Bondet ») — c'est l'origine du prospect, d'où qu'elle vienne.
 * Rien des deux : rien, la carte ne montre pas de vide étiqueté.
 */
export function CampaignChip({
  campaignId,
  campaignName,
  referenceClient,
  className,
}: {
  campaignId: string | null;
  campaignName: string | null;
  referenceClient: string | null;
  className?: string;
}) {
  const label = campaignName ?? (referenceClient ? `Miroir de ${referenceClient}` : null);
  if (!label) return null;
  return (
    <span className={cn(CHIP, className)} title={label}>
      <CampaignDot campaignId={campaignId} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Le score avec son drapeau : la couleur dit le palier, le chiffre reste. */
export function ScoreFlag({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn(CHIP, "font-medium", className)} aria-label={`Score ${score}`}>
      <Flag
        className="size-3 shrink-0"
        strokeWidth={1.75}
        fill="currentColor"
        style={{ color: scoreTone(score) }}
        aria-hidden
      />
      {score}
    </span>
  );
}

/** Un compteur à icône — contacts, entrées de journal. */
export function CountChip({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: LucideIcon;
  value: number;
  /** Le nom de ce qu'on compte, pour le lecteur d'écran. */
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(CHIP, value === 0 && "text-text-secondary", className)}
      aria-label={`${value} ${label}`}
    >
      <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
      {value}
    </span>
  );
}

/**
 * Une pastille de date — le prochain geste ou le dernier contact. En
 * `danger` quand l'envoi est dû aujourd'hui ou en retard : c'est le seul
 * moment où une date demande quelque chose.
 */
export function DateChip({
  children,
  due,
  label,
  className,
}: {
  children: React.ReactNode;
  due?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(CHIP, due && "bg-danger-subtle font-medium text-danger-ink", className)}
      aria-label={label}
    >
      {children}
    </span>
  );
}

/**
 * L'avatar rond du contact principal : ses initiales à l'encre sur la
 * surface enfoncée, ou une silhouette grisée quand personne n'est nommé.
 */
export function ContactAvatar({
  contact,
  className,
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email"> | null | undefined;
  className?: string;
}) {
  const initials = initialsOf(contact);
  return (
    <span
      aria-hidden
      className={cn(
        "type-micro flex size-7 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-sunken font-medium text-text-primary select-none",
        className,
      )}
    >
      {initials ? (
        initials
      ) : (
        <UserRound className="size-3.5 text-text-tertiary" strokeWidth={1.75} />
      )}
    </span>
  );
}

const STATUS_DOTS: Record<StatusTone, string> = {
  positive: "bg-accent-ink",
  warning: "bg-warning-ink",
  danger: "bg-danger-ink",
  info: "bg-info-ink",
  neutral: "bg-neutral-ink",
};

/** Le point d'un statut — l'encre du ton, comme la `StatusPill`. */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-pill", STATUS_DOTS[tone], className)}
    />
  );
}
