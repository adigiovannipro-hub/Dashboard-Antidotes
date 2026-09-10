"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  addMyPost,
  embedLibraryNow,
  importSharesCsv,
  type InboundResult,
} from "@/app/actions/antidotes-inbound";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Ce qui touche à **mes** posts : en ajouter un, importer l'export LinkedIn,
 * calculer les vecteurs.
 *
 * Trois gestes rares, qui ne méritent pas trois boutons permanents : mes
 * posts se lisent maintenant dans le tableau, avec la veille, et c'est là
 * qu'ils comptent. Aucune API ne rend les publications d'un membre LinkedIn :
 * l'export du réseau reste le seul chemin.
 */
export function InboundMineMenu({ embeddings }: { embeddings: boolean }) {
  const router = useRouter();
  const [dialogue, setDialogue] = useState<"post" | null>(null);
  const [pending, startTransition] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const [importState, importAction] = useActionState<InboundResult | null, FormData>(importSharesCsv, null);
  const lastImport = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!importState || importState === lastImport.current) return;
    lastImport.current = importState;
    if (importState.ok) {
      toast.success(importState.message ?? "Importé.");
      router.refresh();
    } else {
      toast.error(importState.error);
    }
  }, [importState, router]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Mes posts"
          className="hover:bg-muted focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border border-border text-text-secondary transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => setDialogue("post")}>Ajouter un de mes posts</DropdownMenuItem>
          <DropdownMenuItem onClick={() => file.current?.click()}>
            Importer mon export LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending || !embeddings}
            onClick={() => {
              if (!embeddings) return;
              startTransition(async () => {
                const result = await embedLibraryNow();
                if (result.ok) {
                  toast.success(result.message ?? "Fait.");
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              });
            }}
          >
            {embeddings ? "Calculer les vecteurs manquants" : "Vecteurs — OPENAI_API_KEY absente"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Le fichier voyage dans un formulaire ordinaire : quelques centaines
          de Ko, loin du plafond de corps du proxy. */}
      <form action={importAction} className="hidden">
        <input
          ref={file}
          type="file"
          name="file"
          accept=".csv,text/csv"
          aria-label="Fichier Shares.csv"
          onChange={(event) => {
            if (event.target.files?.length) event.currentTarget.form?.requestSubmit();
          }}
        />
      </form>

      <Dialog open={dialogue === "post"} onOpenChange={(open) => !open && setDialogue(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Un de mes posts</DialogTitle>
            <DialogDescription>Il rejoint le tableau, et sert d&apos;exemple de ton.</DialogDescription>
          </DialogHeader>
          <AddMineForm onDone={() => setDialogue(null)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMineForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(addMyPost, null);
  const last = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Ajouté.");
      router.refresh();
      onDone();
    } else {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="mine-content">Le texte</Label>
        <TextArea id="mine-content" name="content" required maxLength={6000} className="min-h-40" autoFocus />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="mine-url">Lien</Label>
          <Input id="mine-url" name="url" inputMode="url" placeholder="https://…" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="mine-date">Publié le</Label>
          <Input id="mine-date" name="publishedAt" type="date" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="mine-likes">Réactions</Label>
          <Input id="mine-likes" name="likes" inputMode="numeric" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="mine-comments">Commentaires</Label>
          <Input id="mine-comments" name="comments" inputMode="numeric" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="mine-tags">Étiquettes</Label>
          <Input id="mine-tags" name="tags" maxLength={300} placeholder="acquisition, retour d'expérience" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Ajouter
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
