import { cn } from "@/lib/utils"

/**
 * Réserve de place pendant un chargement. Jamais de spinner plein écran : la
 * page garde sa structure et seuls les blocs manquants respirent.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-sm bg-[color-mix(in_oklch,var(--border-line),var(--surface)_35%)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
