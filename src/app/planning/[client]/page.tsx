import type { Metadata } from "next";

import { PlanningView } from "@/components/planning/planning-view";
import { requirePlanningClient } from "@/lib/planning/access";
import { analyseCadence } from "@/lib/planning/cadence";
import { assessMonth } from "@/lib/planning/health";
import {
  getLastSyncRun,
  listMonths,
  listSubjectsOfMonth,
  listSubjectsSince,
  previousMonthKey,
} from "@/lib/planning/queries";
import { resolveStrategy } from "@/lib/planning/strategy";

type Params = Promise<{ client: string }>;
type Search = Promise<Record<string, string | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { client: slug } = await params;
  const { client } = await requirePlanningClient(slug);
  return { title: `Planning Édito · ${client.name}` };
}

/** Fenêtre d'historique chargée pour la déduction de stratégie. */
const LOOKBACK_MONTHS = 6;

export default async function PlanningClientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { client: slug } = await params;
  const query = await searchParams;
  const { context, client } = await requirePlanningClient(slug);

  const months = await listMonths(client.id);

  if (months.length === 0) {
    return (
      <PlanningView
        clients={context.clients}
        client={client}
        role={context.access.role}
        months={[]}
        month={null}
        subjects={[]}
        health={null}
        issues={[]}
        strategy={null}
        selectedSubject={null}
        lastSync={await getLastSyncRun(client.id)}
      />
    );
  }

  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // À l'ouverture, le mois en cours s'il existe : c'est celui qu'on vient
  // regarder neuf fois sur dix. Sinon le plus récent.
  const month =
    months.find((candidate) => candidate.month === query.mois) ??
    months.find((candidate) => candidate.month === currentKey) ??
    months[0]!;

  const previousKey = previousMonthKey(month.month);
  const historyFrom = shiftMonth(month.month, -LOOKBACK_MONTHS);

  const [subjects, history] = await Promise.all([
    listSubjectsOfMonth(month.id),
    listSubjectsSince(client.id, historyFrom),
  ]);

  const strategy = resolveStrategy(client, history, { asOf: now });

  const issues = analyseCadence({
    month: month.month,
    subjects,
    previousSubjects: history.filter(
      (subject) => subject.month_key === previousKey,
    ),
    strategy,
  });

  const selectedSubject =
    subjects.find((subject) => subject.id === query.sujet) ?? null;

  return (
    <PlanningView
      clients={context.clients}
      client={client}
      role={context.access.role}
      months={months}
      month={month}
      subjects={subjects}
      health={assessMonth(subjects, { asOf: now })}
      issues={issues}
      strategy={strategy}
      selectedSubject={selectedSubject}
      lastSync={await getLastSyncRun(client.id)}
    />
  );
}

function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1;
  const date = new Date(Date.UTC(year, index + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
