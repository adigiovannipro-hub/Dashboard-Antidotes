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

// --- Brief : édition en place -------------------------------------------------

const pillarSchema = z.object({
  nom: z.string().max(200),
  description: z.string().max(4000),
  formats: z.array(z.string().max(100)).max(20),
  angles: z.array(z.string().max(300)).max(40),
  frequence: z.string().max(200),
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
  "tiktok",
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
  positioning: z.string().max(20_000),
  audience: z.string().max(20_000),
  tone_of_voice: z.string().max(20_000),
  pillars: z.array(pillarSchema).max(30),
  mentions: z.string().max(20_000),
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
        positioning: sourceRow.positioning ?? "",
        audience: sourceRow.audience ?? "",
        tone_of_voice: sourceRow.tone_of_voice ?? "",
        pillars: sourceRow.pillars,
        mentions: sourceRow.mentions ?? "",
        restrictions: sourceRow.restrictions ?? "",
        platforms: sourceRow.platforms,
      },
      // Restaurer une version, c'est restaurer son instantané entier.
      deliverables: normalizeDeliverables(sourceRow.deliverables),
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
    positioning: input.content.positioning.trim() || null,
    audience: input.content.audience.trim() || null,
    tone_of_voice: input.content.tone_of_voice.trim() || null,
    pillars: input.content.pillars,
    mentions: input.content.mentions.trim() || null,
    restrictions: input.content.restrictions.trim() || null,
    platforms: input.content.platforms,
    deliverables: input.deliverables,
    created_by: input.createdBy,
  });

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
