/**
 * Le bandeau de logos clients : une rangée qui glisse lentement de droite à
 * gauche, en continu, et s'arrête sous le pointeur. Tout est CSS : la piste
 * est rendue deux fois et translatée d'une moitié, le navigateur boucle.
 *
 * Les marques sont passées en monochrome par filtre (blanc sur fond sombre),
 * pour qu'un rond orange et un losange noir pèsent le même poids. Le nom est
 * écrit à côté : plusieurs logos sont des sigles, le mot dit qui c'est.
 */
/**
 * `tone` dit comment passer la marque en clair sur l'encre : `light` est déjà
 * claire, `invert` est un tracé sombre sur fond transparent (on l'inverse),
 * `lift` est un sigle en couleur sur un aplat (on l'éclaircit en gris).
 */
export type MarqueeLogo = { src: string; name: string; width: number; height: number; tone: "light" | "invert" | "lift" };

export function LogoMarquee({ logos, label, className = "" }: { logos: MarqueeLogo[]; label: string; className?: string }) {
  const track = [...logos, ...logos];
  return (
    <div className={`marquee ${className}`} role="region" aria-label={label}>
      <ul className="marquee-track">
        {track.map((logo, index) => (
          <li key={`${logo.src}-${index}`} className="marquee-item" aria-hidden={index >= logos.length || undefined}>
            <img src={logo.src} alt="" width={logo.width} height={logo.height} loading="lazy" decoding="async" className={`marquee-logo marquee-logo-${logo.tone}`} />
            <span className="type-small whitespace-nowrap text-text-2">{logo.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
