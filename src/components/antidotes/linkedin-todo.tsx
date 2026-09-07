"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Reply } from "lucide-react";
import { toast } from "sonner";

import { completeLinkedinStep } from "@/app/actions/antidotes-sequences";
import { PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { relativeDays } from "@/lib/antidotes/dates";
import { contactDisplayName } from "@/lib/antidotes/types";
import type { LinkedinTodo as LinkedinTodoRow } from "@/lib/antidotes/sequences/queries";

/**
 * Les pistes LinkedIn à faire à la main : un contact à l'adresse risquée ne
 * reçoit pas d'email, on lui écrit soi-même. Chaque ligne donne le message
 * pré-rédigé (copie en un clic), le profil, et deux issues — fait, ou a
 * répondu. Aucune automatisation : le risque de restriction du compte est
 * disproportionné.
 */
export function LinkedinTodo({
  rows,
  messages,
}: {
  rows: LinkedinTodoRow[];
  /** Le message rendu par inscription, calculé côté serveur. */
  messages: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function close(enrollmentId: string, outcome: "done" | "replied") {
    setBusy(enrollmentId);
    startTransition(async () => {
      const result = await completeLinkedinStep({ enrollmentId, outcome, message: messages[enrollmentId] });
      if (result.ok) {
        toast.success(result.message ?? "Fait.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setBusy(null);
    });
  }

  async function copy(enrollmentId: string) {
    try {
      await navigator.clipboard.writeText(messages[enrollmentId] ?? "");
      toast.success("Message copié.");
    } catch {
      toast.error("Copie impossible : sélectionnez le texte.");
    }
  }

  return (
    <PanelRows>
      {rows.map((row) => {
        const name = contactDisplayName(row.contact);
        const isBusy = pending && busy === row.enrollment.id;
        return (
          <div key={row.enrollment.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-label text-text-primary">{name}</span>
                <span className="type-caption text-text-secondary">{row.prospect.company_name}</span>
                <StatusPill tone="neutral" dot={false}>{row.sequence.name}</StatusPill>
                <span className="type-caption text-text-secondary">inscrit {relativeDays(row.enrollment.enrolled_at)}</span>
              </div>
              <p className="type-body whitespace-pre-wrap rounded-md border border-border bg-surface-sunken px-3 py-2 text-text-primary">
                {messages[row.enrollment.id]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
              <Button type="button" size="sm" variant="outline" onClick={() => copy(row.enrollment.id)}>
                <Copy aria-hidden />
                Copier
              </Button>
              {row.contact.linkedin_url ? (
                <Button
                  render={<a href={row.contact.linkedin_url} target="_blank" rel="noreferrer" />}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink aria-hidden />
                  Profil
                </Button>
              ) : null}
              <Button type="button" size="sm" disabled={isBusy} onClick={() => close(row.enrollment.id, "done")}>
                <Check aria-hidden />
                Envoyé
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => close(row.enrollment.id, "replied")}>
                <Reply aria-hidden />
                A répondu
              </Button>
            </div>
          </div>
        );
      })}
    </PanelRows>
  );
}
