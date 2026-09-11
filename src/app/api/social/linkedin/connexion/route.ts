import { NextResponse } from "next/server";

import { getViewer, getWorkspace } from "@/lib/auth";
import { importLinkedinInventory } from "@/lib/connectors/linkedin/sync";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le branchement LinkedIn d'un espace — sans aller-retour OAuth.
 *
 * C'est ce qui le distingue de Meta et de YouTube : **l'autorisation vit
 * chez Composio**, posée une fois par le workflow « Composio — lien de
 * connexion ». Il n'y a donc ni consentement à demander ici, ni jeton à
 * chiffrer : la route ne fait qu'aller chercher les pages entreprise que le
 * compte administre et les ranger dans l'inventaire de l'agence.
 *
 * Rien n'est affecté au passage — l'affectation reste un geste explicite
 * dans Connexions, comme pour Meta : « Lunettes BONDET » a beau ressembler à
 * l'espace Bondet, deviner ferait publier chez le mauvais client.
 *
 * Module interne : 404 et non 403 à qui n'est pas propriétaire.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("espace");
  if (!workspaceSlug) return new NextResponse(null, { status: 404 });

  const asked = url.searchParams.get("retour") ?? "";
  const back = asked.startsWith(`/espace/${workspaceSlug}/`)
    ? asked
    /* La porte de l'espace, qui redirige vers sa première page : Connexions
       a quitté le planning pour le Reporting, et un défaut codé en dur sur le
       planning ramènerait ailleurs que là d'où l'on est parti. */
    : `/espace/${workspaceSlug}`;

  // Brancher un compte engage l'inventaire de l'agence : réservé à l'agence.
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  const target = new URL(back, publicEnv.NEXT_PUBLIC_SITE_URL);

  const viewer = await getViewer();

  const outcome = await importLinkedinInventory({
    admin: createAdminClient(),
    orgId: workspace.org_id,
    workspaceId: workspace.id,
    connectedBy: viewer?.user.id ?? null,
  });

  if ("error" in outcome) {
    target.searchParams.set("erreur", outcome.error);
  } else {
    target.searchParams.set(
      "message",
      `${outcome.pages} page${outcome.pages > 1 ? "s" : ""} LinkedIn ${
        outcome.pages > 1 ? "ajoutées" : "ajoutée"
      } à l'inventaire.`,
    );
  }

  return NextResponse.redirect(target);
}
