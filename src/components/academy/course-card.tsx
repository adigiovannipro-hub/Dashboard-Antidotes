import Link from "next/link";

import { ProgressBar } from "@/components/academy/progress-bar";
import { CoverArt } from "@/components/academy/cover-art";
import { StatusPill } from "@/components/ds/status-pill";
import type { AcademyCourseCard } from "@/lib/academy/overview";
import { formatMinutes } from "@/lib/format";

/**
 * Une formation dans le catalogue : sa couverture, son titre, son avancement.
 *
 * La couverture occupe le haut de la carte et porte le titre en surimpression
 * — c'est ce qui rend un catalogue lisible d'un coup d'œil quand il y aura dix
 * formations. Sans image, un dégradé dérivé du slug tient sa place : deux
 * formations n'ont jamais la même couleur, et aucune carte n'est vide.
 */
export function CourseCard({
  card,
  coverUrl,
}: {
  card: AcademyCourseCard;
  coverUrl: string | null;
}) {
  const { course } = card;
  const finished = card.percent === 100 && card.lessonCount > 0;

  return (
    <Link
      href={`/academy/${course.slug}`}
      aria-label={`Ouvrir la formation ${course.title}`}
      className="group/course block overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-(--motion-duration) ease-standard hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
    >
      {/* Sans surimpression : le titre est juste en dessous, et le répéter en
          capitales sur le dégradé donnait deux fois la même longue phrase. Le
          dégradé identifie la formation par sa couleur, stable pour toujours. */}
      <CoverArt
        url={coverUrl}
        seed={course.slug}
        title={course.title}
        overlayTitle={false}
        className="aspect-[16/7]"
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="type-h3 text-text-primary">{course.title}</h3>
          {!course.published ? (
            <StatusPill tone="neutral" className="shrink-0">
              Brouillon
            </StatusPill>
          ) : finished ? (
            <StatusPill tone="positive" className="shrink-0">
              Terminée
            </StatusPill>
          ) : null}
        </div>

        {course.description ? (
          <p className="type-caption mt-1.5 line-clamp-2 text-text-secondary">
            {course.description}
          </p>
        ) : null}

        <p className="type-caption mt-4 text-text-secondary tabular-nums">
          {card.moduleCount} modules · {card.lessonCount} leçons ·{" "}
          {formatMinutes(card.totalMinutes)}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <ProgressBar
            percent={card.percent}
            label={`Progression de la formation ${course.title}`}
            className="flex-1"
          />
          <span className="type-caption shrink-0 font-medium text-text-primary tabular-nums">
            {card.percent} %
          </span>
        </div>
      </div>
    </Link>
  );
}
