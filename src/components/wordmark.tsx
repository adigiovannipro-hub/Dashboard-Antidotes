import { cn } from "@/lib/utils";

/**
 * Signature de la plateforme. Le glyphe est un simple losange tracé en CSS :
 * pas d'image à charger, et il suit la couleur du texte dans les deux thèmes.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="bg-foreground inline-block size-3 rotate-45 rounded-[2px]"
      />
      <span className="text-lg font-semibold tracking-tight">Antidotes</span>
    </span>
  );
}
