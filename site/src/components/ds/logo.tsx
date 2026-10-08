/**
 * Le logotype : « antidotes » en bas de casse, dans la police de marque, en
 * graisse lourde et interlettrage négatif pour que les lettres se touchent,
 * et un point menthe en guise de signe. Du texte, pas une image : il prend
 * la couleur courante et se lit par tout le monde.
 */
export function Logo({ className = "", size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={`font-brand inline-flex items-baseline gap-[0.12em] leading-none ${className}`} style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.07em" }} aria-label="antidotes">
      <span aria-hidden>antidotes</span>
      <span aria-hidden className="inline-block rounded-full bg-mint" style={{ width: size * 0.22, height: size * 0.22 }} />
    </span>
  );
}
