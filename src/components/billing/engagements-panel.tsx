"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createEngagement,
  deleteEngagement,
  endEngagement,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/finance/money";
import {
  ENGAGEMENT_STATUS_LABELS,
  type BillingEngagement,
} from "@/lib/billing/types";

/**
 * Les engagements — la source des échéances.
 *
 * La création vit ici, repliée derrière « Ajouter » : c'est le geste d'un
 * devis signé, quelques fois par an, il n'a pas à occuper l'écran en
 * permanence. Le bouton porte la variante `accent`, réservée à la création —
 * seul aplat d'accent de la page.
 */
export function EngagementsPanel({
  engagements,
  canDecide,
}: {
  engagements: BillingEngagement[];
  canDecide: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Panel>
      <PanelHeader
        title="Engagements"
        count={engagements.length}
        description="Un devis signé = un engagement, ses échéances sont générées d'un coup."
        action={
          canDecide ? (
            <Button
              type="button"
              variant={formOpen ? "outline" : "accent"}
              size="sm"
              onClick={() => setFormOpen((previous) => !previous)}
            >
              {formOpen ? (
                "Fermer"
              ) : (
                <>
                  <Plus aria-hidden />
                  Ajouter
                </>
              )}
            </Button>
          ) : undefined
        }
      />

      {formOpen ? <CreateForm onCreated={() => setFormOpen(false)} /> : null}

      {engagements.length === 0 && !formOpen ? (
        <div className="p-5">
          <p className="type-body text-text-secondary">
            Aucun engagement. Ajoutez le premier devis signé pour générer ses
            échéances.
          </p>
        </div>
      ) : (
        <PanelRows>
          {engagements.map((engagement) => (
            <EngagementRow
              key={engagement.id}
              engagement={engagement}
              canDecide={canDecide}
            />
          ))}
        </PanelRows>
      )}
    </Panel>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(createEngagement, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      onCreated();
    } else {
      toast.error(state.error);
    }
    // `onCreated` referme le formulaire : le rejouer à chaque rendu le
    // refermerait pendant la saisie suivante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-border grid gap-3 border-b p-5 sm:grid-cols-2"
    >
      <div className="grid gap-1">
        <Label htmlFor="billing-client">Client</Label>
        <Input id="billing-client" name="clientName" required placeholder="Bondet" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="billing-label">Prestation</Label>
        <Input
          id="billing-label"
          name="label"
          required
          placeholder="Community management"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="billing-amount">Montant mensuel (€ HT)</Label>
        <Input
          id="billing-amount"
          name="monthlyAmount"
          required
          inputMode="decimal"
          placeholder="2 500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="billing-first">Premier mois</Label>
          <Input id="billing-first" name="firstMonth" type="month" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="billing-count">Mois</Label>
          <Input
            id="billing-count"
            name="monthsCount"
            type="number"
            min={1}
            max={60}
            defaultValue={12}
            required
          />
        </div>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Création…" : "Créer l'engagement et ses échéances"}
        </Button>
      </div>
    </form>
  );
}

function EngagementRow({
  engagement,
  canDecide,
}: {
  engagement: BillingEngagement;
  canDecide: boolean;
}) {
  const [endState, endAction, endPending] = useActionState<
    BillingActionResult | null,
    FormData
  >(endEngagement, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    BillingActionResult | null,
    FormData
  >(deleteEngagement, null);

  useEffect(() => {
    const state = endState ?? deleteState;
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [endState, deleteState]);

  const active = engagement.status === "active";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      {/* Le nom prend sa propre ligne au téléphone : coincé dans le rang
                flex, il se faisait tronquer jusqu'à « Bon… ». */}
            <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <p className="type-label text-text-primary truncate">
          {engagement.client_name}
          <span className="text-text-secondary font-normal">
            {" "}
            · {engagement.label}
          </span>
        </p>
        <p className="type-caption text-text-secondary">
          {formatMoney(engagement.monthly_amount_cents, engagement.currency)} / mois ·{" "}
          {engagement.months_count} mois à partir de{" "}
          {monthLabel(engagement.first_month)}
        </p>
      </div>

      <StatusPill tone={active ? "positive" : "neutral"}>
        {ENGAGEMENT_STATUS_LABELS[engagement.status]}
      </StatusPill>

      {canDecide ? (
        active ? (
          <form action={endAction}>
            <input type="hidden" name="engagementId" value={engagement.id} />
            <Button type="submit" variant="outline" size="sm" disabled={endPending}>
              Terminer
            </Button>
          </form>
        ) : (
          <form
            action={deleteAction}
            onSubmit={(event) => {
              // La suppression emporte aussi l'historique émis : elle mérite
              // une confirmation, contrairement à la clôture.
              if (
                !window.confirm(
                  "Supprimer cet engagement et toutes ses échéances, émises comprises ?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="engagementId" value={engagement.id} />
            <Button type="submit" variant="ghost" size="sm" disabled={deletePending}>
              Supprimer
            </Button>
          </form>
        )
      ) : null}
    </div>
  );
}

const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? isoMonth : MONTH.format(date);
}
