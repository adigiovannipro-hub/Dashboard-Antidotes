"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { refreshProspectScore } from "@/lib/antidotes/score-sync";
import {
  isManualInteractionType,
  isProspectStatus,
  isSeniority,
  type ProspectStatus,
} from "@/lib/antidotes/types";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions du pipeline Antidotes.
 *
 * Réservées à l'owner de l'organisation : le pôle est un outil interne, un
 * client ne le voit jamais — d'où des messages d'erreur neutres qui ne
 * confirment pas son existence. La RLS de 20260907b reste l'autorité ; ces
 * gardes rendent l'erreur lisible, elles ne protègent pas les données.
 *
 * Chaque écriture sur un prospect ou ses contacts se termine par le recalcul
 * du score (`score-sync.ts`) : la formule vit dans le code, la base ne porte
 * que le résultat.
 */

export type AntidotesResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

const PIPELINE_PATH = "/antidotes/outbound/pipeline";
const OK: AntidotesResult = { ok: true };

async function guardOwner(): Promise<{ orgId: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const orgId = viewer.ownedOrgIds[0];
  if (!viewer.isOwner || !orgId) throw new Error("Action indisponible.");
  return { orgId };
}

function fail(error: unknown): AntidotesResult {
  return { ok: false, error: (error as Error).message };
}

function firstIssue(error: z.ZodError, fallback: string): AntidotesResult {
  return { ok: false, error: error.issues[0]?.message ?? fallback };
}

/** Une chaîne de formulaire : vide → `null`, sinon rognée et bornée. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au plus.`)
    .transform((value) => (value.length > 0 ? value : null));

/**
 * Un site saisi sans schéma — « lunettes-bondet.fr » — reçoit `https://` :
 * c'est ce qu'on tape, et c'est ce que le lien du panneau doit ouvrir.
 */
function normalizeWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Adresse du site invalide.");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Adresse du site invalide.");
  }
}

const formValue = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "");

// --- Création manuelle ---------------------------------------------------------

const createProspectInput = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Le nom de la société est requis.")
    .max(200, "200 caractères au plus."),
  website: optionalText(300),
  city: optionalText(120),
  sector: optionalText(120),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value.length > 0 ? value : null))
    .refine((value) => value === null || /^[A-Z]{2}$/.test(value), {
      message: "Le pays est un code à deux lettres (FR, BE…).",
    }),
});

export async function createProspect(
  _previous: AntidotesResult | null,
  formData: FormData,
): Promise<AntidotesResult> {
  const parsed = createProspectInput.safeParse({
    companyName: formValue(formData, "companyName"),
    website: formValue(formData, "website"),
    city: formValue(formData, "city"),
    sector: formValue(formData, "sector"),
    country: formValue(formData, "country"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  try {
    const { orgId } = await guardOwner();
    const website = normalizeWebsite(parsed.data.website);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("antidotes_prospects")
      .insert({
        org_id: orgId,
        source: "manual",
        company_name: parsed.data.companyName,
        website,
        city: parsed.data.city,
        sector: parsed.data.sector,
        country: parsed.data.country,
        status: "to_qualify",
        score: 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const created = data as unknown as { id: string };
    await refreshProspectScore(supabase, { orgId, prospectId: created.id });

    revalidatePath(PIPELINE_PATH);
    return { ok: true, message: "Prospect ajouté.", id: created.id };
  } catch (error) {
    return fail(error);
  }
}

// --- Déplacement dans le pipeline ---------------------------------------------

const moveInput = z.object({
  prospectIds: z.array(z.uuid()).min(1, "Aucun prospect sélectionné.").max(500),
  status: z.string().refine(isProspectStatus, { message: "Statut inconnu." }),
});

/**
 * Change la colonne d'un ou plusieurs prospects — le glisser-déposer du
 * kanban comme l'action de masse du tableau passent ici.
 */
export async function moveProspects(input: {
  prospectIds: string[];
  status: ProspectStatus;
}): Promise<AntidotesResult> {
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, "Déplacement invalide.");

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("antidotes_prospects")
      .update({ status: parsed.data.status as ProspectStatus })
      .eq("org_id", orgId)
      .in("id", parsed.data.prospectIds)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 0) throw new Error("Prospect introuvable.");

    revalidatePath(PIPELINE_PATH);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Notes ---------------------------------------------------------------------

const notesInput = z.object({
  prospectId: z.uuid(),
  notes: z.string().max(5000, "5 000 caractères au plus."),
});

export async function updateProspectNotes(input: {
  prospectId: string;
  notes: string;
}): Promise<AntidotesResult> {
  const parsed = notesInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, "Note invalide.");

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();

    const trimmed = parsed.data.notes.trim();
    const { data, error } = await supabase
      .from("antidotes_prospects")
      .update({ notes: trimmed.length > 0 ? trimmed : null })
      .eq("org_id", orgId)
      .eq("id", parsed.data.prospectId)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 0) throw new Error("Prospect introuvable.");

    revalidatePath(PIPELINE_PATH);
    return OK;
  } catch (error) {
    return fail(error);
  }
}

// --- Contacts ------------------------------------------------------------------

/* Les boîtes génériques ne convertissent pas et abîment le domaine d'envoi.
   La base refuse déjà `contact@` et `info@` ; l'écran élargit la liste et
   explique le refus au lieu de rendre une violation de contrainte. */
const GENERIC_MAILBOX = /^(contact|info|hello|bonjour|support|sales|commercial|admin|noreply|no-reply)@/i;

const addContactInput = z.object({
  prospectId: z.uuid(),
  firstName: optionalText(80),
  lastName: optionalText(80),
  role: optionalText(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value.length > 0 ? value : null))
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: "Adresse email invalide.",
    })
    .refine((value) => value === null || !GENERIC_MAILBOX.test(value), {
      message: "Une boîte générique (contact@, info@…) ne convertit pas : viser une personne.",
    }),
  linkedinUrl: optionalText(300),
  phone: optionalText(40),
  seniority: z.string().refine(isSeniority, { message: "Niveau inconnu." }),
  isPrimary: z.boolean(),
});

