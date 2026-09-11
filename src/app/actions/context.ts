"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { normalizeDeliverables } from "@/lib/context/deliverables";
import { buildContextDiff, mergeProposal, type ContextFieldDiff } from "@/lib/context/diff";
import { proposeConsolidation } from "@/lib/context/consolidation";
import { renderAssetSummaries } from "@/lib/context/injected-context";
import { validateWording } from "@/lib/context/apply-wording";
import {
  ASSETS_BUCKET,
  assetPath,
  isAcceptedAsset,
  isOwnedAssetPath,
  MAX_ASSET_BYTES,
} from "@/lib/context/storage";
import {
  FIELD_LABELS,
  isClientAssetType,
  isContextTextField,
  type ClientContext,
  type ContextDeliverables,
  type ContextFieldKey,
  type ContextProposal,
  type SourcedFact,
  type ValidatedExample,
} from "@/lib/context/types";
import {
  networksFromContextName,
  REPORTING_NETWORK_LABELS,
} from "@/lib/reporting/networks";
import { createClient } from "@/lib/supabase/server";

export type ContextResult = { ok: true; message?: string } | { ok: false; error: string };

export type ContextUploadResult =
  | { ok: true; assetIds: string[]; message: string }
  | { ok: false; error: string };

export type ContextProposalResult =
  | { ok: true; proposal: ContextProposal; diff: ContextFieldDiff[] }
  | { ok: false; error: string };

/**
 * Actions du Contexte client.
 *
 * Strictement réservées à l'owner : la garde rend le même message neutre
 * qu'un espace inexistant, et la RLS de 0033 reste l'autorité derrière elle.
 * Chaque écriture revalide la page Contexte de l'espace, rien d'autre.
 */

const OK: ContextResult = { ok: true };

type Scope = { workspace: string };

async function guardOwner(scope: Scope) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const workspace = await getWorkspace(scope.workspace);
  // Message neutre : ne pas confirmer l'existence d'un espace inaccessible,
  // ni révéler qu'une page Contexte existe à qui n'est pas owner.
  if (!workspace || workspace.role !== "owner") throw new Error("Action indisponible.");

  return { viewer, workspace };
}

function revalidate(scope: Scope) {
  revalidatePath(`/espace/${scope.workspace}/contexte`);
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: (error as Error).message };
}

async function getActiveRow(workspaceId: string): Promise<ClientContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_context")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as ClientContext | null) ?? null;
}

/**
 * Les champs que seul un humain écrit. Repris tels quels d'une version à
 * l'autre : la consolidation ne les propose pas (ils ne sont pas dans
 * `ContextProposal`), donc sans ce report une régénération les effacerait en
 * silence — le pire des deux mondes, puisque l'écran promet de ne jamais
 * écraser.
 */
function humanFields(row: ClientContext | null): {
  validated_examples: ValidatedExample[];
  client_feedback: string | null;
  sourced_facts: SourcedFact[];
} {
  return {
    validated_examples: row?.validated_examples ?? [],
    client_feedback: row?.client_feedback ?? null,
    sourced_facts: row?.sourced_facts ?? [],
  };
}

/**
 * Écrit un lot de colonnes sur la version active, ou crée la première version
 * s'il n'y en a aucune. L'édition manuelle ne versionne jamais : le
 * versionnage est réservé à la régénération et à la restauration, sinon
 * chaque blur fabriquerait une version de plus.
 */
