import type { CSSProperties } from "react";

/**
 * Le bandeau de logos clients : une rangée qui glisse lentement de droite à
 * gauche, en continu, et s'arrête sous le pointeur. Tout est CSS : la piste
 * est rendue quatre fois et translatée d'une moitié, le navigateur boucle.
 *
 * Chaque marque est son logo officiel, dans sa version horizontale. Le
 * fichier ne sert que de pochoir (`mask-image`) : c'est l'encre du thème qui
 * le remplit, la Craie sur la Profondeur. Un rond orange, un carré bleu et un
 * mot rouge pèsent ainsi le même blanc, sans filtre ni couleur en dur — et
 * un jour dans le dessin (le « +x » de Banque Populaire) reste un jour.
 *
 * `width` et `height` sont les dimensions du fichier (le rapport largeur sur
 * hauteur du logo) ; `size` est la hauteur d'affichage, réglée logo par logo
 * pour un même poids à l'œil : à hauteur égale, un mot seul très large paraît
 * bien plus gros qu'un emblème coiffant trois lignes.
 */
export type MarqueeLogo = { src: string; name: string; width: number; height: number; size: number };

export function LogoMarquee({ logos, label, className = "" }: { logos: MarqueeLogo[]; label: string; className?: string }) {
  const track = [...logos, ...logos, ...logos, ...logos];
  return (
    <div className={`marquee ${className}`} role="region" aria-label={label}>
      <ul className="marquee-track">
        {track.map((logo, index) => (
          <li key={`${logo.src}-${index}`} className="marquee-item" aria-hidden={index >= logos.length || undefined}>
            <span
              role="img"
              aria-label={logo.name}
              className="marquee-logo"
              style={
                {
                  "--logo": `url(${logo.src})`,
                  "--logo-h": `${logo.size}px`,
                  aspectRatio: `${logo.width} / ${logo.height}`,
                } as CSSProperties
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
