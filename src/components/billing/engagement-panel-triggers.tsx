"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

import { EngagementPanel } from "@/components/billing/engagement-panel";
import { Button } from "@/components/ui/button";
import type { BillingEngagement } from "@/lib/billing/types";

/**
 * Les deux portes d'entrée de la fiche d'un devis — création et modification.
 *
 * Deux boutons, un seul panneau : c'est ce qui manquait, l'ajout ouvrant une
 * boîte de dialogue et les réglages un panneau, avec deux mises en page pour
 * les mêmes informations.
 */
export function NewEngagementTrigger({ knownClients }: { knownClients: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter un devis
      </Button>

      {open ? (
        <EngagementPanel knownClients={knownClients} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * L'ouverture de la fiche d'un devis existant.
 *
 * Le bouton dit ce qu'on y trouve — la facturation et les mails — et non
 * « envoi automatique » : ce panneau porte désormais tout ce qui concerne le
 * devis, pas seulement l'automatisme.
 */
export function EditEngagementTrigger({
  engagement,
}: {
  engagement: BillingEngagement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal aria-hidden />
        Facturation et mails
      </Button>

      {open ? (
        <EngagementPanel engagement={engagement} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
