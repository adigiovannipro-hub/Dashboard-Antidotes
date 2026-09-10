import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LinkPending } from "@/components/ds/route-progress";
import { cn } from "@/lib/utils";

/**
 * Les surfaces du système : trois variantes, et seulement trois.
 *
 * La contrainte est volontaire. Une carte qui n'entre dans aucune des trois
 * n'a probablement pas lieu d'être une carte — c'est le garde-fou qui empêche
 * l'écran de redevenir un empilement de rectangles indifférenciés.
 *
 *   `stat`  un chiffre et son contexte. Ne contient jamais de liste.
 *   `panel` un contenant — liste, tableau, graphique. A toujours un en-tête.
 *   `nav`   une carte cliquable vers un espace. Doit porter des métriques.
 *
 * Seule la variante `nav` réagit au survol : un effet sur une carte non
 * cliquable est un mensonge sur ce qui va se passer.
 */

const BASE =
  "rounded-lg border border-border bg-surface shadow-card transition-[border-color,box-shadow,transform] duration-(--motion-duration) ease-standard";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn(BASE, "overflow-hidden", className)} {...props}>
      {children}
    </section>
  );
}

/** En-tête d'un `Panel` : titre à gauche, action à droite. */
export function PanelHeader({
  title,
  count,
  description,
  action,
  className,
}: {
  title: string;
  /** Compteur en pastille, quand le nombre d'éléments fait partie de l'info. */
  count?: number;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="type-h3 flex items-center gap-2">
          {title}
          {count !== undefined ? <Counter value={count} /> : null}
        </h3>
        {description ? (
          <p className="type-caption mt-0.5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="max-w-full">{action}</div> : null}
    </div>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Corps sans marge, pour une liste de lignes qui doit toucher les bords. */
export function PanelRows({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y divide-border [&>*:last-child]:border-b-0", className)}
      {...props}
    />
  );
}

/**
 * Carte cliquable vers un espace ou un module.
 *
 * La flèche n'apparaît qu'au survol et au focus : au repos, c'est le contenu
 * qui doit occuper l'œil, pas l'ornement qui dit « ceci est un lien ».
 */
export function NavCard({
  href,
  label,
  className,
  children,
}: {
  href: string;
  /** Lu par les lecteurs d'écran à la place de la flèche. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        BASE,
        "group/nav focus-visible:ring-ring relative block p-5 hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <LinkPending />
      {/* La flèche ne fait pas qu'apparaître : elle monte d'un cheveu vers son
          coin, dans le sens où mène le lien. Deux pixels de l'échelle native —
          au-delà, l'œil la suit au lieu de lire la carte. */}
      <ArrowUpRight
        aria-hidden
        strokeWidth={1.75}
        className="absolute top-4 right-4 size-4 -translate-x-0.5 translate-y-0.5 text-text-tertiary opacity-0 transition-[opacity,transform] duration-(--motion-duration) ease-exit group-hover/nav:translate-x-0 group-hover/nav:translate-y-0 group-hover/nav:opacity-100 group-focus-visible/nav:translate-x-0 group-focus-visible/nav:translate-y-0 group-focus-visible/nav:opacity-100 motion-reduce:transition-none"
      />
      {children}
    </Link>
  );
}

/** Le compteur gris qui suit un titre de section : « Clients 4 ». */
export function Counter({ value }: { value: number }) {
  return (
    <span className="type-caption rounded-pill bg-neutral-subtle px-2 py-0.5 font-medium text-neutral-ink tabular-nums">
      {value}
    </span>
  );
}

/**
 * Titre de section. Remplace les libellés gris pâle en capitales, qui
 * disparaissaient dans le fond au lieu de structurer la page.
 */
export function SectionHeader({
  title,
  count,
  description,
  action,
  className,
}: {
  title: string;
  count?: number;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    /* `flex-wrap` : une barre d'outils plus large que la place restante
       passe à la ligne au lieu d'être rognée hors de l'écran — sur un
       téléphone, deux boutons de l'inbound sortaient du cadre et devenaient
       inatteignables. Tant que tout tient, rien ne bouge. */
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="type-h2 flex items-center gap-2 text-text-primary">
          {title}
          {count !== undefined ? <Counter value={count} /> : null}
        </h2>
        {description ? (
          <p className="type-caption mt-1 text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="max-w-full">{action}</div> : null}
    </div>
  );
}
