import Link from "next/link";
import type { Metadata } from "next";
import { Inbox, MailCheck, MailX, Reply, Send, Users } from "lucide-react";

import { LinkedinTodo } from "@/components/antidotes/linkedin-todo";
import { NewSequenceDialog } from "@/components/antidotes/new-sequence-dialog";
import { RunSequencesButton } from "@/components/antidotes/run-sequences-button";
import { EmptyState } from "@/components/ds/empty-state";
import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelHeader, PanelRows, SectionHeader } from "@/components/ds/surface";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { formatDateTime } from "@/lib/antidotes/dates";
import { buildTemplateContext } from "@/lib/antidotes/sequences/passage";
import { getBounceGuard, listLinkedinTodo, listSequenceSummaries } from "@/lib/antidotes/sequences/queries";
import { formatRate } from "@/lib/antidotes/sequences/stats";
import { renderTemplate } from "@/lib/antidotes/sequences/templates";

export const metadata: Metadata = { title: "Séquences · Antidotes" };
/** « Passer maintenant » relit des fils Gmail et envoie : au-delà des dix secondes par défaut. */
export const maxDuration = 60;

/**
 * Les séquences : chacune avec son taux de survie côté envoi — inscrits,
 * emails partis, réponses. La bande de mesures additionne toutes les
 * séquences, et la garde des rebonds s'affiche dès qu'elle bloque : un
 * domaine qui part en spam ne se remarque qu'après, sinon.
 */
export default async function SequencesPage() {
  const context = await requireAntidotesAccess();
  const [summaries, todo, guard] = await Promise.all([
    listSequenceSummaries({ orgId: context.orgId }),
    listLinkedinTodo({ orgId: context.orgId }),
    getBounceGuard({ orgId: context.orgId }),
  ]);

  const totals = summaries.reduce(
    (sum, entry) => ({
      enrolled: sum.enrolled + entry.counts.enrolled,
      sent: sum.sent + entry.counts.sent,
      replied: sum.replied + entry.counts.replied,
      contacted: sum.contacted + Math.round(entry.counts.replyRate === null ? 0 : entry.counts.replied / entry.counts.replyRate),
    }),
    { enrolled: 0, sent: 0, replied: 0, contacted: 0 },
  );
  const replyRate = totals.contacted > 0 ? totals.replied / totals.contacted : null;

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

      <StatGrid>
        <StatCard
          label="Inscrits"
          value={totals.enrolled}
          context={`${summaries.filter((entry) => entry.sequence.is_active).length} séquence${summaries.filter((entry) => entry.sequence.is_active).length > 1 ? "s" : ""} active${summaries.filter((entry) => entry.sequence.is_active).length > 1 ? "s" : ""}`}
          icon={Users}
        />
        <StatCard label="Emails envoyés" value={totals.sent} context="depuis le début" icon={Send} />
        <StatCard
          label="Réponses"
          value={totals.replied}
          context={replyRate === null ? "aucun contacté" : `${formatRate(replyRate)} des contactés`}
          valueTone={totals.replied > 0 ? "accent" : undefined}
          icon={Reply}
        />
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
      </StatGrid>

      {guard.blocked ? (
        <EmptyState
          icon={MailX}
          message={`Plus de 3 % de rebonds sur sept jours : les envois sont suspendus. Vérifiez les adresses avant de relancer.`}
        />
      ) : null}

      {summaries.length === 0 ? (
        <EmptyState icon={Inbox} message="Aucune séquence. La première naît d'un nom, avec trois emails prêts à réécrire." />
      ) : (
        <Panel>
          <PanelRows>
            {summaries.map(({ sequence, counts, stepCount, nextSendAt }) => (
              <div key={sequence.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/antidotes/outbound/sequences/${sequence.id}`}
                      className="type-label focus-visible:ring-ring truncate rounded-sm text-text-primary hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {sequence.name}
                    </Link>
                    {!sequence.is_active ? <StatusPill tone="neutral">Inactive</StatusPill> : null}
                  </div>
                  <p className="type-caption mt-1 text-text-secondary">
                    {stepCount} étape{stepCount > 1 ? "s" : ""}
                    {nextSendAt ? ` · prochain envoi ${formatDateTime(nextSendAt)}` : ""}
                  </p>
                </div>
                <p className="type-caption flex flex-wrap items-center gap-x-1.5 text-text-secondary tabular-nums">
                  <span><span className="font-medium text-text-primary">{counts.enrolled}</span> inscrits</span>
                  <span aria-hidden>→</span>
                  <span><span className="font-medium text-text-primary">{counts.sent}</span> envoyés</span>
                  <span aria-hidden>→</span>
                  <span>
                    <span className="font-medium text-text-primary">{counts.replied}</span> réponses
                    {counts.replyRate !== null ? ` (${formatRate(counts.replyRate)})` : ""}
                  </span>
                  {counts.linkedin > 0 ? <span>· {counts.linkedin} LinkedIn</span> : null}
                  {counts.bounced > 0 ? <span className="text-danger-ink">· {counts.bounced} rebond{counts.bounced > 1 ? "s" : ""}</span> : null}
                  {counts.stoppedOnOptOut > 0 ? <span>· {counts.stoppedOnOptOut} désinscrit{counts.stoppedOnOptOut > 1 ? "s" : ""}</span> : null}
                </p>
                <span className="type-caption text-text-secondary">
                  {counts.active} en cours{counts.paused > 0 ? ` · ${counts.paused} en pause` : ""}
                </span>
              </div>
            ))}
          </PanelRows>
        </Panel>
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
