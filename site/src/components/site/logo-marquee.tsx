/**
 * Le bandeau de logos clients : une rangée qui glisse lentement de droite à
 * gauche, en continu, et s'arrête sous le pointeur. Tout est CSS : la piste
 * est rendue quatre fois et translatée d'une moitié, le navigateur boucle.
 *
 * Les marques sont passées en un seul blanc par filtre, pour qu'un rond
 * orange et un losange noir pèsent le même poids — un mur de marques, pas
 * une liste de noms : le nom ne s'écrit que là où le fichier est un aplat
 * de couleur qu'aucun filtre ne rend honnêtement.
 *
 * `tone` : `mono` est un tracé sur alpha (passé en blanc), `invert` un tracé
 * sombre sur fond transparent (inversé), `lift` un aplat (nom seul, en
 * attendant un wordmark monochrome).
 */
export type MarqueeLogo = { src: string; name: string; width: number; height: number; tone: "mono" | "invert" | "lift" };

export function LogoMarquee({ logos, label, className = "" }: { logos: MarqueeLogo[]; label: string; className?: string }) {
  const track = [...logos, ...logos, ...logos, ...logos];
  return (
    <div className={`marquee ${className}`} role="region" aria-label={label}>
      <ul className="marquee-track">
        {track.map((logo, index) => (
          <li key={`${logo.src}-${index}`} className="marquee-item" aria-hidden={index >= logos.length || undefined}>
            {logo.tone === "lift" ? (
              <span className="type-body font-semibold uppercase tracking-wider whitespace-nowrap text-text-2">{logo.name}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- des marques de 40 px, SVG ou PNG déjà réduits : next/image n'y gagnerait rien
              <img src={logo.src} alt={logo.name} width={logo.width} height={logo.height} loading="lazy" decoding="async" fetchPriority="low" className={`marquee-logo marquee-logo-${logo.tone}`} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
