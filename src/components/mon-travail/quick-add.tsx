"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createTask, type TravailResult } from "@/app/actions/mon-travail";
import { Button } from "@/components/ui/button";
import type { TaskWorkspace } from "@/lib/mon-travail/types";

/**
 * L'ajout en deux secondes : un champ, entrée, c'est noté. Le rattachement
 * client et la date sont là mais n'exigent rien — leurs valeurs par défaut
 * (« aucun client », aujourd'hui) sont les bonnes neuf fois sur dix.
 *
 * **`@` mentionne un client sans quitter le clavier** : taper `@bon` ouvre la
 * liste filtrée, Entrée ou un clic choisit, la mention disparaît du libellé et
 * le sélecteur de client se règle tout seul. C'est le geste Monday/Slack —
 * la main reste sur la phrase, jamais sur le formulaire.
 *
 * Le formulaire est fait pour **enchaîner** : `Entrée` comme `⌘/Ctrl+Entrée`
 * valident et rendent la main au champ, vidé du seul libellé. Le client et
 * l'échéance, eux, restent — on ajoute rarement une tâche isolée, et
 * resélectionner le même client trois fois de suite est exactement ce qui
 * fait renoncer à noter la troisième.
 *
 * Il vit au pied de la liste, en permanence. Pas d'`autoFocus` donc : la page
 * s'ouvre sur ce qu'il y a à faire, pas sur un curseur qui clignote en bas.
 */
export function QuickAdd({
  clientWorkspaces,
  today,
  defaultWorkspaceId,
}: {
  clientWorkspaces: TaskWorkspace[];
  today: string;
  /** Client préchoisi quand la page est filtrée sur l'un d'eux. */
  defaultWorkspaceId?: string | null;
}) {
  const [result, action, pending] = useActionState<TravailResult | null, FormData>(
    createTask,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const lastResult = useRef<TravailResult | null>(null);

  const [workspaceChoice, setWorkspaceChoice] = useState(defaultWorkspaceId ?? "");
  /** La mention en cours de frappe : position du `@` et texte tapé après. */
  const [mention, setMention] = useState<{ start: number; query: string } | null>(
    null,
  );
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    if (!result || result === lastResult.current) return;
    lastResult.current = result;
    if (result.ok) {
      // Vider le libellé seul, et non `form.reset()` : le client et la date
      // choisis valent pour la tâche suivante.
      if (titleRef.current) titleRef.current.value = "";
      titleRef.current?.focus();
      toast.success(result.message ?? "Tâche ajoutée.");
    } else {
      toast.error(result.error);
    }
  }, [result]);

  const matches = mention
    ? clientWorkspaces.filter((workspace) =>
        workspace.name.toLowerCase().includes(mention.query.toLowerCase()),
      )
    : [];

  /** Relit le champ après chaque frappe : y a-t-il un `@…` sous le curseur ? */
  const trackMention = () => {
    const input = titleRef.current;
    if (!input) return;
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const match = /@([\p{L}\d' -]*)$/u.exec(before);
    setMention(match ? { start: caret - match[0].length, query: match[1] ?? "" } : null);
    setHighlighted(0);
  };

  const pick = (workspace: TaskWorkspace) => {
    const input = titleRef.current;
    if (!input || !mention) return;
    const caret = input.selectionStart ?? input.value.length;
    // La mention s'efface du libellé : elle a fait son travail dans le
    // sélecteur, la garder écrirait « @Bondet » dans le titre de la tâche.
    input.value = `${input.value.slice(0, mention.start)}${input.value.slice(caret)}`;
    setWorkspaceChoice(workspace.id);
    setMention(null);
    input.focus();
    input.setSelectionRange(mention.start, mention.start);
  };

  // Le vert n'apparaît qu'au survol et au focus. Posé en permanence, un anneau
  // d'accent au repos crie « remplis-moi » à chaque ouverture de la page — et
  // l'écran ne porte qu'un seul aplat d'accent.
  const field =
    "type-body h-10 rounded-md border border-input bg-surface px-3 outline-none transition-colors duration-(--motion-duration) ease-standard hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <input
          ref={titleRef}
          name="title"
          required
          maxLength={300}
          placeholder="Ajouter une tâche…   @ pour le client, ⌘↵ pour enchaîner"
          aria-label="Nouvelle tâche"
          autoComplete="off"
          onInput={trackMention}
          onClick={trackMention}
          onBlur={() => {
            // Laisser le clic sur la liste aboutir avant de la fermer.
            setTimeout(() => setMention(null), 150);
          }}
          onKeyDown={(event) => {
            if (mention && matches.length > 0) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setHighlighted((current) => {
                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  return (current + delta + matches.length) % matches.length;
                });
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                // Entrée choisit le client, elle n'envoie pas la tâche : la
                // phrase n'est probablement pas finie.
                event.preventDefault();
                pick(matches[highlighted] ?? matches[0]!);
                return;
              }
              if (event.key === "Escape") {
                setMention(null);
                return;
              }
            }
            // `Entrée` seul soumet déjà, nativement. `⌘↵` ne le fait pas — et
            // c'est pourtant le geste qu'on a dans les doigts pour « valider
            // et continuer ».
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className={`${field} w-full`}
        />

        {mention ? (
          <ul
            role="listbox"
            aria-label="Choisir un client"
            className="border-border bg-surface shadow-card absolute bottom-full left-0 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-md border py-1"
          >
            {matches.length === 0 ? (
              <li className="text-text-secondary px-3 py-2 text-sm">
                Aucun client ne correspond.
              </li>
            ) : (
              matches.map((workspace, index) => (
                <li key={workspace.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    // `onMouseDown` et non `onClick` : le blur du champ part
                    // avant le clic et fermerait la liste sous la souris.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(workspace);
                    }}
                    onMouseEnter={() => setHighlighted(index)}
                    className={`flex w-full items-center px-3 py-1.5 text-left text-sm ${
                      index === highlighted
                        ? "bg-muted text-text-primary"
                        : "text-text-secondary"
                    }`}
                  >
                    {workspace.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <div className="flex gap-2">
        <select
          name="workspaceId"
          aria-label="Client rattaché"
          value={workspaceChoice}
          onChange={(event) => setWorkspaceChoice(event.target.value)}
          className={`${field} min-w-0 flex-1 text-text-secondary sm:w-40 sm:flex-none`}
        >
          <option value="">Aucun client</option>
          {clientWorkspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="dueDate"
          defaultValue={today}
          aria-label="Échéance"
          className={`${field} tabular-nums`}
        />

        <Button type="submit" disabled={pending} aria-label="Ajouter la tâche">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>
    </form>
  );
}
