"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";

import { useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import { Button } from "@/components/ui/button";
import {
  clearTiktokSettings,
  getTiktokCreator,
  lastTiktokSettings,
  publishTiktokNow,
  saveTiktokSettings,
  type TiktokCreatorResult,
} from "@/app/actions/tiktok";
import {
  isTiktokPrivacy,
  parseTiktokSettings,
  TIKTOK_PRIVACY_LABELS,
  type TiktokPostSettings,
  type TiktokPrivacy,
} from "@/lib/publishing/tiktok-settings";

/**
 * Le bloc TikTok du panneau d'une publication.
 *
 * Il montre ce que TikTok exige de voir **avant** une publication directe —
 * c'est ce que l'audit de l'app vérifie à l'écran : le compte de
 * destination, la confidentialité choisie parmi les options du compte et
 * sans valeur par défaut, les interactions décochées tant qu'on ne les coche
 * pas (grisées si le compte les a coupées), la déclaration de contenu
 * commercial et l'accord avec la « Music Usage Confirmation ».
 *
 * Sans réglages enregistrés, la vidéo part en brouillon dans l'application.
 */

const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

type Draft = {
  privacy: TiktokPrivacy | "";
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  commercial: boolean;
  yourBrand: boolean;
  brandedContent: boolean;
};

function draftOf(settings: TiktokPostSettings | null): Draft {
  return {
    privacy: settings?.privacy ?? "",
    allowComment: settings?.allowComment ?? false,
    allowDuet: settings?.allowDuet ?? false,
    allowStitch: settings?.allowStitch ?? false,
    commercial: Boolean(settings && (settings.yourBrand || settings.brandedContent)),
    yourBrand: settings?.yourBrand ?? false,
    brandedContent: settings?.brandedContent ?? false,
  };
}

export function TiktokPanel({
  scope,
  subjectId,
  status,
  settings: rawSettings,
  isOwner,
}: {
  scope: Scope;
  subjectId: string;
  status: string;
  settings: unknown;
  isOwner: boolean;
}) {
  const saved = parseTiktokSettings(rawSettings);
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const [creator, setCreator] = useState<TiktokCreatorResult | null>(null);
  const { run, pending } = useCellAction();

  // Des primitives et non l'objet : un `scope` recréé à chaque rendu
  // relancerait la lecture en boucle.
  const { workspace, board } = scope;
  useEffect(() => {
    let alive = true;
    void getTiktokCreator({ workspace, board }).then((result) => {
      if (alive) setCreator(result);
    });
    return () => {
      alive = false;
    };
  }, [workspace, board]);

  const account = creator?.ok ? creator.creator : null;
  const options = account?.privacyOptions ?? [];
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const commercialIncomplete = draft.commercial && !draft.yourBrand && !draft.brandedContent;
  const canSave = Boolean(account) && draft.privacy !== "" && !commercialIncomplete && !pending;

  const save = () => {
    if (!isTiktokPrivacy(draft.privacy)) return;
    void run(() =>
      saveTiktokSettings(scope, {
        subjectId,
        privacy: draft.privacy as TiktokPrivacy,
        allowComment: draft.allowComment && !account?.commentDisabled,
        allowDuet: draft.allowDuet && !account?.duetDisabled,
        allowStitch: draft.allowStitch && !account?.stitchDisabled,
        yourBrand: draft.commercial && draft.yourBrand,
        brandedContent: draft.commercial && draft.brandedContent,
      }),
    );
  };

  const reuse = () => {
    void lastTiktokSettings(scope).then((last) => {
      if (last) setDraft(draftOf(last));
    });
  };

  const interaction = (
    key: "allowComment" | "allowDuet" | "allowStitch",
    label: string,
    disabledByAccount: boolean,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={draft[key] && !disabledByAccount}
        disabled={!account || disabledByAccount}
        onChange={(event) => set({ [key]: event.target.checked })}
      />
      <span className={disabledByAccount ? "text-muted-foreground" : undefined}>
        {label}
        {disabledByAccount ? " — coupé sur le compte" : ""}
      </span>
    </label>
  );

  return (
    <section aria-label="Publication TikTok" className="border-border space-y-3 border-b p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] uppercase">TikTok</p>
        <p className="text-muted-foreground text-xs">
          {saved ? "Réglages enregistrés" : "Sans réglages : brouillon"}
        </p>
      </div>

      {creator === null ? (
        <p className="text-muted-foreground text-sm">Lecture du compte TikTok…</p>
      ) : !creator.ok ? (
        <p className="text-sm">{creator.error}</p>
      ) : (
        <div className="flex items-center gap-2">
          {account?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN TikTok
            <img src={account.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
          ) : null}
          <p className="min-w-0 truncate text-sm">
            <span className="font-medium">{account?.nickname ?? "Compte TikTok"}</span>
            {account?.username ? (
              <span className="text-muted-foreground"> @{account.username}</span>
            ) : null}
          </p>
        </div>
      )}

      <div>
        <label htmlFor={`tiktok-privacy-${subjectId}`} className="text-muted-foreground mb-1 block text-[11px] uppercase">
          Qui peut voir cette vidéo
        </label>
        <select
          id={`tiktok-privacy-${subjectId}`}
          value={draft.privacy}
          disabled={!account}
          onChange={(event) => set({ privacy: event.target.value as TiktokPrivacy | "" })}
          className="border-input bg-background focus-visible:ring-brand h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {options.map((option) => (
            <option
              key={option}
              value={option}
              disabled={option === "SELF_ONLY" && draft.commercial && draft.brandedContent}
            >
              {TIKTOK_PRIVACY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-muted-foreground mb-1 text-[11px] uppercase">Autoriser</legend>
        {interaction("allowComment", "Les commentaires", account?.commentDisabled ?? false)}
        {interaction("allowDuet", "Les duos", account?.duetDisabled ?? false)}
        {interaction("allowStitch", "Les collages", account?.stitchDisabled ?? false)}
      </fieldset>

      <fieldset className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={draft.commercial}
            disabled={!account}
            onChange={(event) => set({ commercial: event.target.checked })}
          />
          Contenu commercial
        </label>
        {draft.commercial ? (
          <div className="space-y-1.5 pl-6">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={draft.yourBrand}
                onChange={(event) => set({ yourBrand: event.target.checked })}
              />
              <span>
                Votre marque
                <span className="text-muted-foreground block text-xs">
                  Étiquetée « Contenu promotionnel »
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                checked={draft.brandedContent}
                onChange={(event) =>
                  set({
                    brandedContent: event.target.checked,
                    // Un contenu de marque ne peut pas rester privé.
                    ...(event.target.checked && draft.privacy === "SELF_ONLY" ? { privacy: "" } : {}),
                  })
                }
              />
              <span>
                Contenu de marque
                <span className="text-muted-foreground block text-xs">
                  Étiquetée « Partenariat rémunéré »
                </span>
              </span>
            </label>
            {commercialIncomplete ? (
              <p className="text-muted-foreground text-xs">Choisir au moins une des deux.</p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <p className="text-muted-foreground text-xs">
        En enregistrant, vous acceptez la{" "}
        <a href={MUSIC_USAGE_URL} target="_blank" rel="noreferrer" className="underline">
          Music Usage Confirmation
        </a>
        {draft.commercial && draft.brandedContent ? (
          <>
            {" "}et la{" "}
            <a href={BRANDED_POLICY_URL} target="_blank" rel="noreferrer" className="underline">
              Branded Content Policy
            </a>
          </>
        ) : null}{" "}
        de TikTok.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!canSave} onClick={save}>
          Enregistrer
        </Button>
        <Button size="sm" variant="outline" disabled={!account || pending} onClick={reuse}>
          Reprendre les derniers réglages
        </Button>
        {saved ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => void run(() => clearTiktokSettings(scope, subjectId))}
          >
            Retirer
          </Button>
        ) : null}
      </div>

      {isOwner ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={pending || status !== "validated" || !account}
          title={status !== "validated" ? "Seule une publication « Validé » part." : undefined}
          onClick={() => void run(() => publishTiktokNow(scope, subjectId))}
        >
          <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
          Publier maintenant sur TikTok
        </Button>
      ) : null}
    </section>
  );
}
