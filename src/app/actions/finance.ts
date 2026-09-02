"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getFinanceContext } from "@/lib/finance/access";
import { slugifyCategoryName } from "@/lib/finance/categories";
import { merchantKey } from "@/lib/finance/merchant-logo";
import type { FinanceCategory, FinanceRetrievalSource } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions de l'écran Finance.
 *
 * Même contrat que les autres modules : signature `useActionState`
 * (état précédent, FormData), entrées validées par `safeParse` avant de
 * toucher quoi que ce soit. Une action reçoit ce que le réseau lui apporte,
 * pas ce que le composant croit lui avoir envoyé.
 */

export type FinanceActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const FINANCE_PATH = "/entreprise/finance";

/* Il n'y a plus d'action « Synchroniser maintenant », et son retrait est un
   correctif : Airwallex refuse les adresses IP de Vercel. Partant de
   l'hébergeur, cette action se faisait renvoyer un « 403 Forbidden » à tous
   les coups, et son seul effet observable était d'inscrire trois échecs au
   journal. La synchronisation part d'une machine GitHub — voir
   `.github/workflows/airwallex-sync.yml` — toutes les heures. Le pipeline
   lui-même, `runFinanceSync`, n'a pas bougé d'une ligne. */

const recategorizeAction = z.object({
  transactionId: z.uuid(),
  // Champ vide : retirer la catégorie. La distinction vide / absent importe —
  // un formulaire qui n'envoie pas le champ est incomplet, pas un retrait.
  categoryId: z
    .uuid()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

/** Recatégorise une dépense — le geste d'entretien du tableau. */
export async function recategorizeTransaction(
  _previous: FinanceActionResult | null,
  formData: FormData,
): Promise<FinanceActionResult> {
  const parsed = recategorizeAction.safeParse({
    transactionId: formData.get("transactionId"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  const outcome = await assignCategory({
    orgId: context.orgId,
    transactionId: parsed.data.transactionId,
    categoryId: parsed.data.categoryId,
  });
  if (!outcome.ok) return outcome;

  revalidatePath(FINANCE_PATH);
  return outcome;
}

/**
 * Le cœur du rangement, partagé par les deux gestes — recatégoriser, et créer
 * une catégorie en rangeant dans la foulée. Deux implémentations divergeraient
 * au premier correctif.
 *
 * Client de session, pas de service : la RLS autorise précisément ce geste
 * aux owners — aucune raison de la contourner.
 */
async function assignCategory(input: {
  orgId: string;
  transactionId: string;
  categoryId: string | null;
}): Promise<FinanceActionResult> {
  const supabase = await createClient();

  /* Le marchand se lit avant d'écrire : c'est lui qui porte la mémoire. */
  const { data: existing, error: readError } = await supabase
    .from("finance_transactions")
    .select("merchant, merchant_raw")
    .eq("id", input.transactionId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (readError || !existing) {
    return { ok: false, error: "Dépense introuvable." };
  }

  const { error } = await supabase
    .from("finance_transactions")
    .update({ category_id: input.categoryId })
    .eq("id", input.transactionId)
    .eq("org_id", input.orgId);

  if (error) return { ok: false, error: `Recatégorisation refusée : ${error.message}` };

  /* La mémoire du geste : une règle par marchand, pour que le prélèvement du
     mois prochain arrive déjà rangé — c'est `resolveCategory` qui la lit à
     l'affichage, et `applyCategoryRules` qui la matérialise au fil des
     synchronisations. Ranger = poser la règle, retirer = l'effacer : deux
     vérités pour un même marchand se contrediraient d'une ligne à l'autre.
     Meilleur effort assumé — la ligne, elle, est déjà rangée. */
  const merchant = existing as { merchant: string | null; merchant_raw: string | null };
  const matcher = (merchant.merchant ?? merchant.merchant_raw)?.trim() ?? "";
  let remembered = false;

  if (matcher !== "") {
    if (input.categoryId) {
      const { error: ruleError } = await supabase.from("finance_category_rules").upsert(
        {
          org_id: input.orgId,
          matcher,
          category_id: input.categoryId,
        } as never,
        { onConflict: "org_id,matcher" },
      );
      remembered = !ruleError;
    } else {
      const { error: ruleError } = await supabase
        .from("finance_category_rules")
        .delete()
        .eq("org_id", input.orgId)
        .eq("matcher", matcher);
      remembered = !ruleError;
    }
  }

  return {
    ok: true,
    message: remembered
      ? input.categoryId
        ? `Catégorie mise à jour — « ${matcher} » sera rangé ainsi désormais.`
        : `Catégorie retirée — « ${matcher} » ne sera plus rangé automatiquement.`
      : "Catégorie mise à jour.",
  };
}

const createCategoryAction = z.object({
  transactionId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Le nom est vide.")
    .max(40, "Quarante caractères au plus."),
});

/**
 * Crée une catégorie personnalisée **et range la dépense dedans**, d'un seul
 * geste — le besoin naît toujours devant une ligne : « ce prélèvement est un
 * Salaire, et Salaire n'existe pas encore ».
 *
 * L'identité est le slug (nom normalisé) : si la catégorie existe déjà sous
 * une autre écriture — « Matériel » contre « materiel » — on range dans
 * l'existante au lieu de créer un doublon qui scinderait le camembert en deux
 * parts du même sens.
 */
export async function createCategoryAndAssign(
  _previous: FinanceActionResult | null,
  formData: FormData,
): Promise<FinanceActionResult> {
  const parsed = createCategoryAction.safeParse({
    transactionId: formData.get("transactionId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Requête incomplète.",
    };
  }

  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  const slug = slugifyCategoryName(parsed.data.name);
  if (slug === "") return { ok: false, error: "Ce nom ne contient aucune lettre." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("finance_categories")
    .select("*")
    .eq("org_id", context.orgId)
    .eq("slug", slug)
    .maybeSingle();

  let category = existing as unknown as FinanceCategory | null;
  let created = false;

  if (!category) {
    /* En queue de liste : les positions du plan par défaut restent devant,
       les personnalisées se départagent par le nom. */
    const { data: inserted, error: insertError } = await supabase
      .from("finance_categories")
      .insert({
        org_id: context.orgId,
        name: parsed.data.name,
        slug,
        position: 100,
      } as never)
      .select("*")
      .single();
    if (insertError || !inserted) {
      return {
        ok: false,
        error: `Création refusée : ${insertError?.message ?? "inconnue"}`,
      };
    }
    category = inserted as unknown as FinanceCategory;
    created = true;
  }

  const outcome = await assignCategory({
    orgId: context.orgId,
    transactionId: parsed.data.transactionId,
    categoryId: category.id,
  });
  if (!outcome.ok) return outcome;

  revalidatePath(FINANCE_PATH);
  return {
    ok: true,
    message: created
      ? `Catégorie « ${category.name} » créée — ${outcome.message.charAt(0).toLowerCase()}${outcome.message.slice(1)}`
      : `« ${category.name} » existait déjà — ${outcome.message.charAt(0).toLowerCase()}${outcome.message.slice(1)}`,
  };
}

const retrievalAction = z.object({
  transactionId: z.uuid(),
  // Champ vide : retirer le lien — la fiche du marchand disparaît.
  sourceLink: z
    .string()
    .trim()
    .max(2000, "Lien trop long.")
    .refine(
      (value) => value === "" || /^https?:\/\/\S+$/i.test(value),
      "Le lien doit commencer par http:// ou https://.",
    )
    .transform((value) => (value === "" ? null : value)),
});

/**
 * Pose — ou retire — le lien où les factures d'un marchand se récupèrent.
 *
 * Le marchand se lit depuis la dépense, jamais depuis le formulaire : la fiche
 * est celle du marchand de la ligne, et une clé fabriquée côté navigateur ne
 * doit pas pouvoir viser une autre fiche. Un lien **nouveau** remet la fiche
 * en attente, même si le mois avait déjà sa facture — la page a changé, le
 * passage repasse ; le même lien recollé ne touche à rien.
 *
 * Client de session : la RLS réserve précisément ce geste à l'owner.
 */
export async function setRetrievalSource(
  _previous: FinanceActionResult | null,
  formData: FormData,
): Promise<FinanceActionResult> {
  /* « Retirer » est un second bouton du même formulaire : le champ garde
     son lien, c'est le bouton qui dit qu'on l'efface. */
  const removing = formData.get("remove") === "1";
  const parsed = retrievalAction.safeParse({
    transactionId: formData.get("transactionId"),
    sourceLink: removing ? "" : formData.get("sourceLink"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Requête incomplète.",
    };
  }

  const context = await getFinanceContext();
  if (!context?.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  const { data: transaction, error: readError } = await supabase
    .from("finance_transactions")
    .select("merchant, merchant_raw")
    .eq("id", parsed.data.transactionId)
    .eq("org_id", context.orgId)
    .maybeSingle();
  if (readError || !transaction) return { ok: false, error: "Dépense introuvable." };

  const merchant = transaction as { merchant: string | null; merchant_raw: string | null };
  const label = (merchant.merchant ?? merchant.merchant_raw)?.trim() ?? "";
  const key = merchantKey(label);
  if (key === "") return { ok: false, error: "Cette dépense n'a pas de marchand identifiable." };

  const link = parsed.data.sourceLink;

  if (link === null) {
    const { error } = await supabase
      .from("finance_retrieval_sources")
      .delete()
      .eq("org_id", context.orgId)
      .eq("merchant_key", key);
    if (error) return { ok: false, error: `Retrait refusé : ${error.message}` };

    revalidatePath(FINANCE_PATH);
    return { ok: true, message: `Lien retiré — « ${label} » ne sera plus récupéré.` };
  }

  const { data: existing } = await supabase
    .from("finance_retrieval_sources")
    .select("source_link")
    .eq("org_id", context.orgId)
    .eq("merchant_key", key)
    .maybeSingle();
  if ((existing as Pick<FinanceRetrievalSource, "source_link"> | null)?.source_link === link) {
    return { ok: true, message: "Lien inchangé." };
  }

  const { error } = await supabase.from("finance_retrieval_sources").upsert(
    {
      org_id: context.orgId,
      merchant_key: key,
      merchant_label: label,
      source_link: link,
      retrieval_status: "pending",
      auto_retrieved_at: null,
      last_error: null,
    } as never,
    { onConflict: "org_id,merchant_key" },
  );
  if (error) return { ok: false, error: `Enregistrement refusé : ${error.message}` };

  revalidatePath(FINANCE_PATH);
  return {
    ok: true,
    message: `Lien enregistré — les factures « ${label} » seront récupérées chaque mois.`,
  };
}
