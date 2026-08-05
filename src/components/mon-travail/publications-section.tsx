import { Send } from "lucide-react";

import { PublicationRowView } from "@/components/mon-travail/publication-row";
import type { PublicationRow } from "@/lib/mon-travail/types";

/**
 * « À publier » : les lignes de publication du jour, tous clients confondus,
 * pour vérifier que ce qui devait partir est bien parti. Ce qui est déjà
 * marqué publié n'apparaît plus ici — il a rejoint « Archivé » en bas de page.
 */
export function PublicationsSection({ rows }: { rows: PublicationRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <Send className="size-3.5" aria-hidden />
        À publier
        {rows.length > 0 ? (
          <span className="bg-muted text-foreground rounded-full px-1.5 py-px text-[10px] tabular-nums">
            {rows.length}
          </span>
        ) : null}
      </h2>

      {rows.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
          Rien à publier aujourd&apos;hui.
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          {rows.map((row) => (
            <PublicationRowView key={row.subject.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
