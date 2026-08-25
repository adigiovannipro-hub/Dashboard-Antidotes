"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { BarList } from "@/components/viz/bar-list";
import { VizCard } from "@/components/viz/viz-card";
import { WebKpiCard } from "@/components/viz/web-kpi-card";
import { WebPagesTable } from "@/components/viz/web-pages-table";
import { WebSourcesTable, WebSourcesView } from "@/components/viz/web-sources-view";
import type { WebData } from "@/lib/web/queries";
import {
  alignedDailySeries,
  averageSessionSeconds,
  bounceRate,
  foldBreakdown,
  foldPages,
  sourcesByMonth,
  sumWebDaily,
  usersForRange,
  webDelta,
} from "@/lib/web/data";

/**
 * Le tableau de bord du Site Web — la réplique du rapport Looker, dans la
 * grammaire de la maison. Trois bandes, chacune répondant à une question :
 *
 *   1. les chiffres — quatre cartes, chacune avec sa double courbe : la
 *      période, et la même un an plus tôt (le trafic d'un site se juge
 *      contre sa saison, pas contre le mois d'avant) ;
 *   2. l'audience — qui visite (nouveaux, appareils, villes) et d'où vient
 *      le trafic, mois par mois sur l'année écoulée ;
 *   3. le détail — les pages du site.
 */
export function WebDashboard({
  data,
  period,
}: {
  data: WebData;
  period: { label: string; comparison: string };
}) {
  const totals = sumWebDaily(data.daily);
  const previousTotals = sumWebDaily(data.previousDaily);

  const users = usersForRange({
    range: data.range,
    monthly: data.monthly,
    dailySum: totals.users,
  });
  const previousUsers = usersForRange({
    range: data.previousRange,
    monthly: data.previousMonthly,
    dailySum: previousTotals.users,
  });

  const spark = (value: (row: (typeof data.daily)[number]) => number | null) =>
    alignedDailySeries({
      range: data.range,
      previousRange: data.previousRange,
      current: data.daily,
      previous: data.previousDaily,
      value,
    });

  const hasPrevious = data.previousDaily.length > 0;
  const previousOr = (value: number | null) => (hasPrevious ? value : null);

  const sources = sourcesByMonth(data.sourcesYear);
  const { pages, total: pagesTotal } = foldPages(data.pages);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WebKpiCard
          label="Nombre total d'utilisateurs"
          value={users.value}
          kind="integer"
          delta={webDelta(
            users.value,
            previousOr(previousUsers.value),
            "up-good",
          )}
          points={spark((row) => row.total_users)}
          comparisonLabel={period.comparison}
          note={
            users.exact
              ? undefined
              : "Somme des visiteurs quotidiens — sur une plage libre, un même visiteur peut compter deux fois."
          }
        />
        <WebKpiCard
          label="Durée moyenne de la session"
          value={averageSessionSeconds(totals)}
          kind="duration"
          delta={webDelta(
            averageSessionSeconds(totals),
            previousOr(averageSessionSeconds(previousTotals)),
            "up-good",
          )}
          points={spark((row) =>
            row.sessions > 0 ? Number(row.session_seconds) / row.sessions : null,
          )}
          comparisonLabel={period.comparison}
        />
        <WebKpiCard
          label="Sessions"
          value={totals.sessions}
          kind="integer"
          delta={webDelta(
            totals.sessions,
            previousOr(previousTotals.sessions),
            "up-good",
          )}
          points={spark((row) => row.sessions)}
          comparisonLabel={period.comparison}
        />
        <WebKpiCard
          label="Taux de rebond"
          value={bounceRate(totals)}
          kind="percent"
          delta={webDelta(
            bounceRate(totals),
            previousOr(bounceRate(previousTotals)),
            "down-good",
          )}
          points={spark((row) =>
            row.sessions > 0 ? 1 - row.engaged_sessions / row.sessions : null,
          )}
          comparisonLabel={period.comparison}
        />
      </div>

      {/* Persona à gauche, sources à droite : on lit d'abord qui visite,
          ensuite par où ils arrivent. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel>
          <PanelHeader
            title="Persona"
            description={`Répartition des visiteurs — ${period.label}.`}
          />
          <PanelBody>
            <div className="grid gap-6 md:grid-cols-3">
              <Breakdown title="Visiteurs">
                <BarList data={foldBreakdown(data.breakdowns, "retention")} />
              </Breakdown>
              <Breakdown title="Appareils">
                <BarList data={foldBreakdown(data.breakdowns, "device")} />
              </Breakdown>
              <Breakdown title="Villes">
                <BarList data={foldBreakdown(data.breakdowns, "city")} />
              </Breakdown>
            </div>
          </PanelBody>
        </Panel>

        <VizCard
          title="Sources de trafic"
          subtitle="Sessions par source, mois par mois sur l'année écoulée — quelle que soit la période choisie"
          chart={<WebSourcesView data={sources} />}
          table={<WebSourcesTable data={sources} />}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Top Pages"
          count={pages.length}
          description="Pages vues sur la période. Cliquer un en-tête trie le tableau ; le total est recalculé sur les agrégats."
        />
        <PanelBody>
          <WebPagesTable pages={pages} total={pagesTotal} />
        </PanelBody>
      </Panel>
    </div>
  );
}

/** Une répartition dans le panneau Persona — même forme que le Meta Ads. */
function Breakdown({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="type-overline text-text-secondary mb-3">{title}</p>
      {children}
    </div>
  );
}
