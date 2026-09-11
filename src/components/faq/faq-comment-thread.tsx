"use client";

import { useRef, useState } from "react";
import { AtSign, Check, X } from "lucide-react";

import { addFaqComment } from "@/app/actions/moderation";
import { OwnerAvatar, useCellAction } from "@/components/planning/cells";
import { Button } from "@/components/ui/button";
import type { FaqComment } from "@/lib/moderation/types";
import type { PlanningOwner } from "@/lib/planning/types";

/**
 * Le fil d'un élément de langage.
 *
 * C'est par là que l'agence informe le client d'une formule et lui en demande
 * l'autorisation ; le client répond au même endroit. Taper `@` ouvre une
 * petite fenêtre à côté du champ : l'adresse choisie se tague dans le texte et
 * reçoit le message par e-mail — la boîte Gmail des Reçus, la seule du
 * produit. Le modèle est le fil de retours du planning, à l'identique.
 *
 * Rien ne se réécrit ni ne se supprime : ce qui a été demandé et autorisé doit
 * rester lisible tel quel, et la RLS n'accorde que `select` et `insert`.
 */
export function FaqCommentThread({
  entryId,
  comments,
  members,
}: {
  entryId: string;
  comments: FaqComment[];
  members: PlanningOwner[];
}) {
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  // Position du `@` tapé, pour y écrire l'adresse validée.
  const mentionAt = useRef(0);
  const { run, pending } = useCellAction();

  const validateMention = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    const at = mentionAt.current;
    setBody((current) => current.slice(0, at) + `@${email} ` + current.slice(at + 1));
    if (!recipients.includes(email)) {
      setRecipients((current) => [...current, email]);
    }
    setEmailDraft("");
    setMentionOpen(false);
  };

  const suggestions = members.filter((member) => {
    const needle = emailDraft.trim().toLowerCase();
    if (!needle) return true;
    return (
      member.email.toLowerCase().includes(needle) ||
      (member.full_name ?? "").toLowerCase().includes(needle)
    );
  });

  const submit = () => {
    if (!body.trim()) return;
    run(async () => {
      const result = await addFaqComment({
        entryId,
        body,
        mentions: recipients,
      });
      if (result.ok) {
        setBody("");
        setRecipients([]);
      }
      return result;
    });
  };

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun retour pour l&apos;instant.</p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2">
              <OwnerAvatar owner={null} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium">
                    {comment.author_name ?? "Auteur inconnu"}
                  </span>
                  <time
                    dateTime={comment.created_at}
                    className="text-muted-foreground ml-auto text-[10px]"
                  >
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Paris",
                    }).format(new Date(comment.created_at))}
                  </time>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.body}</p>
                {comment.mentions.length > 0 ? (
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Envoyé par e-mail à {comment.mentions.join(", ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="relative">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "@") {
                mentionAt.current = event.currentTarget.selectionStart;
                setMentionOpen(true);
              }
            }}
            onFocus={() => setMentionOpen(false)}
            rows={3}
            aria-label="Votre retour"
            placeholder="Votre retour. @ pour taguer une adresse."
            className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />

          {mentionOpen ? (
            <div className="border-border bg-background absolute top-2 left-3 z-20 w-64 rounded-md border p-2 shadow-lg">
              <p className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[11px]">
                <AtSign className="size-3" aria-hidden />
                Envoyer ce message par e-mail à
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="email"
                  autoFocus
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      validateMention(emailDraft);
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setMentionOpen(false);
                    }
                  }}
                  aria-label="Adresse e-mail à taguer"
                  placeholder="email@client.fr"
                  className="border-input bg-background focus-visible:ring-brand h-7 w-full rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => validateMention(emailDraft)}
                  aria-label="Valider cette adresse"
                  className="bg-foreground text-background hover:bg-foreground/85 rounded-md p-1.5"
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
              </div>
              {suggestions.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {suggestions.slice(0, 4).map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => validateMention(member.email)}
                        className="hover:bg-muted flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs"
                      >
                        <OwnerAvatar owner={member} />
                        <span className="min-w-0 flex-1 truncate">
                          {member.full_name ?? member.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {recipients.length > 0 ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            Partira par e-mail à
            {recipients.map((email) => (
              <span
                key={email}
                className="border-border rounded-pill flex items-center gap-1 border px-2 py-0.5"
              >
                {email}
                <button
                  type="button"
                  onClick={() =>
                    setRecipients((current) =>
                      current.filter((candidate) => candidate !== email),
                    )
                  }
                  aria-label={`Ne pas envoyer à ${email}`}
                  className="hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </p>
        ) : null}

        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending
            ? "Envoi…"
            : recipients.length > 0
              ? `Envoyer (${recipients.length})`
              : "Ajouter le retour"}
        </Button>
      </div>
    </div>
  );
}
