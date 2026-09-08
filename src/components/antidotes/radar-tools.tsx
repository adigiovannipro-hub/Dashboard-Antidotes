"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { addRadarAccount, collectRadarNow, proposeTopicsNow, type InboundResult } from "@/app/actions/antidotes-inbound";
import { NativeSelect } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/antidotes/types";

const PLATFORMS: PostPlatform[] = ["linkedin", "instagram", "youtube", "tiktok", "x"];

/** Un compte à veiller : le réseau, l'identifiant ou l'URL, les abonnés si on les connaît. */
export function AddAccountDialog({ availability }: { availability: Record<PostPlatform, string | null> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter un compte
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Un compte à veiller</DialogTitle>
          </DialogHeader>
          <AddAccountForm availability={availability} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddAccountForm({ availability, onDone }: { availability: Record<PostPlatform, string | null>; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(addRadarAccount, null);
  const [platform, setPlatform] = useState<PostPlatform>("linkedin");
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
        <Label htmlFor="acc-platform">Réseau</Label>
        <NativeSelect id="acc-platform" name="platform" value={platform} onChange={(event) => setPlatform(event.target.value as PostPlatform)}>
          {PLATFORMS.map((entry) => (
            <option key={entry} value={entry}>
              {POST_PLATFORM_LABELS[entry]}
            </option>
          ))}
        </NativeSelect>
        {availability[platform] ? <p className="type-caption text-warning-ink">{availability[platform]} — le compte sera enregistré, pas relevé.</p> : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="acc-handle">Identifiant ou URL du profil</Label>
        <Input id="acc-handle" name="handle" required maxLength={200} autoFocus placeholder={platform === "youtube" ? "@chaine" : "https://…/in/prenom-nom"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="acc-label">Nom affiché</Label>
          <Input id="acc-label" name="label" maxLength={120} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="acc-followers">Abonnés</Label>
          <Input id="acc-followers" name="followers" type="number" min={0} placeholder="si connu" />
        </div>
      </div>
      <div>
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Veiller ce compte
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}

export function RadarActions({ hasAccounts, hasPosts, anthropic }: { hasAccounts: boolean; hasPosts: boolean; anthropic: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"collect" | "topics" | null>(null);

  function run(kind: "collect" | "topics") {
    setBusy(kind);
    startTransition(async () => {
      const result = kind === "collect" ? await collectRadarNow() : await proposeTopicsNow();
      if (result.ok) {
        toast.success(result.message ?? "Fait.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setBusy(null);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending || !hasAccounts} onClick={() => run("collect")}>
        <RefreshCw aria-hidden />
        <PendingLabel pending={pending && busy === "collect"} busy="Lancement…">
          Relever maintenant
        </PendingLabel>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !hasPosts || !anthropic}
        title={!anthropic ? "ANTHROPIC_API_KEY absente" : undefined}
        onClick={() => run("topics")}
      >
        <Lightbulb aria-hidden />
        <PendingLabel pending={pending && busy === "topics"} busy="Réflexion…">
          Proposer des sujets
        </PendingLabel>
      </Button>
    </>
  );
}
