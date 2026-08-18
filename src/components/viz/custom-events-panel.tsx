"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { toast } from "sonner";

import { setConversionRole, type ConversionRole } from "@/app/actions/social";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { safeAction } from "@/lib/context/safe-action";
import { formatValue } from "@/lib/format";
import type { ConversionRoles, CustomEventTotal } from "@/lib/reporting/real-data";
import { cn } from "@/lib/utils";

/**
 * Les conversions que le pixel du client émet sous ses propres noms.
 *
 * Un tel événement n'a pas de sens universel : « Validation Shop Lyon » est
 * une vente chez I-WAY et ne l'est nulle part ailleurs. Le produit ne tranche
 * donc pas — il demande. Chaque événement reçoit un rôle : **achat**,
 * **panier**, ou aucun. Le rôle se pose sur le compte publicitaire et
 * s'applique **à la lecture**, si bien qu'en changer prend effet tout de
 * suite, sans resynchroniser un an d'historique.
 *
 * Réservé au propriétaire : un client lit ses chiffres, il ne décide pas de
 * ce qui compte comme une vente.
 *
 * Le panneau reste **visible et vide pour l'owner** quand aucun événement n'a
 * encore été relevé, et disparaît pour le client. Sans ça, le réglage n'existe
 * qu'une fois la collecte passée : il n'y avait rien à cocher, rien à lire, et
 * rien qui dise pourquoi — une fonctionnalité invisible qu'on prend pour une
 * panne.
 */
export function CustomEventsPanel({
  workspaceSlug,
  events,
  roles,
  isOwner,
}: {
  workspaceSlug: string;
  events: readonly CustomEventTotal[];
  roles: ConversionRoles;
  isOwner: boolean;
}) {
  if (events.length === 0 && !isOwner) return null;

  const roleDe = (name: string): ConversionRole =>
    roles.purchase.includes(name)
      ? "achat"
      : roles.addToCart.includes(name)
        ? "panier"
        : "aucun";

  return (
    <Panel>
      <PanelHeader
        title="Conversions du client"
        // Pas de « 0 » à côté du titre : le compteur redirait ce que l'état
        // vide explique déjà, en plus sec.
        count={events.length > 0 ? events.length : undefined}
        description="Les événements que le pixel du client émet sous ses propres noms. Leur donner un rôle les verse dans les achats ou les mises au panier — et donc dans le CPA. Le chiffre d'affaires, lui, ne suit que si l'événement porte un montant."
      />
      <PanelBody>
        {events.length === 0 ? (
          <EmptyState
            icon={Tag}
            message="Aucun événement personnalisé relevé sur cette période. S'il en existe côté Meta — un nom que le pixel du client a choisi lui-même — le bouton Synchroniser, en haut, les remontera : ils apparaîtront ici, avec leur réglage."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.name}
                workspaceSlug={workspaceSlug}
                event={event}
                role={roleDe(event.name)}
                isOwner={isOwner}
              />
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

const ROLE_LABELS: Record<ConversionRole, string> = {
  achat: "Achat",
  panier: "Panier",
  aucun: "Ni l'un ni l'autre",
};

const ROLES: ConversionRole[] = ["achat", "panier", "aucun"];

function EventCard({
  workspaceSlug,
  event,
  role,
  isOwner,
}: {
  workspaceSlug: string;
  event: CustomEventTotal;
  role: ConversionRole;
  isOwner: boolean;
}) {
  const router = useRouter();
  // Optimiste : le réglage prend sa valeur tout de suite et revient en arrière
  // si le serveur refuse — sinon il mentirait jusqu'au rafraîchissement.
  const [choisi, setChoisi] = useState(role);
  const [pending, start] = useTransition();

  const changer = (next: ConversionRole) => {
    if (next === choisi) return;
    const avant = choisi;
    setChoisi(next);
    start(async () => {
      const result = await safeAction(() =>
        setConversionRole(workspaceSlug, { name: event.name, role: next }),
      );
      if (!result.ok) {
        setChoisi(avant);
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

      {/* Trois choix exclusifs, en gouttière creuse : la même grammaire que
          les onglets de section, parce que c'est le même geste — on choisit
          l'un des trois, jamais plusieurs. */}
      {isOwner ? (
        <div
          role="radiogroup"
          aria-label={`Rôle de ${event.name}`}
          className="bg-surface-sunken mt-3 flex gap-1 rounded-pill p-1"
        >
          {ROLES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={choisi === option}
              disabled={pending}
              onClick={() => changer(option)}
              className={cn(
                "type-caption focus-visible:ring-ring flex-1 cursor-pointer rounded-pill px-2 py-1 transition-[background,color] duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default",
                /* `primary` et non `accent-ink` : en sombre l'encre d'accent
                   devient un vert clair, et du blanc posé dessus tombe à
                   1,39:1 — relevé à l'audit. La paire `primary` /
                   `primary-foreground` bascule des deux côtés, comme le
                   sélecteur de période de Finance. */
                choisi === option
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {ROLE_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
