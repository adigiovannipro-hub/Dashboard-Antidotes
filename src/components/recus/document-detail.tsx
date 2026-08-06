"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  FileText,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import {
  approveDocument,
  ignoreDocument,
  relinkDocument,
  setMerchantAutomation,
  type ReceiptResult,
} from "@/app/actions/recus";
import { Button } from "@/components/ui/button";
import { formatAmount, senderDomain } from "@/lib/recus/heuristics";
import type { DocumentDetail as Detail } from "@/lib/recus/queries";
import {
  KIND_LABELS,
  MATCH_METHOD_LABELS,
  PDF_ORIGIN_LABELS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
} from "@/lib/recus/types";
import { cn } from "@/lib/utils";

/**
 * Colonne de droite : ce qu'on a compris de la pièce, et sur quelle ligne on
 * parie.
 *
 * L'écran est construit autour d'une seule question — *puis-je valider les yeux
 * fermés ?* — et donne donc la priorité à ce qui pourrait faire répondre non :
 * un montant absent, un rapprochement ambigu, un fournisseur jamais vu. Le
 * bouton de validation dit toujours ce qui va se passer, et refuse de mentir
 * quand aucune ligne n'a été trouvée.
 */
export function DocumentDetail({
  detail,
  canDecide,
  onAdvance,
}: {
  detail: Detail | null;
  canDecide: boolean;
  onAdvance: () => void;
}) {
  const [approveState, approve, approving] = useActionState<
    ReceiptResult | null,
    FormData
  >(approveDocument, null);
  const [ignoreState, ignore, ignoring] = useActionState<ReceiptResult | null, FormData>(
    ignoreDocument,
    null,
  );
  const [relinkState, relink, relinking] = useActionState<
    ReceiptResult | null,
    FormData
  >(relinkDocument, null);
  const [ruleState, setRule, settingRule] = useActionState<
    ReceiptResult | null,
    FormData
  >(setMerchantAutomation, null);

  useEffect(() => {
    for (const state of [approveState, ignoreState, relinkState, ruleState]) {
      if (!state) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.error);
    }
    // Les états sont les seules dépendances : les inclure toutes éviterait un
    // toast en boucle sur un re-rendu sans changement.
  }, [approveState, ignoreState, relinkState, ruleState]);

  useEffect(() => {
    if (approveState?.ok || ignoreState?.ok) onAdvance();
  }, [approveState, ignoreState, onAdvance]);

  if (!detail) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
        Sélectionner une pièce pour la vérifier.
      </div>
    );
  }

  const { document, expense, alternatives, rule, suggestAutomation } = detail;
  const busy = approving || ignoring || relinking || settingRule;
  const decided = TERMINAL_STATUSES.includes(document.status);
  const domain = senderDomain(document.from_email);

  const amount =
    document.amount_cents !== null && document.currency
      ? formatAmount(document.amount_cents, document.currency)
      : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="border-border border-b px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-heading truncate text-lg">
              {document.merchant ?? document.from_name ?? document.from_email}
            </h2>
            <p className="text-muted-foreground truncate text-sm">
              {document.subject ?? "(sans objet)"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {document.from_email} · reçu le{" "}
              {new Date(document.received_at).toLocaleDateString("fr-FR")}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {amount ? (
              <p className="font-heading text-xl tabular-nums">{amount}</p>
            ) : (
              <p className="text-danger-ink text-sm font-medium">Montant introuvable</p>
            )}
            <p className="text-muted-foreground mt-0.5 text-xs">
              {KIND_LABELS[document.kind]}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        {/* --- Ce que la lecture a compris --- */}
        <section className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-sm">Lecture</h3>
            <ConfidenceBadge value={document.classification_confidence} />
          </div>
          {document.classification_reason ? (
            <p className="text-muted-foreground mt-2 text-sm">
              {document.classification_reason}
            </p>
          ) : null}

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Date de la pièce" value={document.document_date} />
            <Field label="Numéro" value={document.invoice_number} />
            <Field
              label="TVA"
              value={
                document.tax_cents !== null && document.currency
                  ? formatAmount(document.tax_cents, document.currency)
                  : null
              }
            />
            <Field
              label="Analysée par"
              value={document.classified_by === "llm" ? "Modèle" : "Règles simples"}
            />
          </dl>

          {document.classified_by === "heuristics" ? (
            <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Analysée sans modèle : les montants n&apos;ont pas été relus. À vérifier
              avant validation.
            </p>
          ) : null}
        </section>

        {/* --- La ligne de frais pressentie --- */}
        <section className="bg-card rounded-xl p-4">
          <h3 className="font-heading text-sm">Ligne de frais</h3>

          {expense ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {expense.merchant ?? "Marchand inconnu"}
                </span>
                <span className="text-sm tabular-nums">
                  {formatAmount(expense.amount_cents, expense.currency)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {expense.transaction_date ?? "date inconnue"}
                {expense.card_last_four ? ` · carte ••${expense.card_last_four}` : ""}
                {expense.attachment_count > 0
                  ? ` · ${expense.attachment_count} pièce${expense.attachment_count > 1 ? "s" : ""} déjà jointe${expense.attachment_count > 1 ? "s" : ""}`
                  : " · aucune pièce jointe"}
              </p>
              <p className="text-muted-foreground text-xs">
                {MATCH_METHOD_LABELS[document.match_method]}
                {document.match_confidence !== null
                  ? ` · confiance ${Math.round(document.match_confidence * 100)} %`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-danger-ink mt-2 flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Aucune dépense carte ne correspond. La pièce peut tout de même être
              envoyée — Airwallex tentera son propre rapprochement — mais rien ne
              permettra de vérifier qu&apos;elle s&apos;est accrochée au bon endroit.
            </p>
          )}

          {alternatives.length > 0 && canDecide && !decided ? (
            <div className="border-border mt-4 space-y-2 border-t pt-3">
              <p className="text-muted-foreground text-xs font-medium">
                Autres lignes possibles
              </p>
              {alternatives.map(({ candidate, expense: option }) => (
                <form key={candidate.expense_id} action={relink}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <input type="hidden" name="expenseId" value={option.id} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="hover:bg-muted focus-visible:ring-ring flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {option.merchant ?? "Marchand inconnu"}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {candidate.reason}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatAmount(option.amount_cents, option.currency)}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </section>

        {/* --- Ce qui a été envoyé, une fois la décision prise --- */}
        {document.forwarded_at ? (
          <section className="bg-card rounded-xl p-4 text-sm">
            <h3 className="font-heading mb-2 text-sm">Transfert</h3>
            <p className="text-muted-foreground">
              Envoyé le{" "}
              {new Date(document.forwarded_at).toLocaleString("fr-FR")} ·{" "}
              {PDF_ORIGIN_LABELS[document.pdf_origin]}
              {document.auto_decided ? " · parti automatiquement" : ""}
            </p>
            <p className="mt-1">
              <strong className="font-medium">
                {STATUS_LABELS[document.status]}
              </strong>
              {document.status === "unmatched"
                ? " — la pièce est dans la boîte de reçus d'Airwallex mais n'a pas été accrochée. À rattacher à la main depuis leur interface."
                : ""}
            </p>
          </section>
        ) : null}

        {document.failure_reason ? (
          <p
            role="alert"
            className="border-destructive/40 text-destructive rounded-lg border p-3 text-sm"
          >
            {document.failure_reason}
          </p>
        ) : null}

        {/* --- Proposition d'automatisme --- */}
        {suggestAutomation && canDecide ? (
          <form action={setRule} className="border-brand-mint rounded-xl border p-4">
            <input type="hidden" name="domain" value={domain} />
            <input type="hidden" name="enabled" value="true" />
            <p className="flex items-start gap-2 text-sm">
              <Sparkles className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Vous avez validé {rule?.approvals} factures de{" "}
                <strong className="font-medium">{domain}</strong> sans jamais en
                refuser. Les suivantes peuvent partir seules.
              </span>
            </p>
            <Button type="submit" size="sm" variant="secondary" className="mt-3" disabled={busy}>
              Automatiser ce fournisseur
            </Button>
          </form>
        ) : null}

        {rule?.auto_forward ? (
          <form action={setRule} className="text-muted-foreground text-xs">
            <input type="hidden" name="domain" value={domain} />
            <input type="hidden" name="enabled" value="false" />
            <span>Les factures de {domain} partent automatiquement. </span>
            <button type="submit" className="underline" disabled={busy}>
              Repasser en validation manuelle
            </button>
          </form>
        ) : null}
      </div>

      {/* --- Barre de décision --- */}
      {canDecide && !decided && !document.forwarded_at ? (
        <div className="border-border bg-background sticky bottom-0 mt-auto flex items-center gap-2 border-t px-5 py-3">
          <form action={approve}>
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" disabled={busy}>
              <Send aria-hidden />
              {expense
                ? "Valider et envoyer à Airwallex"
                : "Envoyer sans ligne rapprochée"}
            </Button>
          </form>

          <form action={ignore}>
            <input type="hidden" name="documentId" value={document.id} />
            <Button type="submit" variant="ghost" disabled={busy}>
              <X aria-hidden />
              Ignorer
            </Button>
          </form>

          <span className="text-muted-foreground ml-auto text-xs">
            {expense ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5" aria-hidden />
                Ligne identifiée, accrochage vérifiable
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden />
                Envoi sans vérification possible
              </span>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn(value ? "" : "text-muted-foreground")}>{value ?? "—"}</dd>
    </div>
  );
}

/**
 * La confiance est affichée en clair plutôt qu'en couleur seule : une pastille
 * verte ou rouge ne dit rien à qui ne connaît pas l'échelle, et rien du tout à
 * qui ne distingue pas les deux.
 */
function ConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const level = value >= 0.9 ? "haute" : value >= 0.6 ? "moyenne" : "faible";

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        value >= 0.9
          ? "bg-brand-mint text-heading"
          : value >= 0.6
            ? "bg-muted text-foreground"
            : "text-danger-ink border-brand-red/40 border",
      )}
    >
      Confiance {level} · {percent} %
    </span>
  );
}
