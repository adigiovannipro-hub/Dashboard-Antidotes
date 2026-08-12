import "server-only";

import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth";
import type { WorkspaceAccess } from "@/lib/auth";

import { listHiddenPages } from "./queries";

/**
 * Garde d'une page à l'intérieur d'un espace.
 *
 * L'adhésion donne l'espace ; cette garde donne la page. Une page masquée
 * rend **404 et non 403** : un partenaire qui n'a pas le reporting n'a pas à
 * apprendre qu'il existe en tombant sur un accès refusé.
 *
 * Le rail n'affiche déjà pas le lien, mais l'URL se tape, se garde en favori
 * et se partage : le filtrage de la navigation n'est pas une protection.
 */
export async function requirePageAccess(
  workspace: WorkspaceAccess,
  pageKey: string,
): Promise<void> {
  if (workspace.role === "owner") return;

  const viewer = await getViewer();
  if (!viewer?.email) notFound();

  const hidden = await listHiddenPages(workspace.id, viewer.email);
  if (hidden.has(pageKey)) notFound();
}
