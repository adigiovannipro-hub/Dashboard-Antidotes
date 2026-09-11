"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ADJUSTMENT_SECTION_TITLE,
  totalContextTokens,
  type ContextSection,
} from "@/lib/context/injected-context";
import {
  estimateTokens,
  INJECTED_CONTEXT_TOKEN_LIMIT,
} from "@/lib/context/token-estimate";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * « Voir le prompt injecté » — le texte **exact** envoyé au modèle.
 *
 * Elle ne vaudrait rien si elle montrait autre chose que ce que la génération
 * envoie, et c'était précisément le défaut d'avant : le compteur de l'écran
 * mesurait une chaîne assemblée par `buildInjectedContext()`, que la
 * génération n'utilisait pas. Les sections affichées ici sont celles que
 * `getClientContext()` sert au worker, dans le même ordre, produites par la
 * même fonction.
 *
 * L'ajustement à chaud se compose localement : taper dans le champ ne doit pas
 * coûter un aller-retour serveur, et il n'est de toute façon jamais persisté.
 */
export function InjectedPromptDialog({
  sections,
  targetMonthLabel,
}: {
  sections: ContextSection[];
  targetMonthLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [adjustment, setAdjustment] = useState("");

  const shown = useMemo(() => {
    const texte = adjustment.trim();
    if (texte.length === 0) return sections;
    return [
      ...sections,
      {
        titre: ADJUSTMENT_SECTION_TITLE,
        texte,
        tokens: estimateTokens(`${ADJUSTMENT_SECTION_TITLE} :\n${texte}`),
      },
    ];
  }, [adjustment, sections]);

  const total = totalContextTokens(shown);
  const overBudget = total > INJECTED_CONTEXT_TOKEN_LIMIT;

  return (
    <>
      <Button
        variant="outline"
        data-icon="inline-start"
        onClick={() => setOpen(true)}
      >
        <Eye aria-hidden strokeWidth={1.75} />
        Voir le prompt injecté
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt injecté</DialogTitle>
            <DialogDescription>
              Texte exact envoyé au modèle pour une génération de{" "}
              {targetMonthLabel}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-line bg-canvas px-3 py-2">
            <p className="type-overline text-text-secondary">Total</p>
            <p
              className={cn(
                "type-label tabular-nums",
                overBudget ? "text-warning-ink" : "text-text-primary",
              )}
            >
              {formatValue(total, "integer")} tokens ·{" "}
              {formatValue(shown.length, "integer")} section
              {shown.length > 1 ? "s" : ""}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">
              Ajustement à chaud
            </span>
            <input
              value={adjustment}
              onChange={(event) => setAdjustment(event.target.value)}
              placeholder="Consigne d'une ligne, valable pour cette génération seulement."
              className="focus-visible:ring-ring h-10 w-full rounded-md border border-border-line bg-surface px-3 type-body text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          {shown.length === 0 ? (
            <p className="type-body text-text-secondary">
              Le brief est vide : aucune section ne part au modèle.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {shown.map((section) => (
                <section
                  key={section.titre}
                  className="rounded-md border border-border-line bg-surface"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-line px-3 py-2">
                    <h3 className="type-overline text-text-secondary">
                      {section.titre}
                    </h3>
                    <span className="type-caption tabular-nums text-text-secondary">
                      {formatValue(section.tokens, "integer")} tokens
                    </span>
                  </div>
                  {/* Le texte tel quel, retours à la ligne compris : c'est un
                    prompt qu'on relit, pas une page à mettre en forme. */}
                  <pre className="overflow-x-auto px-3 py-2 type-caption whitespace-pre-wrap text-text-primary">
                    {section.texte}
                  </pre>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
