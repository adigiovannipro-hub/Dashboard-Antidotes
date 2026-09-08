"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { embedLibraryNow, importSharesCsv, type InboundResult } from "@/app/actions/antidotes-inbound";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";

/**
 * L'import de l'export LinkedIn (Shares.csv) et le calcul des vecteurs à la
 * demande. Le fichier part dans le formulaire : quelques centaines de Ko,
 * loin du plafond du proxy.
 */
export function LibraryImportForm() {
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(importSharesCsv, null);
  const lastState = useRef<InboundResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) toast.success(state.message ?? "Importé.");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input
        ref={input}
        type="file"
        name="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Fichier Shares.csv"
        onChange={(event) => {
          if (event.target.files?.length) event.currentTarget.form?.requestSubmit();
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
        <Upload aria-hidden />
        <PendingLabel pending={pending} busy="Import…">
          Importer Shares.csv
        </PendingLabel>
      </Button>
    </form>
  );
}

export function EmbedButton({ missing, available }: { missing: number; available: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (missing === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      title={available ? undefined : "OPENAI_API_KEY absente"}
      onClick={() =>
        startTransition(async () => {
          const result = await embedLibraryNow();
          if (result.ok) {
            toast.success(result.message ?? "Fait.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <Sparkles aria-hidden />
      <PendingLabel pending={pending} busy="Calcul…">
        {`Vectoriser ${missing} post${missing > 1 ? "s" : ""}`}
      </PendingLabel>
    </Button>
  );
}
