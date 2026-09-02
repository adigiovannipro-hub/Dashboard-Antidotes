import { cn } from "@/lib/utils";

/**
 * La vignette d'introduction d'une formation ou d'un module.
 *
 * Trois exigences, dans cet ordre : afficher l'image quand il y en a une, ne
 * jamais laisser un trou quand il n'y en a pas, et rester lisible dans les
 * deux thèmes. Le repli est un dégradé sombre traversé par le titre en
 * capitales — la forme qu'ont les vignettes de Skool, et surtout la seule qui
 * reste identifiable en petit.
 *
 * La teinte du dégradé est **dérivée du slug** : deux modules voisins ne
 * tombent pas sur la même couleur, et la couleur d'un module ne bouge plus
 * jamais une fois son slug fixé — un dégradé tiré au hasard à chaque rendu
 * ferait clignoter le catalogue à chaque navigation.
 */
export function CoverArt({
  url,
  seed,
  title,
  overlayTitle = true,
  className,
}: {
  url: string | null;
  /** Ce qui détermine la teinte du repli — le slug, stable par nature. */
  seed: string;
  title: string;
  /** Le titre en surimpression du repli. Faux quand il est déjà à côté. */
  overlayTitle?: boolean;
  className?: string;
}) {
  if (url) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-muted", className)}>
        {/* `img` nu et non `next/image` : l'URL est signée et expire, la
            passer à l'optimiseur ferait mettre en cache une adresse morte. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="size-full object-cover transition-transform duration-(--motion-duration) ease-standard group-hover/course:scale-[1.02] group-hover/module:scale-[1.02] motion-reduce:transform-none"
        />
      </div>
    );
  }

  const hue = hueFromSeed(seed);

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden px-5 py-6",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(160deg, oklch(0.22 0.03 ${hue}) 0%, oklch(0.28 0.09 ${hue}) 55%, oklch(0.42 0.17 ${hue}) 100%)`,
      }}
    >
      {overlayTitle ? (
        <span className="type-h3 line-clamp-3 text-center font-semibold tracking-wide text-white uppercase">
          {title}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Une teinte dans 0-360, stable pour un même texte.
 *
 * Somme pondérée des points de code plutôt qu'un hachage cryptographique :
 * on cherche une dispersion visuelle, pas une résistance aux collisions, et
 * cette fonction doit rester exécutable dans un rendu synchrone.
 */
function hueFromSeed(seed: string): number {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total = (total * 31 + seed.charCodeAt(index)) % 360;
  }
  return total;
}
