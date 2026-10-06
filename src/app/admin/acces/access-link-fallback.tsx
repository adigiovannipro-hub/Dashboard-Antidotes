"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Le lien d'accès à transmettre à la main, quand le courriel n'a pas pu
 * partir — boîte Gmail des Reçus déconnectée, refus de Google. L'accès est
 * déjà écrit : il ne manque que le facteur.
 *
 * `dialog` : depuis une ligne du tableau, où il n'y a pas la place de
 * l'afficher en ligne.
 */
export function AccessLinkFallback({ link, dialog }: { link: string; dialog?: boolean }) {
  // Fermée pour ce lien-là ; un nouveau renvoi rouvre la boîte.
  const [closedFor, setClosedFor] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie refusée par le navigateur : sélectionnez le lien.");
    }
  };

  const field = (
    <div className="flex items-center gap-2">
      <Input readOnly value={link} aria-label="Lien d'accès" onFocus={(event) => event.currentTarget.select()} />
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy className="size-4" strokeWidth={1.75} aria-hidden />
        Copier
      </Button>
    </div>
  );

  if (!dialog) {
    return (
      <div className="border-border bg-surface-sunken space-y-2 rounded-md border p-3">
        <p className="type-caption text-text-secondary">Lien d&apos;accès, valable une heure</p>
        {field}
      </div>
    );
  }

  return (
    <Dialog open={closedFor !== link} onOpenChange={(open) => !open && setClosedFor(link)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lien d&apos;accès</DialogTitle>
          <DialogDescription>Valable une heure, pour une seule connexion.</DialogDescription>
        </DialogHeader>
        {field}
      </DialogContent>
    </Dialog>
  );
}
