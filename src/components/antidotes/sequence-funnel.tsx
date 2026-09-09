import { formatValue } from "@/lib/format";
import { buildSequenceFunnel, formatRate, type SequenceCounts } from "@/lib/antidotes/sequences/stats";
import { cn } from "@/lib/utils";

/**
 * L'entonnoir d'une séquence — Inscrits → Contactés → Ont répondu →
 * Rendez-vous — dans la forme de l'entonnoir du Reporting (une bande, un bloc
 * par marche : libellé, chiffre, barre proportionnelle), avec deux écarts
 * voulus par le retour de l'utilisateur.
 *
 * Il est **en encre**, pas en rampe de couleur : « un entonnoir, en noir ».
 * `bg-text-primary` est l'encre du texte, qui s'inverse proprement en sombre
 * — un aplat noir figé aurait disparu sur le canvas sombre.
 *
 * Et le taux de passage vit **au-dessus** de chaque marche plutôt qu'en
 * pastille entre deux blocs : « les pourcentages à chaque fois inscrits
 * au-dessus ». La première marche porte « 100 % », une marche dont la
 * précédente est vide porte « — » — 0 réponse sur 0 contacté n'est pas un
 * taux de 0 %.
 *
 * La forme `compact` sert aux lignes de la liste : chiffres et taux sur une
 * ligne, barres fines, pour comparer les séquences d'un coup d'œil sans que
 * chaque ligne prenne la hauteur d'un panneau.
 */
export function SequenceFunnel({
  counts,
  compact,
  className,
}: {
  counts: SequenceCounts;
  compact?: boolean;
  className?: string;
}) {
  const steps = buildSequenceFunnel(counts);
  const first = steps[0]?.value ?? 0;

  if (compact) {
    return (
      <div className={cn("grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4", className)}>
        {steps.map((step) => {
          const share = first > 0 ? step.value / first : 0;
          return (
            <div key={step.key} className="min-w-0">
              <p className="type-caption flex items-baseline gap-1.5 text-text-secondary tabular-nums">
                <span className="font-medium text-text-primary">{formatValue(step.value, "integer")}</span>
                <span className="min-w-0 truncate">{step.label.toLowerCase()}</span>
                <span className="ml-auto shrink-0">{formatRate(step.passage)}</span>
              </p>
              <Bar share={share} value={step.value} label={step.label} className="mt-1 h-1" />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:gap-6", className)}>
      {steps.map((step) => {
        const share = first > 0 ? step.value / first : 0;
        return (
          <div key={step.key} className="min-w-0 flex-1">
            <p className="type-caption font-medium text-text-primary tabular-nums">{formatRate(step.passage)}</p>
            <p className="type-overline mt-1 truncate text-text-secondary" title={step.label}>
              {step.label}
            </p>
            <p className="type-stat mt-2 text-text-primary">{formatValue(step.value, "integer")}</p>
            <Bar share={share} value={step.value} label={step.label} className="mt-3 h-2" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Les messages, à part des personnes : « 12 emails envoyés · 1 rebond ».
 * C'est l'information secondaire sous l'entonnoir — la marche « Contactés »
 * compte des gens, cette ligne compte ce qui est parti. Les pistes LinkedIn,
 * les désinscrits et l'état des inscriptions en cours s'y rangent aussi.
 */
export function SequenceMessages({ counts, className }: { counts: SequenceCounts; className?: string }) {
  const plural = (n: number, one: string, many: string) => `${formatValue(n, "integer")} ${n > 1 ? many : one}`;
  const parts: { text: string; danger?: boolean }[] = [
    { text: plural(counts.sent, "email envoyé", "emails envoyés") },
  ];
  if (counts.bounced > 0) parts.push({ text: plural(counts.bounced, "rebond", "rebonds"), danger: true });
  if (counts.linkedin > 0) parts.push({ text: `${formatValue(counts.linkedin, "integer")} LinkedIn` });
  if (counts.stoppedOnOptOut > 0) parts.push({ text: plural(counts.stoppedOnOptOut, "désinscrit", "désinscrits") });
  if (counts.active > 0) parts.push({ text: `${formatValue(counts.active, "integer")} en cours` });
  if (counts.paused > 0) parts.push({ text: `${formatValue(counts.paused, "integer")} en pause` });

  return (
    <p className={cn("type-caption flex flex-wrap items-center gap-x-1.5 text-text-secondary tabular-nums", className)}>
      {parts.map((part, index) => (
        <span key={part.text} className={cn(part.danger && "text-danger-ink")}>
          {index > 0 ? "· " : ""}
          {part.text}
        </span>
      ))}
    </p>
  );
}

/**
 * Une barre garde un minimum visible : un rendez-vous sur cent inscrits fait
 * 1 %, et un trait d'un pixel se lirait comme un défaut d'affichage.
 */
function Bar({ share, value, label, className }: { share: number; value: number; label: string; className?: string }) {
  const width = value > 0 ? Math.max(share * 100, 5) : 0;
  return (
    <div
      className={cn("overflow-hidden rounded-pill bg-surface-sunken", className)}
      role="img"
      aria-label={`${label} : ${formatValue(value, "integer")}, soit ${formatRate(share)} des inscrits`}
    >
      <div
        className="h-full rounded-pill bg-text-primary transition-[width] duration-(--motion-duration) ease-standard"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
