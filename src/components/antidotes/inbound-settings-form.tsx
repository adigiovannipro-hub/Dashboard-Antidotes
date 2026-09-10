"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TextArea } from "@/components/antidotes/controls";
import { saveInboundSettings, type InboundResult } from "@/app/actions/antidotes-inbound";
import { PendingLabel } from "@/components/ds/pending-label";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POST_PLATFORM_LABELS, type InboundSettings, type PostPlatform, type RadarAccount } from "@/lib/antidotes/types";

/**
 * Mes consignes de voix — ce que chaque génération reçoit avant mes exemples.
 *
 * C'est le seul endroit de l'inbound où une explication a sa place : sans
 * elle, on ne sait pas que ce qui est écrit ici change ce que le modèle rend.
 *
 * Les seuils disent ce qu'une vague garde : en dessous, un contenu n'entre
 * pas dans le tableau. Un champ vide n'est pas zéro — c'est l'absence de
 * seuil, et zéro en serait un.
 */
export function InboundSettingsForm({
  settings,
  accounts,
}: {
  settings: InboundSettings | null;
  accounts: RadarAccount[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(saveInboundSettings, null);
  const last = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Enregistré.");
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  const platforms = [...new Set(accounts.map((account) => account.platform))];
  const threshold = (platform: PostPlatform, key: "min_views" | "min_likes" | "min_comments") =>
    settings?.thresholds?.[platform]?.[key]?.toString() ?? "";

  return (
    <form action={formAction} className="space-y-5">
      <Panel>
        <PanelHeader
          title="Ma voix"
          description="Lu par le studio avant mes exemples, à chaque écriture."
          action={
            <Button type="submit" variant="accent" size="sm" disabled={pending}>
              <PendingLabel pending={pending} busy="Enregistrement…">
                Enregistrer
              </PendingLabel>
            </Button>
          }
        />
        <PanelBody className="grid gap-5">
          <div className="grid gap-1">
            <Label htmlFor="cons-guidelines">Comment j&apos;écris</Label>
            <TextArea
              id="cons-guidelines"
              name="guidelines"
              maxLength={4000}
              defaultValue={settings?.guidelines ?? ""}
              className="min-h-32"
              placeholder="Phrases courtes. Une idée par post. Jamais de « Voici ». Toujours un chiffre ou une situation vécue."
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="cons-linkedin">Un post LinkedIn à moi</Label>
              <TextArea
                id="cons-linkedin"
                name="linkedinExample"
                maxLength={4000}
                defaultValue={settings?.linkedin_example ?? ""}
                className="min-h-40"
                placeholder="Collez un post dont la forme vous ressemble."
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cons-reel">Un script de reel à moi</Label>
              <TextArea
                id="cons-reel"
                name="reelExample"
                maxLength={4000}
                defaultValue={settings?.reel_example ?? ""}
                className="min-h-40"
                placeholder="ACCROCHE (3 s) : …"
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cons-email">Un email à moi</Label>
            <TextArea
              id="cons-email"
              name="emailExample"
              maxLength={4000}
              defaultValue={settings?.email_example ?? ""}
              className="min-h-32"
              placeholder="Un message de prospection écrit de votre main."
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Ce qu'une vague garde"
          description="En dessous du seuil, un contenu n'entre pas dans le tableau. Vide : pas de seuil."
        />
        <PanelBody>
          {platforms.length === 0 ? (
            <p className="type-body text-text-secondary">Aucun compte veillé : rien à seuiller pour l&apos;instant.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {platforms.map((platform) => (
                <div key={platform} className="rounded-md border border-border p-4">
                  <p className="type-label text-text-primary">{POST_PLATFORM_LABELS[platform]}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Seuil platform={platform} field="views" label="Vues" value={threshold(platform, "min_views")} />
                    <Seuil platform={platform} field="likes" label="Likes" value={threshold(platform, "min_likes")} />
                    <Seuil
                      platform={platform}
                      field="comments"
                      label="Comm."
                      value={threshold(platform, "min_comments")}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </form>
  );
}

function Seuil({
  platform,
  field,
  label,
  value,
}: {
  platform: PostPlatform;
  field: "views" | "likes" | "comments";
  label: string;
  value: string;
}) {
  const id = `seuil-${platform}-${field}`;
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={id} className="type-caption text-text-secondary">
        {label}
      </Label>
      <Input
        id={id}
        name={`seuil_${platform}_${field}`}
        inputMode="numeric"
        defaultValue={value}
        placeholder="—"
        className="min-w-0 tabular-nums"
      />
    </div>
  );
}
