/**
 * Le logotype : « antidotes » en bas de casse, le second « o » remplacé par
 * un anneau de verre iridescent — la bulle des planches de DA, réduite à un
 * signe. Tout est vectoriel et prend la couleur du texte courant ; seul
 * l'anneau porte le dégradé.
 */
export function Logo({ className = "", height = 22, mono = false }: { className?: string; height?: number; mono?: boolean }) {
  const width = Math.round(height * (188 / 36));
  const id = mono ? "iris-mono" : "iris";
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 188 36"
      role="img"
      aria-label="antidotes"
      fill="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {mono ? (
            <>
              <stop offset="0" stopColor="currentColor" />
              <stop offset="1" stopColor="currentColor" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="var(--iris-cyan)" />
              <stop offset="0.38" stopColor="var(--iris-violet)" />
              <stop offset="0.7" stopColor="var(--iris-pink)" />
              <stop offset="1" stopColor="var(--iris-amber)" />
            </>
          )}
        </linearGradient>
      </defs>
      <text
        x="0"
        y="27"
        fontFamily="var(--font-geist), ui-sans-serif, system-ui"
        fontSize="30"
        fontWeight="500"
        letterSpacing="-1.1"
        fill="currentColor"
      >
        antid
      </text>
      <circle cx="94" cy="18" r="9.5" stroke={`url(#${id})`} strokeWidth="4.5" />
      <circle cx="91" cy="14.5" r="1.6" fill="white" opacity="0.85" />
      <text
        x="109"
        y="27"
        fontFamily="var(--font-geist), ui-sans-serif, system-ui"
        fontSize="30"
        fontWeight="500"
        letterSpacing="-1.1"
        fill="currentColor"
      >
        tes
      </text>
    </svg>
  );
}
