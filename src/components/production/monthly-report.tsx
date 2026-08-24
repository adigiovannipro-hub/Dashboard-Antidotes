import { FileText, Sparkles } from "lucide-react";

import { formatDayFr } from "@/lib/format";
import { firstSentence, parseReport } from "@/lib/production/report-markdown";
import type { ClientReport } from "@/lib/production/types";

/**
 * La synthèse du mois, produite par la phase Reporting de la carte cockpit.
 *
 * **Interne, jamais client.** Elle est écrite par un modèle à partir des
 * chiffres de la page : elle sert à préparer le point mensuel, pas à le
 * livrer. L'appelant ne la rend qu'au propriétaire, et la RLS de 0057 la
 * ferme de toute façon à tout le monde d'autre.
 *
 * Repliée par défaut, avec la première phrase en aperçu : deux pages de texte
 * en tête d'écran repousseraient tous les chiffres sous la ligne de
 * flottaison, et un panneau qui ne dit pas de quoi il parle ne s'ouvre jamais.
 *
 * `<details>` natif, comme les groupes des Échéances : aucun état client, donc
 * rien à hydrater.
 */
export function MonthlyReport({
  report,
  monthLabel,
}: {
  report: ClientReport;
  monthLabel: string;
}) {
  const blocks = parseReport(report.report);
  const teaser = firstSentence(report.report);
  const sources = [
    report.has_ads_data ? "chiffres publicitaires" : null,
    report.has_organic_data ? "chiffres organiques" : null,
  ].filter((entry): entry is string => entry !== null);

  return (
    <details className="group rounded-lg border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg p-4 transition-[background-color] duration-(--motion-duration) ease-standard hover:bg-surface-sunken focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none">
        <FileText
          aria-hidden
          strokeWidth={1.75}
          className="mt-0.5 size-4.5 shrink-0 text-text-tertiary"
        />
        <div className="min-w-0 flex-1">
          <p className="type-label text-text-primary">
            Synthèse de {monthLabel}
            <span className="type-micro ml-2 rounded-pill bg-surface-sunken px-1.5 py-0.5 text-text-secondary">
              interne
            </span>
          </p>
          {teaser ? (
            <p className="type-caption mt-0.5 text-text-secondary group-open:hidden">
              {teaser}
            </p>
          ) : null}
          <p className="type-micro mt-0.5 hidden text-text-secondary group-open:block">
            Rédigée le {formatDayFr(report.updated_at.slice(0, 10))}
            {sources.length > 0 ? ` · d'après les ${sources.join(" et ")}` : null}
            {sources.length === 0 ? " · d'après les seuls volumes du planning" : null}
          </p>
        </div>
        <Sparkles
          aria-hidden
          strokeWidth={1.75}
          className="mt-0.5 size-4 shrink-0 text-text-tertiary"
        />
      </summary>

      <div className="space-y-3 border-t border-border px-4 pt-4 pb-5">
        {blocks.map((block, index) => {
          const key = `${block.kind}-${index}`;
          if (block.kind === "heading") {
            // Un seul style de titre : le rapport n'a qu'un niveau utile, et
            // trois tailles dans un panneau replié feraient de la bouillie.
            return (
              <p key={key} className="type-h3 pt-2 text-text-primary first:pt-0">
                {block.text}
              </p>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={key} className="space-y-1.5 pl-4">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="type-body list-disc text-text-secondary marker:text-text-tertiary"
                  >
                    <Spans spans={item} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={key} className="type-body text-text-secondary">
              <Spans spans={block.spans} />
            </p>
          );
        })}
      </div>
    </details>
  );
}

function Spans({ spans }: { spans: { text: string; strong: boolean }[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.strong ? (
          <strong key={index} className="font-medium text-text-primary">
            {span.text}
          </strong>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  );
}
