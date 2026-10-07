"use client";

import { ChevronDown, Send } from "lucide-react";
import { useState } from "react";

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
import { PUBLISHABLE_NOW_STATUSES } from "@/lib/publishing/readiness";
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
 *
 * Réservé à l'agence (le panneau ne le rend qu'à l'owner) et **replié** : il
 * ne sert qu'une fois par vidéo TikTok, et le compte n'est lu chez TikTok
 * qu'à l'ouverture — c'était cette lecture, à chaque panneau ouvert, qui
 * ralentissait la programmation.
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
}: {
  scope: Scope;
  subjectId: string;
  status: string;
  settings: unknown;
}) {
  const saved = parseTiktokSettings(rawSettings);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const [creator, setCreator] = useState<TiktokCreatorResult | null>(null);
  const { run, pending } = useCellAction();

  // Le compte se lit à la première ouverture, et une fois seulement.
  const toggle = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && creator === null) {
      void getTiktokCreator(scope).then(setCreator);
    }
  };

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
    <section aria-label="Publication TikTok" className="border-border border-b">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors duration-(--motion-duration) ease-standard"
      >
        <span className="text-muted-foreground text-[11px] uppercase">TikTok</span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {saved ? "Réglages enregistrés" : "Sans réglages : brouillon"}
          <ChevronDown
            className={`size-4 transition-transform duration-(--motion-duration) ease-standard ${open ? "rotate-180" : ""}`}
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="space-y-3 px-4 pb-4">
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

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending || !PUBLISHABLE_NOW_STATUSES.includes(status) || !account}
            title={
              PUBLISHABLE_NOW_STATUSES.includes(status)
                ? undefined
                : "Seule une publication « Programmé » ou « Validé » part."
            }
            onClick={() => void run(() => publishTiktokNow(scope, subjectId))}
          >
            <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
            Publier maintenant sur TikTok
          </Button>
        </div>
      ) : null}
    </section>
  );
}
