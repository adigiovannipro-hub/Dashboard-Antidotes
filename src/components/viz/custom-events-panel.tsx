"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { toast } from "sonner";

import { togglePurchaseEvent } from "@/app/actions/social";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { safeAction } from "@/lib/context/safe-action";
import { formatValue } from "@/lib/format";
import type { CustomEventTotal } from "@/lib/reporting/real-data";

/**
 * Les conversions que le pixel du client émet sous ses propres noms.
 *
 * Elles sont tenues hors des achats **par défaut** : « Validation Shop Lyon »
 * n'est pas une vente dans le cas général, et l'y verser fabriquerait un ROAS
 * à partir d'un événement sans montant. Mais la règle ne vaut pas partout —
 * chez I-WAY c'est bien l'achat — d'où l'interrupteur : le client tranche,
 * compte par compte, et le réglage s'applique à la lecture.
 *
 * Réservé au propriétaire : un client lit ses chiffres, il ne décide pas de
 * ce qui compte comme une vente.
 *
 * Le panneau reste **visible et vide pour l'owner** quand aucun événement n'a
 * encore été relevé, et disparaît pour le client. Sans ça, le réglage n'existe
 * qu'une fois la collecte passée : il n'y avait rien à cocher, rien à lire, et
 * rien qui dise pourquoi — une fonctionnalité invisible qu'on prend pour une
 * panne. Le client, lui, n'a rien à faire de cette explication.
 */
export function CustomEventsPanel({
  workspaceSlug,
  events,
  purchaseEventNames,
  isOwner,
}: {
  workspaceSlug: string;
  events: readonly CustomEventTotal[];
  purchaseEventNames: readonly string[];
  isOwner: boolean;
}) {
  if (events.length === 0 && !isOwner) return null;

  return (
    <Panel>
      <PanelHeader
        title="Conversions du client"
        // Pas de « 0 » à côté du titre : le compteur redirait ce que l'état
        // vide explique déjà, en plus sec.
        count={events.length > 0 ? events.length : undefined}
        description="Les événements que le pixel du client émet sous ses propres noms. Cocher « compte comme achat » les verse dans les achats et le CPA — le chiffre d'affaires, lui, ne suit que si l'événement porte un montant."
      />
      <PanelBody>
        {events.length === 0 ? (
          <EmptyState
            icon={Tag}
            message="Aucun événement personnalisé relevé sur cette période. S'il en existe côté Meta — un nom que le pixel du client a choisi lui-même — le bouton Synchroniser, en haut, les remontera : ils apparaîtront ici, avec leur case à cocher."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.name}
                workspaceSlug={workspaceSlug}
                event={event}
                compte={purchaseEventNames.includes(event.name)}
                isOwner={isOwner}
              />
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function EventCard({
  workspaceSlug,
  event,
  compte,
  isOwner,
}: {
  workspaceSlug: string;
  event: CustomEventTotal;
  compte: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  // Optimiste : la case prend sa valeur tout de suite et revient en arrière si
  // le serveur refuse — sinon elle mentirait jusqu'au rafraîchissement.
  const [coche, setCoche] = useState(compte);
  const [pending, start] = useTransition();

  const basculer = (next: boolean) => {
    const avant = coche;
    setCoche(next);
    start(async () => {
      const result = await safeAction(() =>
        togglePurchaseEvent(workspaceSlug, { name: event.name, compte: next }),
      );
      if (!result.ok) {
        setCoche(avant);
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="border-border bg-surface shadow-card rounded-lg border p-5">
      <p className="type-overline text-text-secondary truncate">{event.name}</p>
      <p className="text-text-primary mt-2 text-2xl leading-none font-semibold">
        {formatValue(event.count, "integer")}
      </p>
      <p className="type-caption text-text-secondary mt-2.5">
        {event.costPer !== null
          ? `${formatValue(event.costPer, "currency")} par conversion`
          : "Aucune conversion sur la période"}
        {event.value !== null
          ? ` · ${formatValue(event.value, "currency")} de valeur`
          : ""}
      </p>

      {isOwner ? (
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={coche}
            disabled={pending}
            onChange={(e) => basculer(e.target.checked)}
            className="accent-brand focus-visible:ring-ring size-4 cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <span className="type-caption text-text-secondary">
            Compte comme achat
          </span>
        </label>
      ) : null}
    </div>
  );
}