export async function addContact(
  _previous: AntidotesResult | null,
  formData: FormData,
): Promise<AntidotesResult> {
  const parsed = addContactInput.safeParse({
    prospectId: formValue(formData, "prospectId"),
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    role: formValue(formData, "role"),
    email: formValue(formData, "email"),
    linkedinUrl: formValue(formData, "linkedinUrl"),
    phone: formValue(formData, "phone"),
    seniority: formValue(formData, "seniority") || "other",
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  const hasIdentity =
    parsed.data.firstName || parsed.data.lastName || parsed.data.email || parsed.data.linkedinUrl;
  if (!hasIdentity) {
    return { ok: false, error: "Un nom, une adresse ou un profil LinkedIn au moins." };
  }

  try {
    const { orgId } = await guardOwner();
    const linkedinUrl = normalizeWebsite(parsed.data.linkedinUrl);
    const supabase = await createClient();

    // Le premier contact d'une société est principal d'office : « à qui
    // écrit-on ? » doit avoir une réponse dès qu'il y a quelqu'un.
    const { data: existing, error: readError } = await supabase
      .from("antidotes_contacts")
      .select("id, is_primary")
      .eq("org_id", orgId)
      .eq("prospect_id", parsed.data.prospectId)
      .limit(100);
    if (readError) throw new Error(readError.message);
    const rows = (existing ?? []) as unknown as { id: string; is_primary: boolean }[];
    const isPrimary = parsed.data.isPrimary || !rows.some((row) => row.is_primary);

    if (isPrimary && rows.some((row) => row.is_primary)) {
      // Un seul principal par société : l'index unique refuserait le second.
      const { error } = await supabase
        .from("antidotes_contacts")
        .update({ is_primary: false })
        .eq("org_id", orgId)
        .eq("prospect_id", parsed.data.prospectId)
        .eq("is_primary", true);
      if (error) throw new Error(error.message);
    }

    const { error } = await supabase.from("antidotes_contacts").insert({
      org_id: orgId,
      prospect_id: parsed.data.prospectId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      role: parsed.data.role,
      email: parsed.data.email,
      email_status: "unknown",
      linkedin_url: linkedinUrl,
      phone: parsed.data.phone,
      is_primary: isPrimary,
      seniority: parsed.data.seniority,
      discovery_source: "manual",
    });
    if (error) throw new Error(error.message);

    await refreshProspectScore(supabase, { orgId, prospectId: parsed.data.prospectId });

    revalidatePath(PIPELINE_PATH);
    return { ok: true, message: "Contact ajouté." };
  } catch (error) {
    return fail(error);
  }
}

// --- Journal -------------------------------------------------------------------

const addInteractionInput = z.object({
  prospectId: z.uuid(),
  contactId: z
    .string()
    .transform((value) => (value.length > 0 ? value : null))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: "Contact inconnu.",
    }),
  type: z.string().refine(isManualInteractionType, { message: "Type inconnu." }),
  text: z
    .string()
    .trim()
    .min(1, "Le texte ne peut pas être vide.")
    .max(5000, "5 000 caractères au plus."),
});

/**
 * Une note ou un appel, saisi depuis le panneau. Les autres types du journal
 * — envoi, ouverture, réponse — sont écrits par le système, jamais ici.
 */
export async function addInteraction(
  _previous: AntidotesResult | null,
  formData: FormData,
): Promise<AntidotesResult> {
  const parsed = addInteractionInput.safeParse({
    prospectId: formValue(formData, "prospectId"),
    contactId: formValue(formData, "contactId"),
    type: formValue(formData, "type"),
    text: formValue(formData, "text"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Saisie invalide.");

  try {
    const { orgId } = await guardOwner();
    const supabase = await createClient();

    const { error } = await supabase.from("antidotes_interactions").insert({
      org_id: orgId,
      prospect_id: parsed.data.prospectId,
      contact_id: parsed.data.contactId,
      type: parsed.data.type,
      payload: { text: parsed.data.text },
    });
    if (error) throw new Error(error.message);

    revalidatePath(PIPELINE_PATH);
    return { ok: true, message: parsed.data.type === "call" ? "Appel noté." : "Note ajoutée." };
  } catch (error) {
    return fail(error);
  }
}
