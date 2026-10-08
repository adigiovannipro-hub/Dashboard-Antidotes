import type { ReactNode } from "react";

import { CaseVideo } from "./case-video";

/**
 * Un téléphone avec un vrai contenu dedans : le dispositif de preuve
 * d'agenceshort, repris. Pas de photo de téléphone — un cadre dessiné en
 * CSS (coins, bord, îlot), la publication en plein écran, muette, en boucle
 * quand elle est visible. Dessous : le compte, et un chiffre sourcé.
 */
export type PhoneCaseProps = {
  poster: string;
  video?: string;
  alt: string;
  handle: string;
  /** Le chiffre et sa légende, déjà traduits. */
  stat?: { value: string; label: string };
  className?: string;
  children?: ReactNode;
};

export function PhoneCase({ poster, video, alt, handle, stat, className = "", children }: PhoneCaseProps) {
  return (
    <figure className={`phone ${className}`}>
      <div className="phone-shell">
        <div className="phone-screen">
          {video ? (
            <CaseVideo src={video} poster={poster} alt={alt} />
          ) : (
            <img src={poster} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          )}
          <span aria-hidden className="phone-island" />
        </div>
      </div>
      <figcaption className="mt-4 flex flex-col gap-1">
        <span className="type-caption text-text-3">{handle}</span>
        {stat && (
          <span className="flex items-baseline gap-2">
            <span className="type-h3 text-text tabular-nums">{stat.value}</span>
            <span className="type-caption text-text-2">{stat.label}</span>
          </span>
        )}
        {children}
      </figcaption>
    </figure>
  );
}
