import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { isProductionPhase } from "@/lib/production/types";
import { createClient } from "@/lib/supabase/server";

/**
 * L'état d'une phase, changé à la main depuis la carte.
 *
 * Le cycle se déduit du travail réel — un reporting généré marque sa phase
 * terminée — mais il arrive qu'un mois ne puisse pas se dérouler : un client
 * arrivé en cours de route n'a pas de planning à analyser le mois d'avant, et
 * son reporting reste alors éternellement en retard sans qu'aucun geste ne
 * puisse le clore. Cliquer sur un segment est cette sortie.
 *
 * Route et non Server Action : la carte est un composant client qui parle
 * déjà à `/api/generate/*`, `/api/jobs/*` et `/api/production/validation`.
 * Une action à signature `useActionState` pour un clic de menu ferait entrer
 * un formulaire là où il n'y en a pas.
 */

export const dynamic = "force-dynamic";

/** `in_progress` n'est pas proposé : c'est le worker qui l'écrit, pas moi. */
const SETTABLE = ["pending", "done", "skipped"] as const;

const bodySchema = z.object({
  workspace_id: z.uuid(),
  phase: z.string().refine(isProductionPhase, "Phase inconnue."),
  target_month: z.string().regex(/^\d{4}-\d{2}-01$/, "Premier jour du mois attendu."),
  status: z.enum(SETTABLE),
});

export async function POST(request: Request) {
  // Contrôle d'accès d'abord : module interne, 404 et jamais 403.
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const workspace = viewer.workspaces.find(
    (candidate) =>
      candidate.id === parsed.data.workspace_id &&
      candidate.role === "owner" &&
      candidate.type === "client",
  );
  if (!workspace) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();

  // « À faire » supprime la ligne plutôt que d'écrire `pending` : l'absence de
  // ligne *est* l'état neutre du module, et c'est le seul qui efface aussi la
  // date d'achèvement. Une phase remise à zéro repart de l'état calculé — donc
  // en retard si sa fenêtre est passée, ce qui est le but.
  if (parsed.data.status === "pending") {
    const { error } = await supabase
      .from("client_phases")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("phase", parsed.data.phase)
      .eq("target_month", parsed.data.target_month);
    if (error) {
      return NextResponse.json(
        { ok: false, error: describeWriteFailure(error) },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: "pending" });
  }

  const { error } = await supabase.from("client_phases").upsert(
    {
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      phase: parsed.data.phase,
      target_month: parsed.data.target_month,
      status: parsed.data.status,
      // Une phase passée n'a pas été faite : elle n'a pas de date
      // d'achèvement, et le reporting de la carte ne doit pas en inventer une.
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    } as never,
    { onConflict: "workspace_id,phase,target_month" },
  );
  if (error) {
    return NextResponse.json(
      { ok: false, error: describeWriteFailure(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

/** La table absente est le cas fréquent au démarrage : le dire fait gagner du temps. */
function describeWriteFailure(error: { code?: string; message?: string }): string {
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "");
  return missing
    ? "Les tables du module ne sont pas en base : appliquer les migrations 0032 et 0033."
    : "Enregistrement impossible.";
}
