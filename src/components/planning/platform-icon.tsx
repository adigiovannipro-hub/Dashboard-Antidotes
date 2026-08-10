import { Share2 } from "lucide-react";

import type { PlanningPlatform } from "@/lib/planning/types";

/**
 * Le logo du réseau, à gauche du nom de son couloir.
 *
 * Tout en tracés inline : lucide ne distribue plus d'icônes de marques, et une
 * image distante ferait une requête externe pour un pictogramme de 16 px.
 */
export function PlatformIcon({ platform }: { platform: PlanningPlatform }) {
  switch (platform) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#E4405F" strokeWidth="1.8" className="size-4 shrink-0" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.2" cy="6.8" r="1.2" fill="#E4405F" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="#1877F2" className="size-4 shrink-0" aria-hidden>
          <path d="M13.5 21v-7h2.4l.4-2.9h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8v2.9h2.5v7h3Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="#0A66C2" className="size-4 shrink-0" aria-hidden>
          <path d="M6.4 8.6H3.6V20h2.8V8.6ZM5 7.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM20.4 20h-2.8v-5.6c0-1.5-.6-2.3-1.8-2.3-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9V20H11s0-9.5 0-11.4h2.8v1.6c.4-.8 1.3-1.9 3.1-1.9 2.2 0 3.5 1.5 3.5 4.6V20Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="#FF0000" className="size-4 shrink-0" aria-hidden>
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.7-1.8C18.2 5 12 5 12 5s-6.2 0-7.9.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.7 1.8c1.7.4 7.9.4 7.9.4s6.2 0 7.9-.4a2.5 2.5 0 0 0 1.7-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8l5.2 3.2L10 15.2Z" />
        </svg>
      );
    case "meta":
      return (
        <svg viewBox="0 0 24 24" fill="#0081FB" className="size-4 shrink-0" aria-hidden>
          <path d="M6.9 6.5C4 6.5 2 10 2 13.6c0 2.4 1.1 3.9 3 3.9 1.4 0 2.4-.8 4.2-3.6l1.6-2.5 1.9 3.1c1.9 3 3 3 4.3 3 1.9 0 3-1.6 3-4C20 10 18 6.5 15.1 6.5c-1.6 0-2.9 1-4.4 3.2l-.7 1-.6-1C7.9 7.4 8.5 6.5 6.9 6.5Zm-.2 2.2c.8 0 1.4.5 2.9 2.9l-1.4 2.2c-1.3 2-1.9 2.5-2.7 2.5-.9 0-1.4-.7-1.4-2 0-2.9 1.4-5.6 2.6-5.6Zm8.4 0c1.2 0 2.7 2.7 2.7 5.6 0 1.3-.5 2-1.3 2s-1.2-.5-2.6-2.7l-1.3-2c1.4-2.2 1.8-2.9 2.5-2.9Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden>
          <path d="M16.6 3c.4 2 1.7 3.3 3.9 3.5v2.6c-1.4 0-2.7-.4-3.9-1.2v5.6c0 4.4-3.2 6.5-6.2 6.5-2.9 0-5.4-2.1-5.4-5.2 0-3.2 2.8-5.3 5.8-5.1v2.7c-1.5-.3-3.1.7-3.1 2.4 0 1.6 1.2 2.6 2.7 2.6 1.6 0 3.4-1 3.4-3.9V3h2.8Z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden>
          <path d="M17.7 3H21l-7.1 8.2L22.2 21h-6.5l-5.1-6.1L4.8 21H1.5l7.6-8.7L1.8 3h6.7l4.6 5.5L17.7 3Zm-1.1 16h1.8L6.4 4.9H4.4L16.6 19Z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" fill="#E60023" className="size-4 shrink-0" aria-hidden>
          <path d="M12 2a10 10 0 0 0-3.9 19.2c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.2-1.9 3.2-4.7 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.2-4.6 4.4 0 .9.3 1.8.8 2.3l-.3 1.1c-.1.4-.3.5-.7.3-1.2-.6-2-2.4-2-3.8C5 8 7.5 5.2 12.2 5.2c3.8 0 6.7 2.7 6.7 6.3 0 3.8-2.4 6.8-5.7 6.8-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.2 1-.9 2.2-1.4 2.9A10 10 0 1 0 12 2Z" />
        </svg>
      );
    case "snapchat":
      return (
        <svg viewBox="0 0 24 24" fill="#FFC700" className="size-4 shrink-0" aria-hidden>
          <path d="M12 2.5c3 0 5.4 2.3 5.4 5.5v2c.5.2 1-.1 1.4-.1.5 0 1 .3 1 .8 0 .7-.9 1-1.6 1.3-.4.2-.8.3-.9.6-.1.2 0 .5.2.9.7 1.4 2 2.6 3.6 2.9.3.1.5.3.5.6 0 .8-1.5 1.2-2.6 1.4-.1.3-.2.9-.5.9-.6.1-1.4-.2-2.3-.1-.8.2-1.5 1.5-4.2 1.5s-3.4-1.3-4.2-1.4c-.9-.2-1.7.1-2.3 0-.3 0-.4-.6-.5-.9-1.1-.2-2.6-.6-2.6-1.4 0-.3.2-.5.5-.6 1.6-.3 2.9-1.5 3.6-2.9.2-.4.3-.7.2-.9-.1-.3-.5-.4-.9-.6-.7-.3-1.6-.6-1.6-1.3 0-.5.5-.8 1-.8.4 0 .9.3 1.4.1v-2c0-3.2 2.4-5.5 5.4-5.5Z" />
        </svg>
      );
    default:
      return (
        <Share2
          className="text-muted-foreground size-4 shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
      );
  }
}
