import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";

import { EnrollForm } from "@/components/academy/admin/enroll-form";
import { EnrollmentTable } from "@/components/academy/admin/enrollment-table";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { CircleCheck, Clock3, UserMinus } from "lucide-react";
import { requireAcademyAdmin } from "@/lib/academy/access";
import { listCourses, listEnrollments } from "@/lib/academy/queries";

export const metadata: Metadata = { title: "Élèves · Academy" };

type Search = Promise<Record<string, string | undefined>>;

/**
 * Le fichier des élèves — owner seul, 404 pour tout le monde d'autre.
 *
 * Une inscription porte l'**adresse**, pas le compte : on inscrit quelqu'un
 * avant qu'il ait un compte, et le raccrochage se fait à sa première
 * connexion. C'est pour ça que la colonne d'état distingue « Invitée » —
 * jamais venue — d'« Active » — entrée au moins une fois.
 */
export default async function AcademyMembresPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const context = await requireAcademyAdmin();
  const params = await searchParams;

  const courses = await listCourses({
    orgId: context.orgId,
    courseIds: null,
    includeDrafts: true,
  });

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message="Aucune formation à laquelle inscrire quelqu'un."
        action={{ label: "Ouvrir le back-office", href: "/academy/admin" }}
      />
    );
  }

  const course =
    courses.find((candidate) => candidate.slug === params.formation) ?? courses[0]!;
  const enrollments = await listEnrollments({
    orgId: context.orgId,
    courseId: course.id,
  });

  const active = enrollments.filter((row) => row.status === "active").length;
  const invited = enrollments.filter((row) => row.status === "invited").length;
  const revoked = enrollments.filter((row) => row.status === "revoked").length;

  return (
    <div className="space-y-6">
      <Link
        href={`/academy/admin?formation=${course.slug}`}
        className="type-caption inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft aria-hidden strokeWidth={1.75} className="size-3.5" />
        Back-office
      </Link>

      <SectionHeader title="Élèves" description={course.title} />

      <StatGrid>
        <StatCard
          label="Actives"
          value={String(active)}
          context="entrées au moins une fois"
          icon={CircleCheck}
        />
        <StatCard
          label="Invitées"
          value={String(invited)}
          context="lien envoyé, jamais venues"
          icon={Clock3}
        />
        <StatCard
          label="Retirées"
          value={String(revoked)}
          context="accès fermé, progression gardée"
          icon={UserMinus}
        />
      </StatGrid>

      <Panel>
        <PanelHeader title="Inscrire quelqu'un" />
        <PanelBody>
          <EnrollForm
            courses={courses.map((candidate) => ({
              id: candidate.id,
              title: candidate.title,
            }))}
            defaultCourseId={course.id}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Inscriptions" count={enrollments.length} />
        {enrollments.length === 0 ? (
          <PanelBody>
            <p className="type-body text-text-secondary">
              Personne n&apos;est encore inscrit à cette formation.
            </p>
          </PanelBody>
        ) : (
          <EnrollmentTable enrollments={enrollments} />
        )}
      </Panel>
    </div>
  );
}
