/**
 * Reprise de l'antériorité des abonnés, relevée sur les tableaux Looker.
 *
 *   pnpm import:followers            écrit
 *   pnpm import:followers --dry-run  montre ce qui serait écrit, sans rien poser
 *
 * Les courbes d'abonnés d'Antidotes démarrent au premier relevé du connecteur,
 * c'est-à-dire au branchement. Toute l'histoire d'avant vit dans Looker, et
 * elle ne se reconstitue pas : Meta ne rend pas l'historique d'abonnés, il ne
 * rend que le compte du jour. Sans cette reprise, chaque client repart de zéro
 * le jour de sa bascule — et on perd un an de courbe pour toujours.
 *
 * Les chiffres sont dans `scripts/data/followers-anteriorite.json`, relus et
 * corrigeables sans toucher à ce fichier. Ils entrent avec `source = 'looker'`
 * et non `'api'` : l'origine d'un point reste lisible pour toujours, et une
 * reprise à la main ne se confond jamais avec une mesure.
 *
 * Idempotent : la clé primaire `(data_source_id, platform, date)` fait que
 * rejouer met à jour au lieu de dupliquer. Et parce que la source de données
 * réutilisée est **celle du connecteur** quand elle existe, un relevé d'API
 * postérieur écrase naturellement une reprise du même jour — la mesure gagne
 * toujours sur la recopie.
 */
import { readFileSync } from "node:fs";

import dotenv from "dotenv";
import { Client } from "pg";

import { findWorkspaceByLabel } from "../src/lib/workspaces/lookup";

dotenv.config({ path: ".env.local", quiet: true });

type Serie = {
  workspace: string;
  platform: "instagram" | "facebook" | "tiktok";
  libelle: string;
  points: [string, number][];
};

/** Le connecteur qui alimentera cette plateforme quand il existera. */
const PROVIDER: Record<Serie["platform"], string> = {
  instagram: "meta_organic",
  facebook: "meta_organic",
  tiktok: "tiktok_organic",
};

/** Le compte affecté à l'espace pour cette plateforme, dans les Connexions. */
const KIND: Record<Serie["platform"], string> = {
  instagram: "instagram",
  facebook: "facebook_page",
  tiktok: "tiktok",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL manquante — la renseigner dans .env.local.");
    process.exit(1);
  }

  const fichier = JSON.parse(
    readFileSync("scripts/data/followers-anteriorite.json", "utf8"),
  ) as { series: Serie[] };

  const client = new Client({ connectionString: url });
  await client.connect();

  let ecrits = 0;
  const absents: string[] = [];

  /* Tous les espaces d'abord : le fichier nomme ses clients comme on les dit
     à l'oral, et le slug de la base n'en découle pas — « I-WAY » y vit sous
     un slug que personne ne connaît par cœur. Deviner l'a fait tomber. */
  const tous = await client.query<{ id: string; slug: string; name: string }>(
    "select id, slug, name from workspaces",
  );

  try {
    for (const serie of fichier.series) {
      const espace = findWorkspaceByLabel(serie.workspace, tous.rows);
      if (!espace) {
        // Un espace absent n'arrête pas la reprise des autres : on le nomme,
        // et le passage échouera à la fin plutôt que de finir vert.
        if (!absents.includes(serie.workspace)) absents.push(serie.workspace);
        continue;
      }
      const workspaceId = espace.id;

      const provider = PROVIDER[serie.platform];

      /* La source du connecteur quand elle existe, pour que la clé primaire
         `(data_source_id, platform, date)` dédoublonne avec les relevés d'API
         à venir. Sinon une source dédiée, `pending` : TikTok n'a pas de
         connecteur, et l'histoire mérite d'être posée quand même.

         Le rapprochement passe par le **compte affecté**, pas par le premier
         venu : `meta_organic` couvre à la fois le compte Instagram et la Page
         Facebook, deux lignes du même `provider`. Prendre la plus ancienne
         rattachait l'histoire Instagram à la source de la Page — l'API aurait
         alors écrit ailleurs, et la courbe aurait porté deux points pour la
         même date. */
      const affectee = await client.query<{ id: string }>(
        `select d.id
           from workspace_social_accounts l
           join social_accounts a on a.id = l.account_id
           join data_sources d
             on d.workspace_id = l.workspace_id
            and d.provider = $3
            and d.external_account_id = a.external_id
          where l.workspace_id = $1 and l.kind = $2
          limit 1`,
        [workspaceId, KIND[serie.platform], provider],
      );

      let dataSourceId = affectee.rows[0]?.id;
      if (!dataSourceId) {
        const cree = await client.query<{ id: string }>(
          `insert into data_sources
             (workspace_id, provider, external_account_id, display_name, status)
           values ($1, $2, $3, $4, 'pending')
           on conflict (workspace_id, provider, external_account_id)
             do update set display_name = excluded.display_name
           returning id`,
          [workspaceId, provider, "anteriorite-looker", "Antériorité Looker"],
        );
        dataSourceId = cree.rows[0]!.id;
      }

      console.log(
        `${serie.libelle} — ${serie.points.length} relevés, ${serie.points[0]![0]} → ${serie.points.at(-1)![0]}`,
      );

      if (dryRun) continue;

      for (const [date, count] of serie.points) {
        await client.query(
          `insert into social_followers
             (data_source_id, workspace_id, platform, date, followers_count, source, updated_at)
           values ($1, $2, $3, $4, $5, 'looker', now())
           on conflict (data_source_id, platform, date) do update
             set followers_count = excluded.followers_count,
                 source = excluded.source,
                 updated_at = now()`,
          [dataSourceId, workspaceId, serie.platform, date, count],
        );
        ecrits += 1;
      }
    }
  } finally {
    await client.end();
  }

  console.log(dryRun ? "\nEssai à blanc — rien n'a été écrit." : `\n${ecrits} relevé(s) posé(s).`);

  /* Un espace introuvable **fait échouer le passage**. La première fois, il
     s'était contenté d'un avertissement : la reprise avait posé 4 relevés sur
     32 et le workflow était resté vert. Une perte silencieuse de données ne
     doit pas ressembler à un succès. */
  if (absents.length > 0) {
    console.error(
      `\n✖ espaces introuvables : ${absents.join(", ")}\n` +
        `  Espaces connus : ${tous.rows.map((w) => `${w.name} (${w.slug})`).join(", ")}\n` +
        `  Corriger le champ « workspace » dans scripts/data/followers-anteriorite.json.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
