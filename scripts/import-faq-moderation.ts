/**
 * Reprend les FAQ modération des boards Monday dans la base.
 *
 *   pnpm import:faq-moderation            importe ou met à jour
 *   pnpm import:faq-moderation --dry-run  montre sans écrire
 *
 * Les données vivent dans `scripts/data/faq-moderation-monday.json` — figées,
 * relisibles et corrigeables sans toucher au script, comme l'antériorité des
 * abonnés. Idempotent par (client, titre) : rejouer ne duplique rien, et une
 * réponse retouchée dans le fichier écrase la précédente.
 *
 * Les entrées s'écrivent **sans vecteur** : l'indexation sémantique passe au
 * relevé horaire (`reindexFaqSearch`), sur une machine qui sait charger le
 * modèle. Une entrée sans réponse est importée inactive — un titre sans
 * élément de langage n'a rien à proposer à la génération.
 *
 * Transport REST (service role) et non URI Postgres : ce script doit pouvoir
 * tourner d'un poste local dont `SUPABASE_DB_URL` n'est pas valable.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });

type ImportEntry = {
  client: string;
  titre: string;
  theme: string | null;
  question: string | null;
  reponse: string | null;
  reponse_tiktok: string | null;
};

const DRY_RUN = process.argv.includes("--dry-run");

/** « I-WAY » et « i-way-2 » désignent le même client : on compare à plat. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Variables absentes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const file = JSON.parse(
    readFileSync(
      path.join(__dirname, "data", "faq-moderation-monday.json"),
      "utf8",
    ),
  ) as { entrees: ImportEntry[] };

  const { data: clients, error: clientsError } = await supabase
    .from("moderation_clients")
    .select("id, slug, name");
  if (clientsError) {
    console.error(`Clients de modération illisibles : ${clientsError.message}`);
    process.exit(1);
  }

  const clientRows = (clients ?? []) as { id: string; slug: string; name: string }[];
  const clientOf = (label: string) =>
    clientRows.find(
      (row) =>
        normalize(row.slug).startsWith(normalize(label)) ||
        normalize(row.name).startsWith(normalize(label)),
    ) ?? null;

  // Un client introuvable fait échouer le passage entier : une perte
  // silencieuse ne doit pas ressembler à un succès (leçon import:followers).
  const wanted = [...new Set(file.entrees.map((entry) => entry.client))];
  for (const label of wanted) {
    if (!clientOf(label)) {
      console.error(
        `Client de modération introuvable pour « ${label} ». Connus : ${clientRows
          .map((row) => `${row.name} (${row.slug})`)
          .join(", ")}.`,
      );
      process.exit(1);
    }
  }

  let created = 0;
  let updated = 0;

  for (const entry of file.entrees) {
    const client = clientOf(entry.client)!;

    // La catégorie du board (« THÈME ») — créée au premier besoin.
    let categoryId: string | null = null;
    if (entry.theme) {
      const { data: existingCategory } = await supabase
        .from("faq_categories")
        .select("id")
        .eq("client_id", client.id)
        .eq("name", entry.theme)
        .maybeSingle();
      if (existingCategory) {
        categoryId = (existingCategory as { id: string }).id;
      } else if (!DRY_RUN) {
        const { data: createdCategory, error: categoryError } = await supabase
          .from("faq_categories")
          .insert({ client_id: client.id, name: entry.theme })
          .select("id")
          .single();
        if (categoryError) {
          console.error(`Catégorie « ${entry.theme} » : ${categoryError.message}`);
          process.exit(1);
        }
        categoryId = (createdCategory as { id: string }).id;
      }
    }

    const row = {
      client_id: client.id,
      title: entry.titre,
      question_canonical: entry.question ?? entry.titre,
      variants: [] as string[],
      answer_fr: entry.reponse,
      answer_tiktok: entry.reponse_tiktok,
      category_id: categoryId,
      // Sans réponse, rien à proposer : l'entrée attend d'être complétée.
      active: Boolean(entry.reponse),
      embedding_source: null,
    };

    const { data: existing } = await supabase
      .from("faq_entries")
      .select("id")
      .eq("client_id", client.id)
      .eq("title", entry.titre)
      .is("deleted_at", null)
      .maybeSingle();

    if (DRY_RUN) {
      console.log(
        `${existing ? "≈ mise à jour" : "+ création"} · ${client.name} · ${entry.titre}`,
      );
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from("faq_entries")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", (existing as { id: string }).id);
      if (error) {
        console.error(`Mise à jour « ${entry.titre} » : ${error.message}`);
        process.exit(1);
      }
      updated += 1;
    } else {
      const { error } = await supabase.from("faq_entries").insert(row);
      if (error) {
        console.error(`Création « ${entry.titre} » : ${error.message}`);
        process.exit(1);
      }
      created += 1;
    }
  }

  console.log(
    DRY_RUN
      ? `Dry-run : ${file.entrees.length} entrées prêtes.`
      : `${created} créées, ${updated} mises à jour — vecteurs au prochain relevé horaire.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
