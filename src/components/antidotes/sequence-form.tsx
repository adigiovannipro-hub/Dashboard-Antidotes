"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveSequence, type SequencesResult } from "@/app/actions/antidotes-sequences";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SequenceSettings } from "@/lib/antidotes/sequences/defaults";
import { TEMPLATE_VARIABLE_LABELS, TEMPLATE_VARIABLES } from "@/lib/antidotes/sequences/templates";
import type { Sequence, SequenceStep } from "@/lib/antidotes/types";

const DAY_LABELS: Record<number, string> = { 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam", 7: "Dim" };

type EditableStep = { key: number; delay_days: number; subject_template: string; body_template: string };

/**
 * Les réglages d'une séquence et ses étapes, dans un seul formulaire : le
 * cahier des charges veut le nombre d'étapes et les délais réglables par
 * séquence, et les gabarits sont ce que l'utilisateur réécrit avec sa voix.
 *
 * Les variables sont rappelées au-dessus des étapes plutôt que dans une
 * infobulle : on ne devine pas `{{lien_case_study}}`.
 */
export function SequenceForm({
  sequence,
  settings,
  steps,
}: {
  sequence: Sequence;
  settings: SequenceSettings;
  steps: SequenceStep[];
}) {
  const [state, formAction, pending] = useActionState<SequencesResult | null, FormData>(saveSequence, null);
  const lastState = useRef<SequencesResult | null>(null);
  const [items, setItems] = useState<EditableStep[]>(() =>
    steps.map((step, index) => ({
      key: index,
      delay_days: step.delay_days,
      subject_template: step.subject_template,
      body_template: step.body_template,
    })),
  );
  const nextKey = useRef(steps.length);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) toast.success(state.message ?? "Enregistré.");
    else toast.error(state.error);
  }, [state]);

  function addStep() {
    setItems((current) => {
      const last = current[current.length - 1];
      return [
        ...current,
        {
          key: nextKey.current++,
          delay_days: (last?.delay_days ?? 0) + 5,
          subject_template: last?.subject_template ?? "",
          body_template: "",
        },
      ];
    });
  }

  function removeStep(key: number) {
    setItems((current) => (current.length > 1 ? current.filter((step) => step.key !== key) : current));
  }

  function patchStep(key: number, patch: Partial<EditableStep>) {
    setItems((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="sequenceId" value={sequence.id} />
      <input type="hidden" name="stepCount" value={items.length} />

      <Panel>
        <PanelHeader title="Séquence" />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" htmlFor="s-name">
            <Input id="s-name" name="name" required maxLength={120} defaultValue={sequence.name} />
          </Field>
          <Field label="Signature" htmlFor="s-sender" hint="{{expediteur}}">
            <Input id="s-sender" name="senderName" maxLength={120} defaultValue={settings.sender_name ?? ""} placeholder="Sandro — Antidotes" />
          </Field>
          <Field label="Description" htmlFor="s-description" hint="pour vous">
            <Input id="s-description" name="description" maxLength={500} defaultValue={sequence.description ?? ""} />
          </Field>
          <Field label="Lien du case study" htmlFor="s-case" hint="{{lien_case_study}}">
            <Input id="s-case" name="caseStudyUrl" type="url" defaultValue={settings.case_study_url ?? ""} placeholder="https://…" />
          </Field>
          <label className="type-caption flex items-center gap-2 text-text-primary">
            <input type="checkbox" name="isActive" defaultChecked={sequence.is_active} className="size-4 accent-[var(--accent-ink)]" />
            Séquence active
          </label>
          <label className="type-caption flex items-center gap-2 text-text-primary">
            <input type="checkbox" name="requireObservation" defaultChecked={settings.require_observation} className="size-4 accent-[var(--accent-ink)]" />
            Attendre l&apos;observation avant le premier envoi
          </label>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Envois" description="Les emails partent depuis la boîte Gmail des Reçus." />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Emails par jour, au plus" htmlFor="s-cap">
            <Input id="s-cap" name="dailyCap" type="number" min={1} max={500} defaultValue={settings.daily_cap} />
          </Field>
          <fieldset className="grid gap-1">
            <legend className="type-label mb-1">Jours d&apos;envoi</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <label key={day} className="type-caption flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-text-primary">
                  <input type="checkbox" name="windowDay" value={day} defaultChecked={settings.send_window.days.includes(day)} className="size-3.5 accent-[var(--accent-ink)]" />
                  {DAY_LABELS[day]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="De (heure de Paris)" htmlFor="s-start">
            <Input id="s-start" name="startHour" type="number" min={0} max={23} defaultValue={settings.send_window.start_hour} />
          </Field>
          <Field label="Jusqu'à (exclu)" htmlFor="s-end">
            <Input id="s-end" name="endHour" type="number" min={1} max={24} defaultValue={settings.send_window.end_hour} />
          </Field>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Étapes"
          count={items.length}
          action={
            <Button type="button" size="sm" variant="outline" onClick={addStep} disabled={items.length >= 8}>
              <Plus aria-hidden />
              Ajouter une étape
            </Button>
          }
        />
        <PanelBody className="space-y-5">
          <p className="type-caption flex flex-wrap gap-x-3 gap-y-1 text-text-secondary">
            {TEMPLATE_VARIABLES.map((variable) => (
              <span key={variable}>
                <code className="rounded-sm bg-surface-sunken px-1 text-text-primary">{`{{${variable}}}`}</code> {TEMPLATE_VARIABLE_LABELS[variable]}
              </span>
            ))}
            <span>
              Repli : <code className="rounded-sm bg-surface-sunken px-1 text-text-primary">{"{{prenom|à vous}}"}</code>
            </span>
          </p>
          {items.map((step, index) => {
            const n = index + 1;
            return (
              <div key={step.key} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                <Field label={`Étape ${n} · J+`} htmlFor={`step-${n}-delay`}>
                  <Input
                    id={`step-${n}-delay`}
                    name={`step_${n}_delay`}
                    type="number"
                    min={0}
                    max={365}
                    value={step.delay_days}
                    onChange={(event) => patchStep(step.key, { delay_days: Number(event.target.value) || 0 })}
                  />
                </Field>
                <div className="grid gap-3">
                  <Field label="Objet" htmlFor={`step-${n}-subject`}>
                    <Input
                      id={`step-${n}-subject`}
                      name={`step_${n}_subject`}
                      required
                      maxLength={200}
                      value={step.subject_template}
                      onChange={(event) => patchStep(step.key, { subject_template: event.target.value })}
                    />
                  </Field>
                  <Field label="Corps" htmlFor={`step-${n}-body`}>
                    <TextArea
                      id={`step-${n}-body`}
                      name={`step_${n}_body`}
                      required
                      maxLength={5000}
                      className="min-h-36"
                      value={step.body_template}
                      onChange={(event) => patchStep(step.key, { body_template: event.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:pt-6">
                  <button
                    type="button"
                    onClick={() => removeStep(step.key)}
                    disabled={items.length <= 1}
                    aria-label={`Supprimer l'étape ${n}`}
                    className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Piste LinkedIn" description="Le message pré-rédigé pour les contacts à l'adresse risquée." />
        <PanelBody>
          <TextArea
            name="linkedinMessage"
            aria-label="Message LinkedIn"
            maxLength={2000}
            className="min-h-28"
            defaultValue={settings.linkedin_message}
          />
        </PanelBody>
      </Panel>

      <div>
        <Button type="submit" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">
            Enregistrer
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor}>
        {label}
        {hint ? <span className="type-caption font-normal text-text-secondary">{hint}</span> : null}
      </Label>
      {children}
    </div>
  );
}
