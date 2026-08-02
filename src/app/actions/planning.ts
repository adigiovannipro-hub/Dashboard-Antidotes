"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { getPlanningContext } from "@/lib/planning/access";
import { MondayConnector } from "@/lib/planning/connectors/monday";
import { can } from "@/lib/planning/permissions";
import type { PlanningCapability } from "@/lib/planning/permissions";
import { pullClient, pushPendingWording } from "@/lib/planning/sync";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type PlanningResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Actions du module.
 *
 * Le wording suit un chemin en deux temps volontaire : enregistrer d'abord dans
 * la base, envoyer dans Monday ensuite, sur action explicite. Un client qui
 * relit son planning ne doit pas voir une caption changer sous ses yeux parce
 * que quelqu'un tapait à côté.
 */

async function requireCapability(clientId: string, capability: PlanningCapability) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const { access } = await getPlanningContext();
  if (!access.clientIds.includes(clientId)) {
    // Message neutre : ne pas confirmer l'existence du client.
    throw new Error("Action indisponible.");
  }
  if (!can(access.role, capability)) {
    throw new Error("Votre rôle ne permet pas cette action.");
  }
  return { viewer, access };
}

const wordingInput = z.object({
  clientId: z.uuid(),
  clientSlug: z.string().min(1),
  subjectId: z.uuid(),
  wording: z.string(),
});

/**
 * Enregistre un wording en file d'attente.
 *
 * Le texte n'écrase pas `wording` : il vit dans `pending_wording` jusqu'au push.
 * Tant qu'il y reste, la base sait exactement ce que Monday connaît et ce
 * qu'il ignore, ce qui rend le pull suivant inoffensif.
 */
export async function saveWording(
  _previous: PlanningResult | null,
  formData: FormData,
): Promise<PlanningResult> {
  const parsed = wordingInput.safeParse({
    clientId: formData.get("clientId"),
    clientSlug: formData.get("clientSlug"),
    subjectId: formData.get("subjectId"),
    wording: formData.get("wording"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireCapability(parsed.data.clientId, "wording.write");
    const supabase = await createClient();

    const { data: subject } = await supabase
      .from("planning_subjects")
      .select("wording")
      .eq("id", parsed.data.subjectId)
      .maybeSingle();

    const next = parsed.data.wording.trim();

    // Revenir au texte de Monday annule la mise en file plutôt que d'y écrire
    // une modification qui n'en est pas une.
    const unchanged = next === (subject?.wording ?? "").trim();

    await supabase
      .from("planning_subjects")
      .update({
        pending_wording: unchanged ? null : next,
        pending_since: unchanged ? null : new Date().toISOString(),
      })
      .eq("id", parsed.data.subjectId);

    revalidatePath(`/planning/${parsed.data.clientSlug}`);
    return {
      ok: true,
      message: unchanged
        ? "Wording identique à Monday : rien à envoyer."
        : "Wording enregistré. Il part dans Monday à l'envoi.",
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const pushInput = z.object({
  clientId: z.uuid(),
  clientSlug: z.string().min(1),
  subjectId: z.uuid().optional(),
});

/** Envoie les wordings en attente vers Monday. */
export async function pushWording(
  _previous: PlanningResult | null,
  formData: FormData,
): Promise<PlanningResult> {
  const parsed = pushInput.safeParse({
    clientId: formData.get("clientId"),
    clientSlug: formData.get("clientSlug"),
    subjectId: formData.get("subjectId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireCapability(parsed.data.clientId, "sync.push");

    const connector = MondayConnector.fromEnv();
    if (!connector) {
      return {
        ok: false,
        error:
          "Aucun jeton Monday configuré. Le wording reste enregistré ici et " +
          "partira dès que MONDAY_API_TOKEN sera renseigné.",
      };
    }

    const report = await pushPendingWording({
      admin: createAdminClient(),
      connector,
      clientId: parsed.data.clientId,
      subjectId: parsed.data.subjectId,
    });

    revalidatePath(`/planning/${parsed.data.clientSlug}`);

    if (report.pushed === 0 && report.failed.length === 0) {
      return { ok: true, message: "Rien à envoyer." };
    }
    if (report.failed.length > 0) {
      return {
        ok: false,
        error: `${report.pushed} envoyé(s), ${report.failed.length} en échec : ${report.failed[0]!.error}`,
      };
    }
    return {
      ok: true,
      message:
        report.pushed === 1
          ? "Wording envoyé dans Monday."
          : `${report.pushed} wordings envoyés dans Monday.`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const syncInput = z.object({
  clientId: z.uuid(),
  clientSlug: z.string().min(1),
});

/** Relance une synchronisation depuis Monday. */
export async function syncNow(
  _previous: PlanningResult | null,
  formData: FormData,
): Promise<PlanningResult> {
  const parsed = syncInput.safeParse({
    clientId: formData.get("clientId"),
    clientSlug: formData.get("clientSlug"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireCapability(parsed.data.clientId, "sync.pull");

    const connector = MondayConnector.fromEnv();
    if (!connector) {
      return {
        ok: false,
        error:
          "Aucun jeton Monday configuré. L'affichage repose sur les données " +
          "déjà en base.",
      };
    }

    const report = await pullClient({
      admin: createAdminClient(),
      connector,
      clientId: parsed.data.clientId,
    });

    revalidatePath(`/planning/${parsed.data.clientSlug}`);
    return {
      ok: true,
      message: `${report.subjectsUpserted} contenus synchronisés sur ${report.boardsSeen} board(s).`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
