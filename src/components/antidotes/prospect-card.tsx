"use client";

import { MessageCircle, Users } from "lucide-react";

import {
  CampaignChip,
  ContactAvatar,
  CountChip,
  DateChip,
  ScoreFlag,
} from "@/components/antidotes/pipeline-chips";
import { StatusPill } from "@/components/ds/status-pill";
import { formatShortDay, isDue, relativeDays } from "@/lib/antidotes/dates";
import type { PipelineProspect } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * La carte d'un prospect dans le kanban : quatre lignes, pas une de plus.
 * Au-delà, quarante cartes deviennent illisibles.
 *
 *   1. la société, et un badge vert si elle diffuse des publicités ;
 *   2. la campagne (point de sa couleur) ou le client miroir, puis
 *      ville · secteur ;
 *   3. les pastilles : drapeau du score, prochain geste — l'envoi planifié
 *      s'il y en a un, en rouge quand il est dû, sinon le dernier contact —,
 *      contacts, entrées de journal ;
 *   4. à droite, l'avatar du contact principal.
 *
 * Le composant ne sait rien du glisser-déposer : `PipelineBoard` l'enveloppe
 * dans le nœud draggable, et la même carte sert de fantôme pendant le
 * déplacement.
 */
export function ProspectCard({
  prospect,
  className,
  overlay,
}: {
  prospect: PipelineProspect;
  className?: string;
  /** Le fantôme qui suit le pointeur : une ombre plus haute, rien d'autre. */
  overlay?: boolean;
}) {
  const place = [prospect.city, prospect.sector].filter(Boolean).join(" · ");
  const origin = prospect.campaign_name ?? prospect.reference_client;
  const primary = prospect.contacts.find((contact) => contact.is_primary) ?? prospect.contacts[0];
  const due = isDue(prospect.next_send_at);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface p-3 text-left shadow-card transition-[border-color,box-shadow] duration-(--motion-duration) ease-standard",
        overlay && "border-border-strong shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="type-label min-w-0 truncate text-text-primary">
          {prospect.company_name}
        </p>
        {prospect.ads_active ? <StatusPill tone="positive">Pubs</StatusPill> : null}
      </div>

      <div className="type-caption mt-1 flex min-w-0 items-center gap-1.5 text-text-secondary">
        <CampaignChip
          campaignId={prospect.campaign_id}
          campaignName={prospect.campaign_name}
          referenceClient={prospect.reference_client}
          className="max-w-3/5"
        />
        {place ? <span className="min-w-0 truncate">{place}</span> : null}
        {!place && !origin ? <span>—</span> : null}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <ScoreFlag score={prospect.score} />
          {prospect.next_send_at ? (
            <DateChip
              due={due}
              label={`Prochain envoi ${formatShortDay(prospect.next_send_at)}`}
            >
              {due ? "Envoi dû" : formatShortDay(prospect.next_send_at)}
            </DateChip>
          ) : prospect.last_contact_at ? (
            <DateChip label={`Dernier contact ${relativeDays(prospect.last_contact_at)}`}>
              {relativeDays(prospect.last_contact_at)}
            </DateChip>
          ) : null}
          <CountChip icon={Users} value={prospect.contacts.length} label="contacts" />
          <CountChip icon={MessageCircle} value={prospect.journal_count} label="entrées au journal" />
        </div>
        <ContactAvatar contact={primary} />
      </div>
    </div>
  );
}
