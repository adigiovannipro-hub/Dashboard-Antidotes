"use client";

import { useCallback } from "react";
import { useActionState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Upload } from "lucide-react";

import { pushWording, syncNow } from "@/app/actions/planning";
import type { PlanningResult } from "@/app/actions/planning";
import { InsightRail } from "@/components/planning/insight-rail";
import { MonthGrid } from "@/components/planning/month-grid";
import { SubjectPanel } from "@/components/planning/subject-panel";
import { Button } from "@/components/ui/button";
import { flaggedSubjectIds } from "@/lib/planning/cadence";
import type { CadenceIssue } from "@/lib/planning/cadence";
import type { MonthHealth } from "@/lib/planning/health";
import { monthLabel } from "@/lib/planning/monday-mapping";
import { can } from "@/lib/planning/permissions";
import type { DeducedStrategy } from "@/lib/planning/strategy";
import type {
  MonthSummary,
  PlanningClient,
  PlanningRole,
  PlanningSyncRun,
  SubjectWithLane,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Vue mensuelle du planning éditorial, trois colonnes.
 *
 * L'état vit dans l'URL — client, mois, sujet ouvert. Un lien envoyé à un
 * collègue rouvre exactement le même écran, et le retour arrière du navigateur
 * fait ce qu'on attend.
 */
export function PlanningView({
  clients,
  client,
  role,
  months,
  month,
  subjects,
  health,
  issues,
  strategy,
  selectedSubject,
  lastSync,
}: {
  clients: PlanningClient[];
  client: PlanningClient;
  role: PlanningRole;
  months: MonthSummary[];
  month: MonthSummary | null;
  subjects: SubjectWithLane[];
  health: MonthHealth | null;
  issues: CadenceIssue[];
  strategy: DeducedStrategy | null;
  selectedSubject: SubjectWithLane | null;
  lastSync: PlanningSyncRun | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = useCallback(
    (subjectId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("sujet", subjectId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const chooseMonth = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("mois", value);
      // Changer de mois change la liste : le sujet ouvert n'existe plus dedans.
      next.delete("sujet");
      router.push(`${pathname}?${next}`);
    },
    [pathname, router, searchParams],
  );

  const flagged = flaggedSubjectIds(issues);
  const pendingCount = health?.pendingPush ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <nav className="flex items-center gap-1" aria-label="Clients">
          {clients.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/planning/${candidate.slug}`}
              aria-current={candidate.id === client.id ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                candidate.id === client.id
                  ? "bg-card text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {candidate.name}
            </Link>
          ))}
        </nav>

        {month ? (
          <>
            <label htmlFor="mois" className="sr-only">
              Mois
            </label>
            <select
              id="mois"
              value={month.month}
              onChange={(event) => chooseMonth(event.target.value)}
              className="border-input bg-background focus-visible:ring-brand h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {months.map((candidate) => (
                <option key={candidate.id} value={candidate.month}>
                  {monthLabel(candidate.month)} · {candidate.subject_count}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <LastSync run={lastSync} />

          {pendingCount > 0 && can(role, "sync.push") ? (
            <PushAllButton
              clientId={client.id}
              clientSlug={client.slug}
              count={pendingCount}
            />
          ) : null}

          {can(role, "sync.pull") ? (
            <SyncButton clientId={client.id} clientSlug={client.slug} />
          ) : null}
        </div>
      </div>

      {months.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex min-h-0 flex-1">
          <InsightRail health={health} issues={issues} strategy={strategy} />
          <MonthGrid
            subjects={subjects}
            flagged={flagged}
            selectedId={selectedSubject?.id ?? null}
            onSelect={select}
          />
          <SubjectPanel
            subject={selectedSubject}
            clientId={client.id}
            clientSlug={client.slug}
            role={role}
          />
        </div>
      )}
    </div>
  );
}

function SyncButton({
  clientId,
  clientSlug,
}: {
  clientId: string;
  clientSlug: string;
}) {
  const [state, action, pending] = useActionState<PlanningResult | null, FormData>(
    syncNow,
    null,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="clientSlug" value={clientSlug} />
      {state && !state.ok ? (
        <span role="status" className="text-brand-red max-w-md text-xs">
          {state.error}
        </span>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        <RefreshCw
          className={cn("size-3.5", pending && "animate-spin")}
          aria-hidden
        />
        {pending ? "Synchronisation…" : "Synchroniser"}
      </Button>
    </form>
  );
}

function PushAllButton({
  clientId,
  clientSlug,
  count,
}: {
  clientId: string;
  clientSlug: string;
  count: number;
}) {
  const [state, action, pending] = useActionState<PlanningResult | null, FormData>(
    pushWording,
    null,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="clientSlug" value={clientSlug} />
      {state && !state.ok ? (
        <span role="status" className="text-brand-red max-w-md text-xs">
          {state.error}
        </span>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        <Upload className="size-3.5" aria-hidden />
        {pending ? "Envoi…" : `Envoyer ${count} wording${count > 1 ? "s" : ""}`}
      </Button>
    </form>
  );
}

function LastSync({ run }: { run: PlanningSyncRun | null }) {
  if (!run) {
    return (
      <span className="text-muted-foreground text-xs">Jamais synchronisé</span>
    );
  }

  if (run.status === "error") {
    return (
      <span className="text-brand-red text-xs" title={run.error ?? undefined}>
        Dernière synchro en erreur
      </span>
    );
  }

  // Date absolue plutôt que « il y a 2 h » : le relatif demanderait l'heure
  // courante au rendu, ce qui rend le composant impur et fait diverger le
  // serveur du navigateur à l'hydratation.
  const at = run.finished_at ?? run.started_at;

  return (
    <time dateTime={at} className="text-muted-foreground text-xs">
      Synchro du{" "}
      {new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(at))}
    </time>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center p-10 text-center text-sm">
      <div className="max-w-md space-y-2">
        <p>Aucun board synchronisé pour ce client.</p>
        <p className="text-xs">
          Lancez <code className="bg-card rounded px-1">pnpm sync:planning</code>{" "}
          après avoir renseigné <code>MONDAY_API_TOKEN</code>, ou{" "}
          <code className="bg-card rounded px-1">pnpm seed:planning</code> pour
          voir le rendu sur des données de démonstration.
        </p>
      </div>
    </div>
  );
}
