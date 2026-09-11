import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PlanningFormat, PlanningPlatform } from "@/lib/planning/types";
import { splitCaption } from "@/lib/production/wording-performance";

/**
 * Écriture des résultats de génération dans le planning éditorial.
 *
 * C'est le pont que la phase « wording » des cartes client appelle : le texte
 * final va dans `wording`, le texte de créa dans `visual_text`, les slides
 * d'un carrousel dans `slides`, et l'étape passe à `generated`. À la
 * **validation**, l'accroche et l'appel à l'action rejoignent
 * `wording_history` — en complétant la ligne posée à la génération quand elle
 * existe, jamais en en créant une seconde : deux lignes pour un même sujet
 * feraient compter deux fois la même formule dans l'anti-répétition.
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
    .select("id, workspace_id, lane_id, format, scheduled_on, wording")
    .eq("id", input.subjectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!subject) return { ok: false, error: "Publication introuvable." };

  const { error: updateError } = await supabase
    .from("planning_subjects")
    .update({ wording_status: "validated" })
    .eq("id", input.subjectId);
  if (updateError) return { ok: false, error: updateError.message };

  // Une story n'a pas de légende : son texte est ce qui s'affiche à l'écran.
  // L'historiser remplirait la liste anti-répétition de textes qui ne sont
  // jamais des accroches — c'est déjà la règle de `produceWording`.
  if (subject.format === "story") return { ok: true, accroche: null };

  const wording = subject.wording ?? "";
  const parts = wording.trim() === "" ? null : splitCaption(wording);
  if (!parts || parts.hook === "") return { ok: true, accroche: null };

  /* Deux écrivains, une seule ligne.
     `generate.ts` pose déjà une entrée complète à la génération — accroche,
     texte entier, réseau, format, date. Cette fonction n'écrivait, elle, que
     `hook` : la moitié de l'historique était donc inexploitable par les
     prompts, qui lisent `full_wording` pour le registre et `cta` pour
     l'anti-répétition. On **complète** désormais la ligne du sujet quand elle
     existe — le texte a pu être retouché à la main entre la génération et la
     validation, et c'est la version validée qui fait référence — et on n'en
     crée une que pour un wording jamais passé par la génération. */
  const { data: existing } = await supabase
    .from("wording_history")
    .select("id")
    .eq("subject_id", subject.id)
    .limit(1)
    .maybeSingle();

  const { data: lane } = await supabase
    .from("planning_lanes")
    .select("platform")
    .eq("id", subject.lane_id)
    .maybeSingle();

  const entry = {
    hook: parts.hook,
    cta: parts.cta,
    full_wording: wording.trim(),
    platform: (lane?.platform ?? null) as PlanningPlatform | null,
    format: subject.format as PlanningFormat,
    published_at: subject.scheduled_on,
  };

  // Perdre une ligne d'historique ne doit pas faire échouer la validation :
  // même tolérance d'échec que le journal du planning.
  if (existing) {
    await supabase.from("wording_history").update(entry).eq("id", existing.id);
    return { ok: true, accroche: parts.hook };
  }

  // `org_id` est obligatoire sur la table : il se lit depuis l'espace plutôt
  // que d'être passé par l'appelant, qui ne connaît que la publication.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("org_id")
    .eq("id", subject.workspace_id)
    .maybeSingle();

  if (workspace) {
    await supabase.from("wording_history").insert({
      org_id: workspace.org_id,
      workspace_id: subject.workspace_id,
      subject_id: subject.id,
      ...entry,
    });
  }

  return { ok: true, accroche: parts.hook };
}
