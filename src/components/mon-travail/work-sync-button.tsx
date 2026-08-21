"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Relancer le passage de « Mon travail » sans attendre demain.
 *
 * Le cron tourne à 4 h du matin, une fois par jour — le plan Hobby n'en
 * autorise pas plus. Une réunion de 10 h voit donc ses tâches arriver le
 * lendemain, ce qui est le comportement voulu pour le fond de tâche mais pas
 * pour le geste qu'on a en sortant d'un appel : on veut ses actions tout de
 * suite, tant qu'on les a en tête.
 *
 * La route existait déjà et accepte le propriétaire depuis son navigateur.
 * Ce qui manquait n'était donc pas la capacité mais le geste : une URL à
 * retenir, qui rend du JSON brut, n'est pas un bouton.
 *
 * Le passage est idempotent — `dedupe_key` sur chaque tâche — donc cliquer
 * deux fois n'écrit rien de plus.
 */

/** Le rapport que rend la route, réduit à ce dont le toast a besoin. */
export type Rapport = {
  ok?: boolean;
  errors?: string[];
  report?: Record<string, { creees?: number; reunions?: number; raison?: string }>;
};

/** Ce qu'on dit à l'écran d'un rapport : le résultat, jamais le détail brut. */
export function resume(rapport: Rapport): { ok: boolean; message: string } {
  const entrees = Object.entries(rapport.report ?? {});
  const creees = entrees.reduce((total, [, v]) => total + (v?.creees ?? 0), 0);
  const reunions = entrees
    .filter(([cle]) => cle.startsWith("fathom:"))
    .reduce((total, [, v]) => total + (v?.reunions ?? 0), 0);

  /* Une raison de refus vaut mieux qu'un « 0 tâche » : sans clé d'API,
     l'étape Fathom ne s'exécute pas, et le silence ressemblerait à une
     réunion sans action. */
  const raison = entrees
    .filter(([cle]) => cle.startsWith("fathom:"))
    .map(([, v]) => v?.raison)
    .find((v): v is string => typeof v === "string" && v.length > 0);

  if (rapport.errors?.length) {
    return { ok: false, message: rapport.errors[0]! };
  }
  if (raison) return { ok: false, message: `Fathom : ${raison}` };
  if (creees > 0) {
    return {
      ok: true,
      message: `${creees} tâche${creees > 1 ? "s" : ""} ajoutée${creees > 1 ? "s" : ""}.`,
    };
  }
  return {
    ok: true,
    message:
      reunions > 0
        ? `${reunions} réunion${reunions > 1 ? "s" : ""} relue${reunions > 1 ? "s" : ""} — rien de nouveau à ajouter.`
        : "Rien de nouveau : tout était déjà là.",
  };
}

export function WorkSyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enCours, setEnCours] = useState(false);

  const lancer = () => {
    setEnCours(true);
    void fetch("/api/cron/mon-travail", { method: "GET" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Rapport | null;
        if (!response.ok || !payload) {
          toast.error("La synchronisation a échoué.");
          return;
        }
        const { ok, message } = resume(payload);
        if (ok) toast.success(message);
        else toast.error(message);
        start(() => router.refresh());
      })
      .catch(() => toast.error("La synchronisation a échoué."))
      .finally(() => setEnCours(false));
  };

  const occupe = enCours || pending;

  return (
    <Button size="sm" variant="outline" onClick={lancer} disabled={occupe}>
      <RefreshCw
        className={occupe ? "size-4 animate-spin" : "size-4"}
        strokeWidth={1.75}
        aria-hidden
      />
      {occupe ? "Relecture…" : "Relire mes réunions"}
    </Button>
  );
}
