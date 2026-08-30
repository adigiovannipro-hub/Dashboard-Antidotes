import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { generateWordingForSubject } from "@/lib/production/generate";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le wording d'une seule publication, à la demande — le bouton stylo d'une
 * cellule du planning. Synchrone : un appel au modèle, la réponse porte le
 * verdict, l'écran se rafraîchit derrière.
 *
 * Outil d'agence, jamais client : 404 pour tout autre rôle, comme le reste
 * de la génération.
 */

export const dynamic = "force-dynamic";
// Un seul appel au modèle, mais la réflexion se paie en secondes : même marge
// que la génération de phase, même incertitude Hobby.
export const maxDuration = 300;

const BodySchema = z.object({ subject_id: z.uuid() });

export async function POST(request: Request) {
  // Contrôle d'accès d'abord : module interne, 404 et jamais 403.
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  // La publication doit vivre dans un espace dont le visiteur est owner : la
  // lecture passe en admin, la frontière se vérifie donc ici, avant tout
  // travail.
  const supabase = createAdminClient();
  const { data: subject } = await supabase
    .from("planning_subjects")
    .select("id, workspace_id")
    .eq("id", parsed.data.subject_id)
    .maybeSingle();
  if (!subject) return new NextResponse(null, { status: 404 });

  const owned = viewer.workspaces.some(
    (workspace) =>
      workspace.id === (subject as { workspace_id: string }).workspace_id &&
      workspace.role === "owner",
  );
  if (!owned) return new NextResponse(null, { status: 404 });

  const result = await generateWordingForSubject(parsed.data.subject_id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
