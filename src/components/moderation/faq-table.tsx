"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { saveFaqEntry, submitFaqForReview } from "@/app/actions/moderation";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { needsRework } from "@/lib/moderation/faq-search";
import {
  FAQ_CLIENT_REVIEW_LABELS,
  type FaqClientReview,
  type FaqEntry,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Écran FAQ : les éléments de langage du client, éditables en place.
 *
 * L'ordre des colonnes suit la lecture : le **titre** est l'ancre (celui des
 * boards Monday), la catégorie situe, puis la question et sa réponse. La
 * validation client dit où en est le contrat de parole, l'origine d'où vient
 * l'entrée. Les statistiques d'apprentissage restent — en pictos compacts,
 * elles qualifient sans encombrer.
 *
 * ⌘F saute dans la recherche : chercher ici veut dire chercher une réponse,
 * pas du texte de page — le même geste que le planning.
 */

const REVIEW_TONES: Record<FaqClientReview, StatusTone> = {
  pending: "warning",
  approved: "positive",
  rejected: "danger",
};

/** D'où vient l'entrée — dérivé, jamais saisi. */
function originOf(entry: FaqEntry): string {
  if (entry.monday_item_id) return "Monday";
  if (entry.correction_count > 0 && !entry.created_by) return "Correction";
  return entry.created_by ? "Manuel" : "Import";
}

export function FaqTable({
  clientId,
  entries,
  categories,
  highlightId,
  canEdit,
}: {
  clientId: string;
  entries: FaqEntry[];
  categories: { id: string; name: string }[];
  highlightId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [reworkOnly, setReworkOnly] = useState(false);
  const [editing, setEditing] = useState<FaqEntry | null | "new">(null);
  const [submitPending, startSubmit] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘F / Ctrl+F : chercher dans la FAQ, pas dans la page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (reworkOnly && !needsRework(entry)) return false;
        if (!needle) return true;
        return (
          (entry.title ?? "").toLowerCase().includes(needle) ||
          entry.question_canonical.toLowerCase().includes(needle) ||
          entry.variants.some((variant) => variant.toLowerCase().includes(needle)) ||
          (entry.answer_fr ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // À retravailler d'abord, puis les plus utilisées.
        const rework = Number(needsRework(b)) - Number(needsRework(a));
        if (rework !== 0) return rework;
        return b.usage_count - a.usage_count;
      });
  }, [entries, query, reworkOnly]);

  const reworkCount = entries.filter(needsRework).length;
  const unsubmitted = entries.filter(
    (entry) => entry.active && entry.client_review === null,
  );

  const submitAll = () => {
    startSubmit(async () => {
      const result = await submitFaqForReview({
        clientId,
        entryIds: unsubmitted.map((entry) => entry.id),
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Panel>
      <PanelHeader
        title="Éléments de langage"
        count={rows.length}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-56">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher (⌘F)"
                aria-label="Rechercher dans la FAQ"
                className="pl-9"
              />
            </div>

            <label className="type-label flex items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={reworkOnly}
                onChange={(event) => setReworkOnly(event.target.checked)}
                className="accent-brand size-4"
              />
              À retravailler
              {reworkCount > 0 ? (
                <StatusPill tone="danger" dot={false}>
                  {reworkCount}
                </StatusPill>
              ) : null}
            </label>

            {canEdit && unsubmitted.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitPending}
                onClick={submitAll}
                title="Les entrées jamais soumises passent « À valider » chez le client"
              >
                <Send className="size-4" strokeWidth={1.75} aria-hidden />
                <PendingLabel pending={submitPending} busy="Envoi…">
                  Soumettre au client ({unsubmitted.length})
                </PendingLabel>
              </Button>
            ) : null}

            {canEdit ? (
              <Button type="button" size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                Ajouter
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="overflow-x-auto p-5 pt-4">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-[var(--viz-grid)] text-left text-xs">
              <th scope="col" className="px-2 pb-2 font-medium">Titre</th>
              <th scope="col" className="px-2 pb-2 font-medium">Catégorie</th>
              <th scope="col" className="px-2 pb-2 font-medium">Question</th>
              <th scope="col" className="px-2 pb-2 font-medium">Réponse</th>
              <th scope="col" className="px-2 pb-2 font-medium">Client</th>
              <th scope="col" className="px-2 pb-2 font-medium">Origine</th>
              <th scope="col" className="px-2 pb-2 text-right font-medium">Usages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const rework = needsRework(entry);
              return (
                <tr
                  key={entry.id}
                  id={entry.id}
                  onClick={canEdit ? () => setEditing(entry) : undefined}
                  className={cn(
                    "border-b border-[var(--viz-grid)] align-top",
                    entry.id === highlightId && "bg-brand-mint",
                    canEdit && "cursor-pointer hover:bg-surface-sunken",
                  )}
                >
                  <th
                    scope="row"
                    className="max-w-44 px-2 py-2.5 text-left align-top font-medium"
                  >
                    <span className="flex items-start gap-1.5">
                      {rework ? (
                        <AlertTriangle
                          className="text-danger-ink mt-0.5 size-3.5 shrink-0"
                          aria-label="À retravailler"
                        />
                      ) : null}
                      <span className="min-w-0">
                        {entry.title ?? entry.question_canonical}
                        {!entry.active ? (
                          <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                            (inactive)
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </th>
                  <td className="text-muted-foreground px-2 py-2.5">
                    {entry.category_id
                      ? (categoryNames.get(entry.category_id) ?? "—")
                      : "—"}
                  </td>
                  <td className="max-w-xs px-2 py-2.5">
                    <p className="line-clamp-2 text-text-secondary">
                      {entry.question_canonical}
                    </p>
                  </td>
                  <td className="max-w-sm px-2 py-2.5">
                    <p className="line-clamp-2 text-text-primary">
                      {entry.answer_fr ?? "—"}
                    </p>
                  </td>
                  <td className="px-2 py-2.5">
                    {entry.client_review ? (
                      <StatusPill tone={REVIEW_TONES[entry.client_review]}>
                        {FAQ_CLIENT_REVIEW_LABELS[entry.client_review]}
                      </StatusPill>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-2 py-2.5">
                    {originOf(entry)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {entry.usage_count}
                    {entry.correction_count > 0 ? (
                      <span
                        className={cn(
                          "ml-1.5 text-xs",
                          rework ? "text-danger-ink font-medium" : "text-text-secondary",
                        )}
                        title={`${entry.correction_count} corrections`}
                      >
                        ↺{entry.correction_count}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="type-body py-8 text-center text-text-secondary">
          Aucune entrée ne correspond.
        </p>
      ) : null}

      {editing !== null ? (
        <FaqEntryDialog
          clientId={clientId}
          entry={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Panel>
  );
}

/**
 * L'entrée en édition — création comprise. La catégorie est un champ libre à
 * suggestions : une catégorie nouvelle se crée au premier usage, comme les
 * étiquettes du planning.
 */
function FaqEntryDialog({
  clientId,
  entry,
  categories,
  onClose,
}: {
  clientId: string;
  entry: FaqEntry | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const categoryName = entry?.category_id
    ? (categories.find((category) => category.id === entry.category_id)?.name ?? "")
    : "";
  const [form, setForm] = useState({
    title: entry?.title ?? "",
    category: categoryName,
    question: entry?.question_canonical ?? "",
    answerFr: entry?.answer_fr ?? "",
    answerTiktok: entry?.answer_tiktok ?? "",
    active: entry?.active ?? true,
  });

  const save = () => {
    start(async () => {
      const result = await saveFaqEntry({
        clientId,
        entryId: entry?.id ?? null,
        title: form.title,
        categoryName: form.category,
        question: form.question,
        answerFr: form.answerFr,
        answerTiktok: form.answerTiktok,
        active: form.active,
      });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Modifier l'élément de langage" : "Nouvel élément de langage"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">Titre</span>
            <Input
              autoFocus
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="BON CADEAU REPORT"
              aria-label="Titre"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">Catégorie</span>
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              list="faq-categories"
              placeholder="GÉNÉRAL"
              aria-label="Catégorie"
            />
            <datalist id="faq-categories">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="type-overline text-text-secondary">Question</span>
          <textarea
            value={form.question}
            onChange={(event) => setForm({ ...form, question: event.target.value })}
            rows={3}
            aria-label="Question"
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="type-overline text-text-secondary">Réponse</span>
          <textarea
            value={form.answerFr}
            onChange={(event) => setForm({ ...form, answerFr: event.target.value })}
            rows={6}
            aria-label="Réponse"
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="type-overline text-text-secondary">
            Réponse TikTok (optionnelle, plus courte)
          </span>
          <textarea
            value={form.answerTiktok}
            onChange={(event) =>
              setForm({ ...form, answerTiktok: event.target.value })
            }
            rows={2}
            aria-label="Réponse TikTok"
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <label className="type-label flex items-center gap-2 text-text-primary">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
            className="accent-brand size-4"
          />
          Active — proposée à la génération de brouillons
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={pending || form.title.trim() === "" || form.question.trim() === ""}
            onClick={save}
          >
            <PendingLabel pending={pending} busy="Enregistrement…">
              Enregistrer
            </PendingLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
