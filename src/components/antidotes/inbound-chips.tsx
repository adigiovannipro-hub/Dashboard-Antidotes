"use client";

import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Les marques de l'inbound : le réseau, et ce qui est de moi.
 *
 * Pas de logo de plateforme : aucun n'est distribué avec le projet, et un
 * glyphe redessiné à quatorze pixels se lit de travers — le huit couché de
 * Meta, tracé à cette taille, se lisait « co » ailleurs dans l'application.
 * Une abréviation stable fait le même travail sans mentir.
 */

const SHORT: Record<PostPlatform, string> = {
  linkedin: "In",
  instagram: "Ig",
  youtube: "Yt",
  tiktok: "Tk",
  x: "X",
};

export function PlatformChip({
  platform,
  mine = false,
  className,
}: {
  platform: PostPlatform;
  /** Un de mes posts : le vert de la rampe ordinale, celui du calendrier. */
  mine?: boolean;
  className?: string;
}) {
  return (
    <span
      title={POST_PLATFORM_LABELS[platform]}
      className={cn(
        "type-micro inline-flex size-5 shrink-0 items-center justify-center rounded-sm font-medium",
        mine
          ? "bg-accent-subtle text-accent-ink"
          : "bg-surface-sunken text-text-secondary",
        className,
      )}
    >
      {SHORT[platform]}
      <span className="sr-only"> {POST_PLATFORM_LABELS[platform]}</span>
    </span>
  );
}
