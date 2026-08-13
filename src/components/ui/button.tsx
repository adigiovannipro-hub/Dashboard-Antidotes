import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // `transition-all` est parti au profit de la liste explicite : la charte
  // l'interdit (une transition sur `all` s'applique aussi à la largeur et à la
  // hauteur, donc au calcul de mise en page à chaque image), et un bouton qui
  // gagne un libellé — « Enregistrer » qui devient « Enregistrement… » —
  // s'étirait au lieu de changer.
  //
  // `transform` sort aussi de la liste, et c'est délibéré : l'enfoncement doit
  // être **instantané**. Un pixel qui met 150 ms à descendre sous le doigt se
  // sent comme un retard, pas comme une réponse. Le reste — couleurs, bordure,
  // ombre, opacité du désactivé — garde la durée de référence.
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding type-label whitespace-nowrap transition-[background-color,border-color,box-shadow,color,opacity] duration-(--motion-duration) ease-standard outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        // Réservé aux actions de création. Le fond est l'encre verte et non le
        // vert de marque : du blanc sur `--accent` ne monte qu'à 2,71:1.
        //
        // En thème sombre, l'encre verte **se retourne** : `--accent-ink`
        // passe de `#2f5320` à `#b7e99b`, et le blanc posé dessus tombe à
        // 1,39:1 — « Ajouter un devis » et « Ajouter un pilier » étaient
        // illisibles. La règle de la charte est celle des pastilles : le fond
        // change de clarté, c'est donc l'encre du texte qui suit. Sur le vert
        // clair, l'encre est le fond de page (13,7:1).
        accent:
          "bg-accent-ink text-white hover:bg-accent-ink/90 dark:text-canvas",
        outline:
          "border-border bg-surface hover:border-border-strong hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-danger-subtle text-danger-ink hover:bg-danger-subtle/70 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-sm px-2 type-caption has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-sm px-3 type-caption has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
