import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import { EnrollmentsTable } from "@/components/antidotes/enrollments-table";
import { LinkedinTodo } from "@/components/antidotes/linkedin-todo";
import { SequenceForm } from "@/components/antidotes/sequence-form";
import { EmptyState } from "@/components/ds/empty-state";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { buildTemplateContext } from "@/lib/antidotes/sequences/passage";
import { getSequenceDetail } from "@/lib/antidotes/sequences/queries";
import { formatRate } from "@/lib/antidotes/sequences/stats";
import { renderTemplate } from "@/lib/antidotes/sequences/templates";

type Params = Promise<{ sequence: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sequence } = await params;
  return { title: `Séquence ${sequence.slice(0, 8)} · Antidotes` };
}

/**
 * Une séquence : ses inscriptions d'abord — c'est ce qu'on vient regarder —
 * puis ses réglages et ses étapes, puis les pistes LinkedIn qu'elle a
 * ouvertes. On s'inscrit depuis le pipeline, pas d'ici : c'est là qu'on
 * choisit qui.
 */
export default async function SequencePage({ params }: { params: Params }) {
  const { sequence: sequenceId } = await params;
  if (!UUID.test(sequenceId)) notFound();

  const context = await requireAntidotesAccess();
  const detail = await getSequenceDetail({ orgId: context.orgId, sequenceId });
  if (!detail) notFound();

  const { sequence, settings, steps, enrollments, counts } = detail;
  const linkedin = enrollments.filter((row) => row.enrollment.channel === "linkedin" && row.enrollment.status === "active");
  const messages: Record<string, string> = {};
  for (const row of linkedin) {
    messages[row.enrollment.id] = renderTemplate(
      settings.linkedin_message,
      buildTemplateContext({
        contact: row.contact,
        prospect: row.prospect,
        settings,
        observation: row.enrollment.personalization.observation ?? null,
      }),
    ).text;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button render={<Link href="/antidotes/outbound/sequences" />} variant="ghost" size="sm">
          <ArrowLeft aria-hidden />
          Séquences
        </Button>
      </div>

      <SectionHeader
        title={sequence.name}
        description={`${counts.enrolled} inscrit${counts.enrolled > 1 ? "s" : ""} · ${counts.sent} envoyé${counts.sent > 1 ? "s" : ""} · ${counts.replied} réponse${counts.replied > 1 ? "s" : ""}${counts.replyRate !== null ? ` (${formatRate(counts.replyRate)})` : ""}`}
        className="flex-wrap"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!sequence.is_active ? <StatusPill tone="neutral">Inactive</StatusPill> : <StatusPill tone="positive">Active</StatusPill>}
            <Button render={<Link href="/antidotes/outbound/pipeline" />} variant="outline" size="sm">
              Inscrire depuis le pipeline
            </Button>
          </div>
        }
      />

      {enrollments.length === 0 ? (
        <EmptyState
          icon={Users}
          message="Personne n'est inscrit. Sélectionnez des prospects dans le pipeline, puis « Inscrire à une séquence »."
          action={{ label: "Ouvrir le pipeline", href: "/antidotes/outbound/pipeline" }}
        />
      ) : (
        <Panel>
          <PanelHeader title="Inscriptions" count={enrollments.length} />
          <EnrollmentsTable rows={enrollments} stepCount={steps.length} />
        </Panel>
      )}

      {linkedin.length > 0 ? (
        <Panel>
          <PanelHeader title="À faire sur LinkedIn" count={linkedin.length} />
          <LinkedinTodo rows={linkedin.map((row) => ({ ...row, sequence }))} messages={messages} />
        </Panel>
      ) : null}

      <SequenceForm sequence={sequence} settings={settings} steps={steps} />
    </div>
  );
}