async function writeActiveFields(
  workspaceId: string,
  createdBy: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();
  const active = await getActiveRow(workspaceId);

  if (active) {
    const { error } = await supabase
      .from("client_context")
      .update(patch as never)
      .eq("id", active.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("client_context")
    .insert({ workspace_id: workspaceId, created_by: createdBy, ...patch } as never);
  if (error) throw new Error(error.message);
}

// --- Brief : édition en place -------------------------------------------------

const pillarSchema = z.object({
  nom: z.string().max(200),
  description: z.string().max(4000),
  formats: z.array(z.string().max(100)).max(20),
  angles: z.array(z.string().max(300)).max(40),
  frequence: z.string().max(200),
  /* Optionnels et non `.default("")` : `z.object` **retire** les clés qu'il
     ne déclare pas, et un pilier sauvegardé sans elles perdrait son objectif
     business au premier blur — le champ serait rempli à l'écran et absent de
     la base. */
  objectif_business: z.string().max(500).optional(),
  cta_autorises: z.array(z.string().max(120)).max(12).optional(),
});

const textFieldSchema = z.object({
  field: z.string(),
  value: z.string().max(20_000),
});

/**
 * Sauvegarde d'un champ texte au blur. L'édition manuelle modifie la version
 * active en place — le versionnage est réservé à la régénération et à la
 * restauration, sinon chaque blur créerait une version.
 */
export async function saveContextField(
  scope: Scope,
  input: { field: string; value: string },
): Promise<ContextResult> {
  const parsed = textFieldSchema.safeParse(input);
  if (!parsed.success || !isContextTextField(parsed.data.field)) {
    return { ok: false, error: "Champ inconnu." };
  }

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();
    const value = parsed.data.value.trim() || null;

    const active = await getActiveRow(workspace.id);
    if (active) {
      const { error } = await supabase
        .from("client_context")
        .update({ [parsed.data.field]: value } as never)
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        [parsed.data.field]: value,
        created_by: viewer.user.id,
      } as never);
      if (error) throw new Error(error.message);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function savePillars(
  scope: Scope,
  input: { pillars: unknown },
): Promise<ContextResult> {
  const parsed = z.array(pillarSchema).max(30).safeParse(input.pillars);
  if (!parsed.success) return { ok: false, error: "Piliers invalides." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const active = await getActiveRow(workspace.id);
    if (active) {
      const { error } = await supabase
        .from("client_context")
        .update({ pillars: parsed.data })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        pillars: parsed.data,
        created_by: viewer.user.id,
      });
      if (error) throw new Error(error.message);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function savePlatformRules(
  scope: Scope,
  input: { platforms: unknown },
): Promise<ContextResult> {
  const parsed = z.record(z.string().max(50), z.string().max(4000)).safeParse(input.platforms);
  if (!parsed.success) return { ok: false, error: "Règles de plateforme invalides." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const platforms = Object.fromEntries(
      Object.entries(parsed.data)
        .map(([key, value]) => [key.trim().toLowerCase(), value] as const)
        .filter(([key]) => key.length > 0),
    );

    const active = await getActiveRow(workspace.id);
    if (active) {
      const { error } = await supabase
        .from("client_context")
        .update({ platforms })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        platforms,
        created_by: viewer.user.id,
      });
      if (error) throw new Error(error.message);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const publicationSchema = z.object({
  categorie: z.string().max(60),
  quantite: z.number().int().min(0).max(999),
});

const deliverablesSchema = z.object({
  intentions: z.string().max(300),
  reseaux: z
    .array(z.object({ nom: z.string().max(60), publications: z.array(publicationSchema).max(20) }))
    .max(20),
  publications: z.array(publicationSchema).max(20),
});

/**
 * Les livrables mensuels : le contrat, pas la marque. Saisis à la main et
 * jamais proposés par la consolidation — un volume de publications inventé
 * par un modèle se lirait comme un engagement.
 */
export async function saveDeliverables(
  scope: Scope,
  input: { deliverables: unknown },
): Promise<ContextResult> {
  const parsed = deliverablesSchema.safeParse(input.deliverables);
  if (!parsed.success) return { ok: false, error: "Livrables invalides." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();
    const deliverables = normalizeDeliverables(parsed.data);

    const active = await getActiveRow(workspace.id);
    if (active) {
      const { error } = await supabase
        .from("client_context")
        .update({ deliverables })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        deliverables,
        created_by: viewer.user.id,
      });
      if (error) throw new Error(error.message);
    }

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const reportingNetworkSchema = z.enum([
  "meta-ads",
  "instagram",
  "facebook",
  "linkedin",
  "linkedin-ads",
  "tiktok",
  "tiktok-ads",
  "youtube",
  "x",
  "site-web",
]);

/**
 * Le « + » du Reporting : déclarer un réseau de plus aux livrables du client,
 * donc ouvrir son onglet. C'est la même écriture que l'édition des livrables
 * au Contexte — l'onglet n'est que la lecture de cette déclaration — mais en
 * un geste depuis la page où on constate le manque. L'onglet s'ouvre aussitôt,
 * avec son état vide qui dit le branchement restant à faire.
 */
export async function addReportingNetwork(
  scope: Scope,
  input: { reseau: unknown },
): Promise<ContextResult> {
  const parsed = reportingNetworkSchema.safeParse(input.reseau);
  if (!parsed.success) return { ok: false, error: "Réseau inconnu." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();
    const label = REPORTING_NETWORK_LABELS[parsed.data];

    const active = await getActiveRow(workspace.id);
    const deliverables = normalizeDeliverables(active?.deliverables ?? null);

    // Déjà déclaré — peu importe la graphie (« Insta », « Meta »…) : la
    // résolution est la même que celle qui construit les onglets.
    const declared = deliverables.reseaux.flatMap((reseau) =>
      networksFromContextName(reseau.nom),
    );
    if (declared.includes(parsed.data)) {
      return { ok: true, message: `${label} est déjà déclaré pour ce client.` };
    }

    const next = {
      ...deliverables,
      reseaux: [...deliverables.reseaux, { nom: label, publications: [] }],
    };

    if (active) {
      const { error } = await supabase
        .from("client_context")
        .update({ deliverables: next })
        .eq("id", active.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("client_context").insert({
        workspace_id: workspace.id,
        deliverables: next,
        created_by: viewer.user.id,
      });
      if (error) throw new Error(error.message);
    }

    // Toute la surface de l'espace : la page Reporting lit cette déclaration.
    revalidatePath(`/espace/${scope.workspace}`, "layout");
    return { ok: true, message: `${label} ajouté au Reporting.` };
  } catch (error) {
    return fail(error);
  }
}

// --- Exemples validés, faits sourcés ------------------------------------------

const validatedExampleSchema = z.object({
  reseau: z.string().max(60),
  texte: z.string().max(10_000),
});

/**
 * Les publications réellement parues et approuvées. Collées brutes : le
 * modèle en tire un registre, et un résumé ne lui apprendrait rien sur la
 * façon d'écrire de la marque.
 */
export async function saveValidatedExamples(
  scope: Scope,
  input: { examples: unknown },
): Promise<ContextResult> {
  const parsed = z.array(validatedExampleSchema).max(10).safeParse(input.examples);
  if (!parsed.success) return { ok: false, error: "Exemples invalides." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    // Une ligne sans texte n'est pas un exemple : elle n'a rien à apprendre au
    // modèle et compterait pourtant dans la complétude.
    const examples = parsed.data
      .map((example) => ({ reseau: example.reseau.trim(), texte: example.texte.trim() }))
      .filter((example) => example.texte.length > 0);

    await writeActiveFields(workspace.id, viewer.user.id, {
      validated_examples: examples,
    });
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

const sourcedFactSchema = z.object({
  fait: z.string().max(2000),
  source: z.string().max(2000),
  // Date ISO et jamais un texte libre : c'est ce qui permet de comparer à six
  // mois. Une chaîne vide reste acceptée — un fait peut être saisi avant
  // d'être daté, et l'écran le dit « non daté » plutôt que de le refuser.
  verifie_le: z.union([z.iso.date(), z.literal("")]),
});

export async function saveSourcedFacts(
  scope: Scope,
  input: { facts: unknown },
): Promise<ContextResult> {
  const parsed = z.array(sourcedFactSchema).max(50).safeParse(input.facts);
  if (!parsed.success) return { ok: false, error: "Faits invalides." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const facts = parsed.data
      .map((fact) => ({
        fait: fact.fait.trim(),
        source: fact.source.trim(),
        verifie_le: fact.verifie_le,
      }))
      .filter((fact) => fact.fait.length > 0);

    await writeActiveFields(workspace.id, viewer.user.id, { sourced_facts: facts });
    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Pilotage de la génération -------------------------------------------------

const settingsSchema = z.object({
  permanent_instructions: z.string().max(20_000).optional(),
  monthly_instruction: z.string().max(8000).optional(),
  /** `YYYY-MM-01` : le mois que la consigne vise. */
  monthly_instruction_month: z.union([z.iso.date(), z.literal("")]).optional(),
  temporal_context: z.string().max(4000).optional(),
});

/**
 * Le pilotage vit dans `client_generation_settings`, pas dans le brief
 * versionné : une consigne de deux lignes n'a pas à fabriquer une version de
 * brief, et l'historique resterait illisible si elle le faisait.
 *
 * Seuls les champs transmis sont écrits — l'écran sauvegarde un champ au blur,
 * il ne renvoie pas les trois.
 */
export async function saveGenerationSettings(
  scope: Scope,
  input: {
    permanent_instructions?: string;
    monthly_instruction?: string;
    monthly_instruction_month?: string;
    temporal_context?: string;
  },
): Promise<ContextResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Réglage invalide." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const patch: Record<string, unknown> = { updated_by: viewer.user.id };

    if (parsed.data.permanent_instructions !== undefined) {
      patch.permanent_instructions = parsed.data.permanent_instructions.trim() || null;
    }

    if (parsed.data.monthly_instruction !== undefined) {
      const texte = parsed.data.monthly_instruction.trim() || null;
      patch.monthly_instruction = texte;
      /* Le couple, jamais l'un sans l'autre : une consigne sans mois n'a pas
         de fin de vie, et `monthlyInstructionState` la traite en périmée — ce
         qui se lirait comme une consigne ignorée sans raison. */
      patch.monthly_instruction_month = texte
        ? parsed.data.monthly_instruction_month || null
        : null;
    }

    if (parsed.data.temporal_context !== undefined) {
      const texte = parsed.data.temporal_context.trim() || null;
      patch.temporal_context = texte;
      // L'horodatage suit la saisie : c'est lui qui décide des trente jours.
      patch.temporal_context_at = texte ? new Date().toISOString() : null;
    }

    const { error } = await supabase
      .from("client_generation_settings")
      .upsert({ workspace_id: workspace.id, ...patch } as never, {
        onConflict: "workspace_id",
      });
    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/** Le bouton « Effacer » d'une consigne périmée. Aucun cron ne le fait pour nous. */
export async function clearMonthlyInstruction(scope: Scope): Promise<ContextResult> {
  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("client_generation_settings")
      .update({ monthly_instruction: null, monthly_instruction_month: null } as never)
      .eq("workspace_id", workspace.id);
    if (error) throw new Error(error.message);

    revalidate(scope);
    return { ok: true, message: "Consigne du mois effacée." };
  } catch (error) {
    return fail(error);
  }
}

// --- Documents ----------------------------------------------------------------

export type PreparedAssetUpload = { path: string; url: string };

export type PrepareAssetUploadsResult =
  | { ok: true; uploads: PreparedAssetUpload[] }
  | { ok: false; error: string };

/**
 * Premier temps du dépôt : le serveur signe une URL d'envoi par fichier —
 * petite requête, aucun octet de média. Les octets partent ensuite du
 * navigateur droit au bucket : le proxy de Next tronque les corps au-delà de
 * 10 Mo et faisait tomber la page, comme pour les visuels du Planning. Le
 * chemin reste construit ici, depuis l'espace réellement accessible.
 */
export async function prepareAssetUploads(
  scope: Scope,
  input: { files: { name: string; type: string; size: number }[] },
): Promise<PrepareAssetUploadsResult> {
  if (input.files.length === 0) return { ok: false, error: "Aucun fichier." };
  if (input.files.length > 10) return { ok: false, error: "10 fichiers maximum d'un coup." };

  for (const file of input.files) {
    if (file.size > MAX_ASSET_BYTES) {
      return { ok: false, error: `${file.name} : trop lourd (50 Mo maximum).` };
    }
    if (!isAcceptedAsset(file)) {
      return { ok: false, error: `${file.name} : format non accepté (${file.type || "inconnu"}).` };
    }
  }

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const uploads: PreparedAssetUpload[] = [];
    for (const file of input.files) {
      const path = assetPath({ workspaceId: workspace.id, fileName: file.name });
      const { data, error } = await supabase.storage
        .from(ASSETS_BUCKET)
        .createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      uploads.push({ path, url: data.signedUrl });
    }

    return { ok: true, uploads };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Second temps : enregistre les lignes des seuls chemins que le navigateur
 * vient de remplir — et que le serveur avait signés pour cet espace.
 * L'extraction est ensuite déclenchée par le client, en arrière-plan, sur
 * `/api/contexte/extraction`.
 */
export async function registerAssets(
  scope: Scope,
  input: {
    type: string;
    files: { path: string; name: string; mimeType: string; size: number }[];
  },
): Promise<ContextUploadResult> {
  if (!isClientAssetType(input.type)) {
    return { ok: false, error: "Type de document inconnu." };
  }
  if (input.files.length === 0 || input.files.length > 10) {
    return { ok: false, error: "Aucun fichier." };
  }

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const assetIds: string[] = [];
    for (const file of input.files) {
      // On n'enregistre que ce qui a été signé pour cet espace : un chemin
      // forgé vers un autre dossier est écarté sans discussion.
      if (!isOwnedAssetPath(file.path, workspace.id)) continue;

      const { data: row, error: insertError } = await supabase
        .from("client_assets")
        .insert({
          workspace_id: workspace.id,
          name: file.name.slice(0, 300),
          type: input.type,
          storage_path: file.path,
          mime_type: file.mimeType || null,
          size_bytes: file.size,
        })
        .select("id")
        .single();
      if (insertError) {
        // Un échec au troisième fichier garde les deux premiers.
        if (assetIds.length === 0) throw new Error(insertError.message);
        break;
      }
      assetIds.push(row.id);
    }

    if (assetIds.length === 0) {
      return { ok: false, error: "Aucun fichier enregistré." };
    }

    revalidate(scope);
    return {
      ok: true,
      assetIds,
      message: assetIds.length === 1 ? "Document déposé." : `${assetIds.length} documents déposés.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleAssetInclude(
  scope: Scope,
  input: { assetId: string; include: boolean },
): Promise<ContextResult> {
  const parsed = z.object({ assetId: z.uuid(), include: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Document inconnu." };

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("client_assets")
      .update({ include_in_context: parsed.data.include })
      .eq("id", parsed.data.assetId)
      .eq("workspace_id", workspace.id);
    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

/** Résumé retouché à la main : il ne sera plus écrasé par une réanalyse. */
export async function updateAssetSummary(
  scope: Scope,
  input: { assetId: string; summary: string },
): Promise<ContextResult> {
  const parsed = z
    .object({ assetId: z.uuid(), summary: z.string().max(8000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Résumé invalide." };

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const { error } = await supabase
      .from("client_assets")
      .update({
        summary: parsed.data.summary.trim() || null,
        summary_edited_manually: true,
        extraction_status: "done",
        extraction_error: null,
      })
      .eq("id", parsed.data.assetId)
      .eq("workspace_id", workspace.id);
    if (error) throw new Error(error.message);

    revalidate(scope);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAsset(
  scope: Scope,
  input: { assetId: string },
): Promise<ContextResult> {
  const parsed = z.object({ assetId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Document inconnu." };

  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const { data: asset } = await supabase
      .from("client_assets")
      .select("storage_path")
      .eq("id", parsed.data.assetId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    const { error } = await supabase
      .from("client_assets")
      .delete()
      .eq("id", parsed.data.assetId)
      .eq("workspace_id", workspace.id);
    if (error) throw new Error(error.message);

    if (asset?.storage_path && isOwnedAssetPath(asset.storage_path, workspace.id)) {
      await supabase.storage.from(ASSETS_BUCKET).remove([asset.storage_path]);
    }

    revalidate(scope);
    return { ok: true, message: "Document supprimé." };
  } catch (error) {
    return fail(error);
  }
}

// --- Régénération et versionnage ----------------------------------------------

/**
 * Étape 1 du bouton « Régénérer depuis les documents » : la proposition et
 * son diff, sans rien écrire. Le brief actuel n'est jamais touché ici.
 */
export async function proposeRegeneration(scope: Scope): Promise<ContextProposalResult> {
  try {
    const { workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const [{ data: assets }, current] = await Promise.all([
      supabase
        .from("client_assets")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("include_in_context", true),
      getActiveRow(workspace.id),
    ]);

    const resumes = renderAssetSummaries(
      (assets ?? []) as unknown as Parameters<typeof renderAssetSummaries>[0],
    );
    if (!resumes) {
      return {
        ok: false,
        error: "Aucun document coché n'a de résumé : dépose ou analyse d'abord des documents.",
      };
    }

    const outcome = await proposeConsolidation({ resumes, currentBrief: current });
    if (!outcome.ok) return outcome;

    return {
      ok: true,
      proposal: outcome.proposal,
      diff: buildContextDiff(current, outcome.proposal),
    };
  } catch (error) {
    return fail(error);
  }
}

const proposalSchema = z.object({
  main_context: z.string().max(20_000),
  audience: z.string().max(20_000),
  tone_of_voice: z.string().max(20_000),
  pillars: z.array(pillarSchema).max(30),
  restrictions: z.string().max(20_000),
  platforms: z.record(z.string().max(50), z.string().max(4000)),
});

/**
 * Étape 2 : la validation du diff crée une version + 1 active à partir des
 * seuls champs acceptés, et désactive l'ancienne. Jamais d'écrasement.
 */
export async function applyRegeneration(
  scope: Scope,
  input: { proposal: unknown; acceptedKeys: string[] },
): Promise<ContextResult> {
  const parsedProposal = proposalSchema.safeParse(input.proposal);
  if (!parsedProposal.success) return { ok: false, error: "Proposition invalide." };

  const acceptedKeys = input.acceptedKeys.filter(
    (key): key is ContextFieldKey => key in FIELD_LABELS,
  );
  if (acceptedKeys.length === 0) {
    return { ok: false, error: "Aucun champ accepté : rien à appliquer." };
  }

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const current = await getActiveRow(workspace.id);
    const merged = mergeProposal(current, parsedProposal.data, acceptedKeys);

    const result = await writeNewVersion({
      workspaceId: workspace.id,
      current,
      content: merged,
      // Les livrables suivent la version sans être touchés : la consolidation
      // ne les propose pas, elle ne doit pas non plus les faire disparaître.
      deliverables: normalizeDeliverables(current?.deliverables),
      human: humanFields(current),
      createdBy: viewer.user.id,
    });
    if (!result.ok) return result;

    revalidate(scope);
    return { ok: true, message: `Version ${result.version} activée.` };
  } catch (error) {
    return fail(error);
  }
}

/** Restaure une version passée en la copiant dans une nouvelle version active. */
export async function restoreVersion(
  scope: Scope,
  input: { version: number },
): Promise<ContextResult> {
  const parsed = z.object({ version: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Version inconnue." };

  try {
    const { viewer, workspace } = await guardOwner(scope);
    const supabase = await createClient();

    const [{ data: source }, current] = await Promise.all([
      supabase
        .from("client_context")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("version", parsed.data.version)
        .maybeSingle(),
      getActiveRow(workspace.id),
    ]);
    const sourceRow = source as unknown as ClientContext | null;
    if (!sourceRow) return { ok: false, error: "Version inconnue." };
    if (current && current.version === sourceRow.version) {
      return { ok: false, error: "Cette version est déjà active." };
    }

    const result = await writeNewVersion({
      workspaceId: workspace.id,
      current,
      content: {
        main_context: sourceRow.main_context ?? "",
        audience: sourceRow.audience ?? "",
        tone_of_voice: sourceRow.tone_of_voice ?? "",
        pillars: sourceRow.pillars,
        restrictions: sourceRow.restrictions ?? "",
        platforms: sourceRow.platforms,
      },
      // Restaurer une version, c'est restaurer son instantané entier.
      deliverables: normalizeDeliverables(sourceRow.deliverables),
      human: humanFields(sourceRow),
      createdBy: viewer.user.id,
    });
    if (!result.ok) return result;

    revalidate(scope);
    return {
      ok: true,
      message: `Version ${sourceRow.version} restaurée en version ${result.version}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * La bascule de version : désactive l'ancienne puis insère la nouvelle. Si
 * l'insertion échoue, l'ancienne est réactivée — l'index partiel de 0032
 * garantit de toute façon qu'il n'y aura jamais deux versions actives.
 */
async function writeNewVersion(input: {
  workspaceId: string;
  current: ClientContext | null;
  content: ContextProposal;
  deliverables: ContextDeliverables;
  /** Ce que seul un humain écrit : reporté tel quel d'une version à l'autre. */
  human: {
    validated_examples: ValidatedExample[];
    client_feedback: string | null;
    sourced_facts: SourcedFact[];
  };
  createdBy: string;
}): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const nextVersion = (input.current?.version ?? 0) + 1;

  if (input.current) {
    const { error } = await supabase
      .from("client_context")
      .update({ is_active: false })
      .eq("id", input.current.id);
    if (error) return { ok: false, error: error.message };
  }

  const { error: insertError } = await supabase.from("client_context").insert({
    workspace_id: input.workspaceId,
    version: nextVersion,
    is_active: true,
    main_context: input.content.main_context.trim() || null,
    audience: input.content.audience.trim() || null,
    tone_of_voice: input.content.tone_of_voice.trim() || null,
    pillars: input.content.pillars,
    restrictions: input.content.restrictions.trim() || null,
    platforms: input.content.platforms,
    deliverables: input.deliverables,
    /* Les saisies humaines suivent la version sans être touchées, exactement
       comme les livrables : la consolidation ne les propose pas, elle ne doit
       pas non plus les faire disparaître au changement de version. */
    validated_examples: input.human.validated_examples,
    client_feedback: input.human.client_feedback,
    sourced_facts: input.human.sourced_facts,
    created_by: input.createdBy,
  } as never);

  if (insertError) {
    if (input.current) {
      await supabase
        .from("client_context")
        .update({ is_active: true })
        .eq("id", input.current.id);
    }
    return { ok: false, error: insertError.message };
  }

  return { ok: true, version: nextVersion };
}

// --- Pont vers le planning ------------------------------------------------------

/**
 * Validation du wording d'une publication : passe l'étape à `validated` et
 * pousse l'accroche dans `wording_history`. C'est à ce moment-là, jamais à la
 * génération, que l'historique s'enrichit.
 */
export async function validateSubjectWording(
  scope: Scope,
  input: { subjectId: string },
): Promise<ContextResult> {
  const parsed = z.object({ subjectId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Publication inconnue." };

  try {
    await guardOwner(scope);
    const outcome = await validateWording({ subjectId: parsed.data.subjectId });
    if (!outcome.ok) return outcome;

    revalidate(scope);
    revalidatePath(`/espace/${scope.workspace}/planning`);
    return { ok: true, message: "Wording validé." };
  } catch (error) {
    return fail(error);
  }
}
