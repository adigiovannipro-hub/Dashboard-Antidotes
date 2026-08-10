/**
 * Débusque les devis en double et retire l'importé.
 *
 *   pnpm dedupe:billing --dry-run   montre, n'écrit rien
 *   pnpm dedupe:billing             applique
 *
 * L'anti-doublon de l'import compare le couple (client, projet) : deux
 * libellés différents pour le même contrat lui échappent — « L'ORIGINEL ·
 * Accompagnement Social Media 2026-2027 » repris du board, face à
 * « L'Originel · … » saisi à la main. Les deux apparaissent, et l'écran
 * compte deux fois la même facturation.
 *
 * La règle retenue : **même client, périodes qui se chevauchent** ⇒ doublon.
 * Deux prestations distinctes pour un même client sur une même période
 * existent (une stratégie ponctuelle en marge d'un accompagnement), donc la
 * suppression ne vise que le devis **repris du board** — celui qui porte la
 * note d'import — et jamais une saisie manuelle. Un devis manuel en trop se
 * retire à la main, depuis l'écran, en connaissance de cause.
 *
 * Sauf quand la saisie manuelle est la moins fidèle : le board porte les
 * mensualités réelles, mois par mois, là où une saisie rapide met le même
 * montant partout. `--garder-monday` inverse alors le choix.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const IMPORT_NOTE = "Repris du board Monday";

type Engagement = {
  id: string;
  client_name: string;
  label: string;
  first_month: string;
  months_count: number;
  notes: string | null;
  lines: number;
  distinct_amounts: number;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function monthIndex(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
}

function overlaps(a: Engagement, b: Engagement): boolean {
  const aStart = monthIndex(a.first_month);
  const bStart = monthIndex(b.first_month);
  return (
    aStart <= bStart + b.months_count - 1 && bStart <= aStart + a.months_count - 1
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const keepMonday = process.argv.includes("--garder-monday");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL est absent.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: engagements } = await client.query<Engagement>(
      `select e.id, e.client_name, e.label, e.first_month::text as first_month,
              e.months_count, e.notes,
              count(i.id)::int as lines,
              count(distinct i.amount_cents)::int as distinct_amounts
         from billing_engagements e
         left join billing_installments i on i.engagement_id = e.id
        group by e.id
        order by e.client_name, e.first_month`,
    );

    const byClient = new Map<string, Engagement[]>();
    for (const e of engagements) {
      const key = normalize(e.client_name);
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key)!.push(e);
    }

    const toDelete: { doomed: Engagement; kept: Engagement }[] = [];
    for (const [, group] of byClient) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const a = group[i]!;
          const b = group[j]!;
          if (!overlaps(a, b)) continue;

          const fromMonday = [a, b].filter((e) => e.notes === IMPORT_NOTE);
          const manual = [a, b].filter((e) => e.notes !== IMPORT_NOTE);
          if (fromMonday.length !== 1 || manual.length !== 1) {
            console.log(
              `⚠ ${a.client_name} : deux devis se chevauchent mais aucun n'est arbitrable` +
                ` (« ${a.label} » et « ${b.label} ») — à trancher à la main.`,
            );
            continue;
          }

          /* Le board détaille les mensualités mois par mois ; une saisie
             rapide met souvent le même montant partout. Le plus fidèle
             gagne, sauf ordre contraire. */
          const mondayIsRicher = fromMonday[0]!.distinct_amounts > manual[0]!.distinct_amounts;
          const keep = keepMonday || mondayIsRicher ? fromMonday[0]! : manual[0]!;
          const doomed = keep === fromMonday[0] ? manual[0]! : fromMonday[0]!;
          toDelete.push({ doomed, kept: keep });
        }
      }
    }

    if (toDelete.length === 0) {
      console.log("Aucun doublon de devis.");
      return;
    }

    for (const { doomed, kept } of toDelete) {
      console.log(
        `${dryRun ? "—" : "✗"} ${doomed.client_name} · ${doomed.label}` +
          ` (${doomed.lines} mensualités, ${doomed.distinct_amounts} montant(s) distinct(s),` +
          ` ${doomed.notes === IMPORT_NOTE ? "import Monday" : "saisie manuelle"})`,
      );
      console.log(
        `   gardé : ${kept.client_name} · ${kept.label}` +
          ` (${kept.lines} mensualités, ${kept.distinct_amounts} montant(s) distinct(s),` +
          ` ${kept.notes === IMPORT_NOTE ? "import Monday" : "saisie manuelle"})`,
      );

      if (!dryRun) {
        // Les mensualités partent en cascade — voir 0016.
        await client.query("delete from billing_engagements where id = $1", [doomed.id]);
      }
    }

    console.log(
      dryRun
        ? `\n--dry-run : ${toDelete.length} devis seraient supprimés.`
        : `\n${toDelete.length} devis en double supprimés.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
