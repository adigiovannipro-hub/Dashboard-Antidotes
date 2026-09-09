import Link from "next/link";
import type { Metadata } from "next";
import { Inbox, MailCheck, MailX } from "lucide-react";

import { LinkedinTodo } from "@/components/antidotes/linkedin-todo";
import { NewSequenceDialog } from "@/components/antidotes/new-sequence-dialog";
import { RunSequencesButton } from "@/components/antidotes/run-sequences-button";
import { SequenceFunnel, SequenceMessages } from "@/components/antidotes/sequence-funnel";
import { EmptyState } from "@/components/ds/empty-state";
import { StatCard } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelBody, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { formatDateTime } from "@/lib/antidotes/dates";
import { buildTemplateContext } from "@/lib/antidotes/sequences/passage";
import { getBounceGuard, listLinkedinTodo, listSequenceSummaries } from "@/lib/antidotes/sequences/queries";
import { formatRate, sumSequenceCounts } from "@/lib/antidotes/sequences/stats";
import { renderTemplate } from "@/lib/antidotes/sequences/templates";

export const metadata: Metadata = { title: "Séquences · Antidotes" };
/** « Passer maintenant » relit des fils Gmail et envoie : au-delà des dix secondes par défaut. */
export const maxDuration = 60;

/**
 * Les séquences, lues comme un entonnoir de personnes : inscrits, contactés,
 * ont répondu, rendez-vous. L'ancienne bande « 9 inscrits, 10 envoyés,
 * 2 réponses » mélangeait des gens et des messages et ne voulait rien dire ;
 * les messages — envois, rebonds — restent en information secondaire.
 *
 * L'entonnoir global additionne toutes les séquences ; la garde des rebonds
 * reste à côté, en carte : un domaine qui part en spam ne se remarque
 * qu'après, sinon.
 */
export default async function SequencesPage() {
  const context = await requireAntidotesAccess();
  const [summaries, todo, guard] = await Promise.all([
    listSequenceSummaries({ orgId: context.orgId }),
    listLinkedinTodo({ orgId: context.orgId }),
    getBounceGuard({ orgId: context.orgId }),
  ]);

  const totals = sumSequenceCounts(summaries.map((entry) => entry.counts));
  const activeCount = summaries.filter((entry) => entry.sequence.is_active).length;

  const messages: Record<string, string> = {};
  for (const row of todo) {
    const settings = summaries.find((entry) => entry.sequence.id === row.sequence.id)?.settings;
    const rendered = renderTemplate(
      settings?.linkedin_message ?? "",
      buildTemplateContext({
        contact: row.contact,
        prospect: row.prospect,
        settings: settings ?? { case_study_url: null, sender_name: null },
        observation: row.enrollment.personalization.observation ?? null,
      }),
    );
    messages[row.enrollment.id] = rendered.text;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Séquences"
        count={summaries.length}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RunSequencesButton />
            <NewSequenceDialog />
          </div>
        }
      />

      {summaries.length === 0 ? (
        <EmptyState icon={Inbox} message="Aucune séquence. La première naît d'un nom, avec trois emails prêts à réécrire." />
      ) : (
        <>
          {/* L'entonnoir global et la garde des rebonds côte à côte : la carte
              seule sur toute la largeur aurait pesé comme le sujet de l'écran,
              pour une alarme qui ne se déclenche presque jamais. */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader
                title="Toutes les séquences"
                count={summaries.length}
                description={`${activeCount} active${activeCount > 1 ? "s" : ""}`}
              />
              <PanelBody>
                <SequenceFunnel counts={totals} />
                <SequenceMessages counts={totals} className="mt-4" />
              </PanelBody>
            </Panel>
            <StatCard
              label="Rebonds, 7 jours"
              value={guard.bounced}
              context={
                guard.rate === null
                  ? "aucun envoi"
                  : `${formatRate(guard.rate)} de ${guard.sent} envoi${guard.sent > 1 ? "s" : ""}`
              }
              tone={guard.blocked ? "danger" : undefined}
              toneLabel={guard.blocked ? "envois bloqués" : undefined}
              icon={guard.blocked ? MailX : MailCheck}
            />
          </div>

          <Panel>
            <PanelRows>
              {summaries.map(({ sequence, counts, stepCount, nextSendAt }) => (
                <div key={sequence.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/antidotes/outbound/sequences/${sequence.id}`}
                        className="type-label focus-visible:ring-ring truncate rounded-sm text-text-primary hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {sequence.name}
                      </Link>
                      <StatusPill tone={sequence.is_active ? "positive" : "neutral"}>
                        {sequence.is_active ? "Active" : "Inactive"}
                      </StatusPill>
                    </div>
                    <p className="type-caption mt-1 text-text-secondary">
                      {stepCount} étape{stepCount > 1 ? "s" : ""}
                      {nextSendAt ? ` · prochain envoi ${formatDateTime(nextSendAt)}` : ""}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <SequenceFunnel counts={counts} compact />
                    <SequenceMessages counts={counts} className="mt-2" />
                  </div>
                </div>
              ))}
            </PanelRows>
          </Panel>
        </>
      )}

      {todo.length > 0 ? (
        <Panel>
          <PanelHeader title="À faire sur LinkedIn" count={todo.length} description="Adresses risquées : on écrit soi-même." />
          <LinkedinTodo rows={todo} messages={messages} />
        </Panel>
      ) : null}
    </div>
  );
}
