import { cn } from "@/lib/utils";

/**
 * Les champs natifs du pôle Antidotes, au vocabulaire du système.
 *
 * Un `<select>` natif plutôt que le composant Base UI : dans une barre de
 * filtres ou un formulaire de panneau, il est plus léger, se lit au clavier
 * sans surprise, et prend l'apparence des champs de la maison par les mêmes
 * classes que « Mon travail ». Le vert n'apparaît qu'au survol et au focus.
 */

const FIELD =
  "rounded-md border border-input bg-surface text-text-primary outline-none transition-colors duration-(--motion-duration) ease-standard hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

export const FIELD_CLASS = {
  default: cn(FIELD, "type-body h-10 px-3"),
  small: cn(FIELD, "type-caption h-8 px-2.5"),
} as const;

export function NativeSelect({
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  /* `size` masque l'attribut HTML du même nom — le nombre de lignes visibles
     d'une liste — que personne n'utilise ici. */
  size?: keyof typeof FIELD_CLASS;
}) {
  return (
    <select
      className={cn(FIELD_CLASS[size], "min-w-0 appearance-none pr-8", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.6rem center",
      }}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        FIELD,
        "type-body min-h-20 w-full resize-y px-3 py-2 placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
