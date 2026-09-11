"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { clearMonthlyInstruction, saveGenerationSettings } from "@/app/actions/context";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  isTemporalContextStale,
  monthlyInstructionState,
  TEMPORAL_CONTEXT_STALE_DAYS,
} from "@/lib/context/freshness";
import { safeAction } from "@/lib/context/safe-action";
import type { ClientGenerationSettings } from "@/lib/context/types";
import { monthLabelLower } from "@/lib/production/phases";

/**
 * Le pilotage de la génération : trois leviers, à part du brief.
 *
 * À part parce qu'ils ne décrivent pas la marque mais le **moment**, et qu'ils
 * vivent donc dans `client_generation_settings`, non versionnée : une consigne
 * de deux lignes n'a pas à fabriquer une version de brief de plus, sinon
 * l'historique devient illisible en un mois.
 *
 * La consigne du mois ne s'efface par aucun trigger ni cron — la lecture
 * compare son mois à celui qui est généré et l'ignore si elle ne vise plus
 * rien. Ici l'écran le dit, et propose le bouton. Une donnée qui s'efface
 * toute seule est une donnée qu'on ne peut plus expliquer.
 */
export function PilotagePanel({
  workspaceSlug,
  settings,
  targetMonth,
  targetMonthLabel,
}: {
  workspaceSlug: string;
  settings: ClientGenerationSettings | null;
  /** Mois visé par la prochaine génération, `YYYY-MM-01`. */
  targetMonth: string;
  targetMonthLabel: string;
}) {
  const router = useRouter();
  const [permanent, setPermanent] = useState(settings?.permanent_instructions ?? "");
  const [monthly, setMonthly] = useState(settings?.monthly_instruction ?? "");
  const [temporal, setTemporal] = useState(settings?.temporal_context ?? "");
  const [pending, startSave] = useTransition();

  const etat = monthlyInstructionState({
    instruction: settings?.monthly_instruction,
    month: settings?.monthly_instruction_month,
    targetMonth,
  });
  const temporalStale = isTemporalContextStale(settings?.temporal_context_at, new Date());

  function save(patch: Parameters<typeof saveGenerationSettings>[1]) {
    startSave(async () => {
      const outcome = await safeAction(() =>
        saveGenerationSettings({ workspace: workspaceSlug }, patch),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      router.refresh();
    });
  }

  function clear() {
    startSave(async () => {
      const outcome = await safeAction(() =>
        clearMonthlyInstruction({ workspace: workspaceSlug }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setMonthly("");
      toast.success(outcome.message ?? "Consigne effacée.");
      router.refresh();
    });
  }

  return (
    <Panel id="pilotage" className="scroll-mt-24">
      <PanelHeader title="Pilotage de la génération" />
      <PanelBody className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="type-overline text-text-secondary">Instructions permanentes</span>
          <textarea
            value={permanent}
            rows={5}
            disabled={pending}
            placeholder="Injectées à chaque génération, indéfiniment."
            onChange={(event) => setPermanent(event.target.value)}
            onBlur={() => {
              if (permanent.trim() === (settings?.permanent_instructions ?? "").trim()) return;
              save({ permanent_instructions: permanent });
            }}
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-overline text-text-secondary">Consigne du mois</span>
            {etat === "active" ? (
              <StatusPill tone="positive">Injectée pour {targetMonthLabel}</StatusPill>
            ) : null}
            {etat === "perimee" ? (
              <StatusPill tone="warning">
                {settings?.monthly_instruction_month
                  ? `Visait ${monthLabelLower(settings.monthly_instruction_month.slice(0, 7))} — plus injectée`
                  : "Sans mois — plus injectée"}
              </StatusPill>
            ) : null}
          </div>
          <textarea
            value={monthly}
            rows={3}
            disabled={pending}
            aria-label="Consigne du mois"
            placeholder={`Consigne valable pour ${targetMonthLabel} seulement.`}
            onChange={(event) => setMonthly(event.target.value)}
            onBlur={() => {
              if (monthly.trim() === (settings?.monthly_instruction ?? "").trim()) return;
              /* Le mois part avec le texte : une consigne sans mois n'a pas de
                 fin de vie, et la lecture la traiterait en périmée sans que
                 personne comprenne pourquoi. */
              save({ monthly_instruction: monthly, monthly_instruction_month: targetMonth });
            }}
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          />
          {etat !== "absente" ? (
            <div>
              <Button size="sm" variant="ghost" disabled={pending} onClick={clear}>
                Effacer
              </Button>
            </div>
          ) : null}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="type-overline text-text-secondary">Temps forts du moment</span>
          <textarea
            value={temporal}
            rows={2}
            disabled={pending}
            placeholder="Court. Ce qui se passe ce mois-ci chez le client ou dans son secteur."
            onChange={(event) => setTemporal(event.target.value)}
            onBlur={() => {
              if (temporal.trim() === (settings?.temporal_context ?? "").trim()) return;
              save({ temporal_context: temporal });
            }}
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          />
          {settings?.temporal_context && temporalStale ? (
            <span className="type-caption text-warning-ink">
              Écrit il y a plus de {TEMPORAL_CONTEXT_STALE_DAYS} jours — plus injecté.
            </span>
          ) : null}
        </label>
      </PanelBody>
    </Panel>
  );
}
