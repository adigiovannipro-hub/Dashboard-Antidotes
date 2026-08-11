import "server-only";

import { createClient } from "@/lib/supabase/server";
import { extractAccroche } from "./accroche";

/**
 * Écriture des résultats de génération dans le planning éditorial.
 *
 * C'est le pont que la phase « wording » des cartes client appelle : le texte
 * final va dans `wording`, le texte de créa dans `visual_text`, les slides
 * d'un carrousel dans `slides`, et l'étape passe à `generated`. L'accroche ne
 * part dans `wording_history` qu'à la **validation** — jamais à la
 * génération, sinon l'historique se remplirait de brouillons.
 */

export async function applyWordingResult(input: {
  subjectId: string;
  wording: string;
  visualText?: string | null;
  slides?: unknown[] | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("planning_subjects")
    .update({
      wording: input.wording,
      visual_text: input.visualText ?? null,
      slides: input.slides ?? null,
      wording_status: "generated",
    })
    .eq("id", input.subjectId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function validateWording(input: {
  subjectId: string;
}): Promise<{ ok: true; accroche: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: subject, error } = await supabase
    .from("planning_subjects")
    .select("id, workspace_id, wording")
    .eq("id", input.subjectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!subject) return { ok: false, error: "Publication introuvable." };

  const { error: updateError } = await supabase
    .from("planning_subjects")
    .update({ wording_status: "validated" })
    .eq("id", input.subjectId);
  if (updateError) return { ok: false, error: updateError.message };

  const accroche = subject.wording ? extractAccroche(subject.wording) : "";
  if (accroche.length === 0) return { ok: true, accroche: null };

  // Perdre une ligne d'historique ne doit pas faire échouer la validation :
  // même tolérance d'échec que le journal du planning.
  await supabase.from("wording_history").insert({
    workspace_id: subject.workspace_id,
    subject_id: subject.id,
    accroche,
  });

  return { ok: true, accroche };
}
