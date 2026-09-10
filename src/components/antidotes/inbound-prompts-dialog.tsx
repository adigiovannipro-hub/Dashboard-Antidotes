"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { saveInboundPrompts, type InboundResult } from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PROMPTS,
  FORMAT_HINTS,
  INBOUND_FORMATS,
  resolvePrompt,
} from "@/lib/antidotes/inbound/prompts";
import {
  GENERATED_POST_FORMAT_LABELS,
  type GeneratedPostFormat,
  type InboundSettings,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

const EXAMPLE_PLACEHOLDERS: Record<GeneratedPostFormat, string> = {
  linkedin_post: "Collez un post dont la forme vous ressemble.",
  reel_script: "ACCROCHE (3 s) : …",
  youtube_script: "TITRE : …",
};

/**
 * Les prompts, dans une fenêtre : un onglet par forme, sa consigne et son
 * exemple.
 *
 * C'est le seul endroit de l'inbound où une explication a sa place — sans
 * elle, on ne sait pas que ce qui est écrit ici change ce que le modèle rend.
 *
 * Le champ est prérempli avec le prompt d'origine, et **un champ vidé revient
 * à ce prompt d'origine** plutôt que d'envoyer une consigne vide : ouvrir la
 * fenêtre une fois ne doit pas casser la génération.
 */
export function InboundPromptsDialog({ settings }: { settings: InboundSettings | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 aria-hidden />
        Prompts
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Mes prompts</DialogTitle>
            <DialogDescription>
              Ce que le modèle reçoit avant d&apos;écrire, forme par forme.
            </DialogDescription>
          </DialogHeader>
          <PromptsForm settings={settings} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PromptsForm({ settings, onDone }: { settings: InboundSettings | null; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(saveInboundPrompts, null);
  const [format, setFormat] = useState<GeneratedPostFormat>("linkedin_post");
  const last = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Enregistré.");
      router.refresh();
      onDone();
    } else {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="flex max-h-[70vh] flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
      <div className="grid gap-1">
        <Label htmlFor="cons-guidelines">Comment j&apos;écris</Label>
        <p className="type-caption text-text-secondary">
          Valable pour toutes les formes, et lu avant elles.
        </p>
        <TextArea
          id="cons-guidelines"
          name="guidelines"
          maxLength={4000}
          defaultValue={settings?.guidelines ?? ""}
          className="min-h-24"
          placeholder="Phrases courtes. Une idée par post. Jamais de « Voici ». Toujours un chiffre ou une situation vécue. Les émojis que j'utilise : aucun."
        />
      </div>

      <div>
        <div role="tablist" aria-label="Forme" className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1">
          {INBOUND_FORMATS.map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={format === entry}
              onClick={() => setFormat(entry)}
              className={cn(
                "type-caption focus-visible:ring-ring rounded-pill px-3 py-1.5 font-medium whitespace-nowrap transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                format === entry
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {GENERATED_POST_FORMAT_LABELS[entry]}
            </button>
          ))}
        </div>

        {/* Les trois panneaux restent montés : un onglet démonté perdrait la
            saisie en cours dès qu'on va comparer une autre forme, et le
            formulaire n'enverrait plus que la forme visible. */}
        {INBOUND_FORMATS.map((entry) => (
          <div key={entry} hidden={format !== entry} className="mt-4 grid gap-5 lg:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={`prompt-${entry}`}>Le prompt</Label>
              <p className="type-caption text-text-secondary">{FORMAT_HINTS[entry]}</p>
              <TextArea
                id={`prompt-${entry}`}
                name={`prompt_${entry}`}
                maxLength={8000}
                defaultValue={resolvePrompt(settings, entry).custom ? (settings?.prompts?.[entry]?.prompt ?? "") : DEFAULT_PROMPTS[entry]}
                className="min-h-64 font-mono"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`exemple-${entry}`}>Un exemple à imiter</Label>
              <p className="type-caption text-text-secondary">
                Un texte de moi : c&apos;est lui qui porte le ton, les tournures et les émojis.
              </p>
              <TextArea
                id={`exemple-${entry}`}
                name={`exemple_${entry}`}
                maxLength={8000}
                defaultValue={resolvePrompt(settings, entry).example ?? ""}
                className="min-h-64"
                placeholder={EXAMPLE_PLACEHOLDERS[entry]}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-1">
        <Label htmlFor="cons-email">Un email à moi</Label>
        <p className="type-caption text-text-secondary">
          Sert aux séquences de l&apos;outbound, pas à l&apos;inbound.
        </p>
        <TextArea
          id="cons-email"
          name="emailExample"
          maxLength={4000}
          defaultValue={settings?.email_example ?? ""}
          className="min-h-24"
          placeholder="Un message de prospection écrit de votre main."
        />
      </div>

      </div>

      {/* Hors de la zone qui défile : le bouton d'enregistrement doit rester
          sous la main quel que soit l'endroit du formulaire où l'on est. */}
      <div className="flex shrink-0 justify-end border-t border-border pt-4">
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">
            Enregistrer
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
