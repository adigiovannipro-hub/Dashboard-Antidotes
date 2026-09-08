"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addMyPost, type InboundResult } from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Un de mes posts, collé tel quel — le corpus se construit un post à la fois, ou par l'export. */
export function LibraryAddDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter un post
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Un de mes posts</DialogTitle>
          </DialogHeader>
          <AddForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(addMyPost, null);
  const lastState = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Ajouté.");
      onDone();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="lib-content">Texte du post</Label>
        <TextArea id="lib-content" name="content" required minLength={40} maxLength={6000} className="min-h-40" autoFocus />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="lib-url">Lien</Label>
          <Input id="lib-url" name="url" type="url" placeholder="https://www.linkedin.com/posts/…" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lib-date">Publié le</Label>
          <Input id="lib-date" name="publishedAt" type="date" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lib-likes">Réactions</Label>
          <Input id="lib-likes" name="likes" type="number" min={0} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lib-comments">Commentaires</Label>
          <Input id="lib-comments" name="comments" type="number" min={0} />
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="lib-tags">
            Étiquettes <span className="type-caption font-normal text-text-secondary">séparées par des virgules</span>
          </Label>
          <Input id="lib-tags" name="tags" maxLength={300} placeholder="acquisition, coulisses" />
        </div>
      </div>
      <div>
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Ajouter
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
