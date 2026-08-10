/**
 * Diagnostic du module Échéances — lecture seule, rien n'est écrit.
 *
 *   pnpm diagnostic:billing
 *
 * Répond aux trois questions qu'on se pose quand l'écran ment : qu'est-ce
 * qui est en base, qu'est-ce qui se retrouve dans quel groupe, et **quelles
 * lignes font doublon** entre une mensualité de devis et la facture
 * Airwallex qui la représente.
 *
 * Le doublon est le défaut structurel du module tant que le rapprochement
 * n'a pas tourné : la mensualité vient de Monday, la facture vient
 * d'Airwallex, et rien ne les relie encore — l'écran affiche donc deux fois
 * la même somme.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

type Row = Record<string, unknown>;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function euro(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

async function main() {
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
    const section = (title: string) => console.log(`\n=== ${title} ===`);

    section("Devis");
    const { rows: engagements } = await client.query<Row>(
      `select client_name, label, status, vat_rate, first_month, months_count, notes
         from billing_engagements order by client_name, first_month`,
    );
    console.log(`${engagements.length} devis`);
    const vatCounts = new Map<string, number>();
    for (const e of engagements) {
      const key = String(e.vat_rate);
      vatCounts.set(key, (vatCounts.get(key) ?? 0) + 1);
    }
    console.log("TVA :", [...vatCounts].map(([r, n]) => `${r}% × ${n}`).join(", "));

    section("Mensualités par statut");
    const { rows: byStatus } = await client.query<Row>(
      `select status, count(*) as n, sum(amount_cents) as cents,
              count(matched_invoice_id) as reliees,
              count(issued_at) as avec_date_emission,
              count(archived_at) as archivees
         from billing_installments group by status order by status`,
    );
    for (const r of byStatus) {
      console.log(
        `${String(r.status).padEnd(8)} ${String(r.n).padStart(4)} lignes  ${euro(Number(r.cents))}` +
          `  reliées:${r.reliees}  date d'émission:${r.avec_date_emission}  archivées:${r.archivees}`,
      );
    }

    section("Mensualités visibles (non archivées), par groupe d'écran");
    const { rows: visible } = await client.query<Row>(
      `select i.id, i.status, i.service_month, i.issue_on, i.issued_at, i.paid_at,
              i.amount_cents, i.vat_rate, i.matched_invoice_id, e.client_name, e.label
         from billing_installments i
         join billing_engagements e on e.id = i.engagement_id
        where i.archived_at is null
        order by i.issue_on, e.client_name`,
    );
    const today = new Date().toISOString().slice(0, 10);
    const stageOf = (r: Row): string => {
      if (r.status === "skipped") return "passée";
      if (r.status === "paid") return "payée";
      if (r.status === "issued") return "facturée";
      return String(r.issue_on).slice(0, 10) <= today ? "à facturer" : "devis confirmé";
    };
    const groups = new Map<string, Row[]>();
    for (const r of visible) {
      const g = stageOf(r);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(r);
    }
    for (const [g, rs] of groups) {
      const total = rs.reduce((s, r) => s + Number(r.amount_cents), 0);
      console.log(`\n— ${g} : ${rs.length} lignes, ${euro(total)}`);
      for (const r of rs.slice(0, 40)) {
        console.log(
          `   ${String(r.service_month).slice(0, 7)}  ${String(r.client_name).slice(0, 24).padEnd(24)}` +
            ` ${euro(Number(r.amount_cents)).padStart(11)}  émise:${r.issued_at ? String(r.issued_at).slice(0, 10) : "—"}` +
            `  lien:${r.matched_invoice_id ? "oui" : "non"}`,
        );
      }
      if (rs.length > 40) console.log(`   … ${rs.length - 40} de plus`);
    }

    section("Factures Airwallex");
    const { rows: invoices } = await client.query<Row>(
      `select id, client_name, amount_cents, currency, status, raw_status,
              issued_on, due_on, paid_at
         from finance_invoices order by issued_on desc nulls last`,
    );
    console.log(`${invoices.length} factures en base`);
    const invByStatus = new Map<string, number>();
    for (const f of invoices) {
      const k = String(f.status);
      invByStatus.set(k, (invByStatus.get(k) ?? 0) + 1);
    }
    console.log("par statut :", [...invByStatus].map(([s, n]) => `${s}:${n}`).join(", "));
    console.log("\nLes 25 plus récentes :");
    for (const f of invoices.slice(0, 25)) {
      console.log(
        `   ${String(f.issued_on ?? "—").slice(0, 10)}  ${String(f.client_name).slice(0, 24).padEnd(24)}` +
          ` ${euro(Number(f.amount_cents)).padStart(11)}  ${String(f.status).padEnd(6)}` +
          ` échéance:${String(f.due_on ?? "—").slice(0, 10)}  payée:${f.paid_at ? String(f.paid_at).slice(0, 10) : "—"}`,
      );
    }

    section("Doublons probables : mensualité ↔ facture non reliées");
    /* Le même client, le même mois d'émission : c'est très probablement la
       même prestation affichée deux fois. Le montant est indicatif — la TVA
       du devis peut ne pas correspondre à ce qu'Airwallex a facturé. */
    const unmatched = invoices.filter(
      (f) => !visible.some((i) => i.matched_invoice_id === f.id),
    );
    let pairs = 0;
    for (const f of unmatched) {
      if (f.status !== "sent" && f.status !== "paid") continue;
      const issued = String(f.issued_on ?? "").slice(0, 7);
      if (!issued) continue;
      for (const i of visible) {
        if (i.matched_invoice_id) continue;
        if (normalize(String(i.client_name)) !== normalize(String(f.client_name))) continue;
        if (String(i.issue_on).slice(0, 7) !== issued) continue;
        pairs += 1;
        const ht = Number(i.amount_cents);
        const ttc = Math.round((ht * (100 + Number(i.vat_rate))) / 100);
        const facture = Number(f.amount_cents);
        const accord =
          facture === ht ? "= HT" : facture === ttc ? "= TTC" : `≠ (HT ${euro(ht)} / TTC ${euro(ttc)})`;
        console.log(
          `   ${issued}  ${String(i.client_name).slice(0, 24).padEnd(24)}` +
            ` mensualité ${String(i.status).padEnd(7)} ${euro(ht).padStart(11)}` +
            ` | facture ${String(f.status).padEnd(5)} ${euro(facture).padStart(11)}  ${accord}`,
        );
        break;
      }
    }
    console.log(
      pairs === 0
        ? "   aucun doublon détecté"
        : `\n   ${pairs} paire(s) — autant de lignes affichées deux fois à l'écran.`,
    );

    section("Clients : noms côté devis vs côté Airwallex");
    const devisClients = new Set(engagements.map((e) => normalize(String(e.client_name))));
    const factureClients = new Set(invoices.map((f) => normalize(String(f.client_name))));
    const communs = [...devisClients].filter((c) => factureClients.has(c));
    console.log(`devis: ${devisClients.size} · factures: ${factureClients.size} · noms communs: ${communs.length}`);
    console.log(
      "présents chez Airwallex sans devis :",
      [...factureClients].filter((c) => !devisClients.has(c)).join(", ") || "aucun",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
