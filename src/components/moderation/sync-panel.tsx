"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import {
  ModerationSyncButton,
  useModerationSync,
} from "@/components/moderation/sync-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChannelConnectionSummary } from "@/lib/moderation/queries";
import { CHANNEL_LABELS } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * L'état du relevé, en **un seul endroit**.
 *
 * Il était éparpillé en trois repères dans la barre de filtres — l'âge du
 * dernier passage, une pastille rouge « canaux en erreur », une pastille ambre
 * « avertissements » — dont deux ne disaient rien de ce qui clochait et dont
 * le détail vivait dans une infobulle, invisible au clic. Tout tient
 * maintenant derrière un bouton qui résume, et un panneau qui détaille :
 * chaque client, chaque réseau, la date du dernier passage, l'erreur en
 * toutes lettres, l'échéance du jeton quand on a le droit de la lire, et le
 * bouton pour relever tout de suite.
 *
 * Un **avertissement n'est pas une erreur** : un passage qui aboutit écrit
 * quand même dans `last_error` ce qui lui a manqué — un refus sur la
 * messagerie, par exemple — alors que les commentaires sont bien remontés. Le
 * juge est donc `status`, et l'âge du relevé s'affiche toujours.
 *
 * C'est aussi **ici que l'ouverture de l'écran relève** : la pastille est le
 * seul composant du relevé monté sur l'Inbox normale, le bouton vivant dans le
 * dialogue fermé. `useModerationSync` demande le relevé du jour au serveur,
 * qui juge la fraîcheur, et la pastille dit « en cours » pendant qu'il tourne.
 */
export function SyncPanel({
  connections,
  clientNames,
  isOwner,
}: {
  connections: ChannelConnectionSummary[];
  clientNames: Map<string, string>;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { snapshot, running } = useModerationSync({ canTrigger: isOwner });

  /* Le plus récent des deux : les lignes rendues par le serveur, ou ce que le
     relevé vient de répondre — la page se relit juste après, mais la pastille
     n'a pas à mentir d'ici là. */
  const lastPolledAt = connections.reduce<string | null>(
    (latest, connection) =>
      connection.last_polled_at && (!latest || connection.last_polled_at > latest)
        ? connection.last_polled_at
        : latest,
    snapshot?.lastRunAt ?? null,
  );
  const failing = connections.filter((connection) => connection.status !== "connected");
  const warned = connections.filter(
    (connection) => connection.status === "connected" && connection.last_error,
  );

  const tone: StatusTone = running
    ? "info"
    : failing.length > 0
      ? "danger"
      : warned.length > 0
        ? "warning"
        : "neutral";
  const summary = running
    ? "Relevé en cours…"
    : failing.length > 0
      ? failing.length > 1
        ? `${failing.length} canaux en erreur`
        : "1 canal en erreur"
      : lastPolledAt
        ? `Relevé ${relativeTime(lastPolledAt)}`
        : "Jamais relevé";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="État du relevé"
        className="focus-visible:ring-ring rounded-pill transition-opacity duration-(--motion-duration) ease-standard hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
      >
        <StatusPill tone={tone}>{summary}</StatusPill>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>État du relevé</DialogTitle>
          </DialogHeader>

          {connections.length === 0 ? (
            <p className="type-body text-text-secondary">
              Aucun canal branché. Les comptes se rattachent depuis Connexions,
              dans le Reporting du client.
            </p>
          ) : (
            <ul className="divide-border max-h-96 divide-y overflow-y-auto">
              {connections.map((connection) => {
                const broken = connection.status !== "connected";
                const warning = !broken && connection.last_error;
                return (
                  <li key={connection.id} className="py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="type-label min-w-0 flex-1 truncate">
                        {clientNames.get(connection.client_id) ?? "Client"} ·{" "}
                        {CHANNEL_LABELS[connection.channel]}
                        {connection.display_name ? (
                          <span className="text-text-secondary">
                            {" "}
                            — {connection.display_name}
                          </span>
                        ) : null}
                      </span>
                      <span className="type-caption text-text-secondary tabular-nums">
                        {connection.last_polled_at
                          ? relativeTime(connection.last_polled_at)
                          : "jamais relevé"}
                      </span>
                      {broken ? (
                        <AlertTriangle
                          className="size-3.5 shrink-0 text-danger-ink"
                          strokeWidth={1.75}
                          aria-label="En erreur"
                        />
                      ) : warning ? (
                        <AlertTriangle
                          className="size-3.5 shrink-0 text-warning-ink"
                          strokeWidth={1.75}
                          aria-label="Avertissement"
                        />
                      ) : (
                        <Check
                          className="size-3.5 shrink-0 text-accent-ink"
                          strokeWidth={1.75}
                          aria-label="À jour"
                        />
                      )}
                    </div>

                    {connection.last_error ? (
                      <p
                        className={cn(
                          "type-caption mt-1",
                          broken ? "text-danger-ink" : "text-warning-ink",
                        )}
                      >
                        {lisible(connection.last_error)}
                      </p>
                    ) : null}

                    {connection.token_expires_at ? (
                      <p className="type-caption text-text-secondary mt-0.5">
                        Jeton {tokenLabel(connection.token_expires_at)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {isOwner ? <ModerationSyncButton /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Le refus générique de Meta, traduit en ce qu'il signifie en pratique.
 *
 * « An unknown error occurred » n'apprend rien et ne dit même pas quoi faire.
 */
function lisible(message: string): string {
  return /unknown error/i.test(message.trim()) || message.trim() === ""
    ? "Meta n'a pas dit pourquoi. Le passage suivant réessaiera ; si l'avertissement revient, c'est une portée à rebrancher."
    : message;
}

/** L'échéance d'un jeton, en clair — et l'urgence avec. */
function tokenLabel(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `expiré depuis ${Math.abs(days)} j — à rebrancher`;
  if (days === 0) return "expire aujourd'hui — à rebrancher";
  if (days <= 7) return `expire dans ${days} j — à rebrancher`;
  return `valable ${days} j`;
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}
