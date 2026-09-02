import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { CourseCard } from "@/components/academy/course-card";
import { EmptyState } from "@/components/ds/empty-state";
import { SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAcademyAccess } from "@/lib/academy/access";
import { resolveAssetUrl, signAcademyAssets } from "@/lib/academy/assets";
import { loadAcademyCatalogue } from "@/lib/academy/overview";

export const metadata: Metadata = { title: "Academy" };

/**
 * Le catalogue : une carte par formation accessible.
 *
 * Pour l'owner et l'équipe, ce sont toutes les formations de l'organisation.
 * Pour une élève, ce sont **les siennes** — celles qu'elle a achetées. Une
 * seule inscription donne donc un écran à une seule carte, et c'est voulu :
 * elle ne doit pas apprendre l'existence des autres formations.
 */
export default async function AcademyCataloguePage() {
  const context = await requireAcademyAccess();
  const cards = await loadAcademyCatalogue(context);
  const covers = await signAcademyAssets(cards.map((card) => card.course.cover_url));

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        message={
          context.isAdmin
            ? "Aucune formation publiée pour le moment."
            : "Aucune formation ne t'est ouverte pour le moment."
        }
        action={
          context.isAdmin
            ? { label: "Ouvrir le back-office", href: "/academy/admin" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={context.isStudent ? "Mes formations" : "Formations"}
        count={cards.length}
        action={
          context.isAdmin ? (
            <Button render={<Link href="/academy/admin" />} variant="outline" size="sm">
              Back-office
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <CourseCard
            key={card.course.id}
            card={card}
            coverUrl={resolveAssetUrl(card.course.cover_url, covers)}
          />
        ))}
      </div>
    </div>
  );
}
