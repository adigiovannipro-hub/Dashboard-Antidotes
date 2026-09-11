"use client";

import { useState } from "react";

import type { ModerationChannel } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * L'identité visuelle d'un fil : la personne d'abord, le contexte en bulles.
 *
 * La photo de profil porte deux pastilles, comme la Boîte de réception Meta —
 * le **réseau** en haut à droite (d'où ça vient), le **client** en bas à
 * droite (chez qui ça se passe). C'est ce qui rend la vue croisée lisible :
 * cent lignes de texte se ressemblent, cent visages avec leurs marques non.
 *
 * Sans photo — Meta ne la rend pas toujours — des initiales sur une teinte
 * stable dérivée du pseudo : la même personne garde la même couleur d'un
 * passage à l'autre, et un auteur masqué reste gris.
 */

/**
 * Les teintes d'initiales : **les encres seulement**, jamais les teintes vives.
 *
 * Les initiales sont posées en `--surface` — le couple s'inverse donc
 * ensemble : encre foncée et texte blanc en clair, encre claire et texte
 * sombre en sombre. Les trois teintes vives qui vivaient ici portaient du
 * blanc en dur : le vert de marque tombait à 2,71:1, et `--accent-ink`, qui
 * devient un vert clair en mode sombre, à 1,39:1 — mesuré au navigateur, et
 * c'est exactement le piège que la charte interdit (« jamais de blanc posé
 * sur --accent-ink »).
 *
 * Quatre teintes au lieu de six : l'identité d'un interlocuteur ne repose pas
 * sur la couleur de sa pastille, son nom est écrit juste à côté.
 */
const AVATAR_TONES = [
  "var(--accent-ink)",
  "var(--warning-ink)",
  "var(--info-ink)",
  "var(--text-primary)",
];

function toneOf(handle: string | null): string {
  // Auteur masqué : gris, mais une encre — `--border-strong` est un filet, et
  // les initiales posées dessus en `--surface` disparaissaient.
  if (!handle) return "var(--text-secondary)";
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function initialsOf(handle: string | null): string {
  if (!handle) return "?";
  const parts = handle.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "?";
  const second = parts[1]?.charAt(0) ?? "";
  return `${first}${second}`.toUpperCase();
}

/** Le glyphe d'un canal, en pastille de marque — tracés inline, comme le planning. */
const CHANNEL_BRANDS: Partial<
  Record<ModerationChannel, { background: string; path: string }>
> = {
  instagram: {
    background:
      "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.3-7.02a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0Z",
  },
  facebook: {
    background: "#1877F2",
    path: "M13.5 21.9V13.6h2.8l.5-3.3h-3.3V8.2c0-.9.3-1.6 1.6-1.6h1.8V3.7c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.2H7.1v3.3h2.8v8.3h3.6Z",
  },
  whatsapp: {
    background: "#25D366",
    path: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8.9-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5-.1-.1-.5-1.3-.8-1.8-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3Z",
  },
  youtube: {
    background: "#FF0000",
    path: "M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z",
  },
};

export function ChannelBadge({
  channel,
  className,
}: {
  channel: ModerationChannel;
  className?: string;
}) {
  const brand = CHANNEL_BRANDS[channel];
  if (!brand) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-pill ring-2 ring-surface",
        className ?? "size-4",
      )}
      style={{ background: brand.background }}
    >
      {channel === "instagram" ? (
        /* À 12 px, le glyphe officiel plein devient une tache : le tracé au
           trait — cadre arrondi, objectif, point — reste net à toute taille. */
        <svg viewBox="0 0 24 24" className="size-[68%]" fill="none">
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5.2"
            stroke="#FFFFFF"
            strokeWidth="2.2"
          />
          <circle cx="12" cy="12" r="4.4" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="17.3" cy="6.7" r="1.45" fill="#FFFFFF" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[62%]">
          <path d={brand.path} fill="#FFFFFF" />
        </svg>
      )}
    </span>
  );
}

export function ParticipantAvatar({
  handle,
  avatarUrl,
  channel,
  clientLogoUrl,
  clientName,
  size = "md",
}: {
  handle: string | null;
  avatarUrl: string | null;
  /** La pastille réseau, en haut à droite. Absente si non fournie. */
  channel?: ModerationChannel;
  /** La bulle client, en bas à droite — la vue croisée en a besoin. */
  clientLogoUrl?: string | null;
  clientName?: string | null;
  size?: "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const dimension = size === "lg" ? "size-11" : "size-9";
  const showPhoto = avatarUrl && !broken;

  return (
    <span className={cn("relative shrink-0", dimension)}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
        <img
          src={avatarUrl}
          alt=""
          aria-hidden
          onError={() => setBroken(true)}
          className={cn("rounded-pill object-cover", dimension)}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-pill font-semibold",
            size === "lg" ? "type-label" : "type-caption",
            dimension,
          )}
          style={{ backgroundColor: toneOf(handle), color: "var(--surface)" }}
        >
          {initialsOf(handle)}
        </span>
      )}

      {channel ? (
        <ChannelBadge
          channel={channel}
          className={cn(
            "absolute -top-0.5 -right-1",
            size === "lg" ? "size-[1.15rem]" : "size-4",
          )}
        />
      ) : null}

      {clientLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée
        <img
          src={clientLogoUrl}
          alt=""
          aria-hidden
          title={clientName ?? undefined}
          className={cn(
            "absolute -right-1 -bottom-0.5 rounded-pill bg-surface object-cover ring-2 ring-surface",
            size === "lg" ? "size-[1.15rem]" : "size-4",
          )}
        />
      ) : clientName ? (
        <span
          aria-hidden
          title={clientName}
          className={cn(
            "absolute -right-1 -bottom-0.5 flex items-center justify-center rounded-pill bg-surface-sunken text-[8px] font-bold uppercase ring-2 ring-surface",
            size === "lg" ? "size-[1.15rem]" : "size-4",
          )}
        >
          {clientName.charAt(0)}
        </span>
      ) : null}
    </span>
  );
}
