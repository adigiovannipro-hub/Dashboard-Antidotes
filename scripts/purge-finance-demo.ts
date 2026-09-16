/**
 * Effacement des données de démonstration du module Finance.
 *
 *   pnpm purge:finance-demo
 *
 * À lancer une fois, le jour où la vraie synchronisation Airwallex prend le
 * relais : les deux jeux cohabitent sinon dans les mêmes tables, et l'écran
 * additionne des dépenses inventées à des dépenses réelles sans rien signaler.
 *
 * Ce que le script efface se reconnaît à la **forme** de son identifiant
 * externe, pas à sa date. Attention, le préfixe seul ne suffit pas : les
 * vraies factures Airwallex commencent aussi par `inv_` (`inv_sgpdwdhb…`),
 * établi par le diagnostic du 7 août. Ce qui les distingue du seed :
 *
 *   comptes        external_id = 'acct_antidotes'   (Airwallex : 'airwallex-wallet')
 *   factures       'inv_<client>-<année>-<mois>' — les tirets ; le réel n'en a pas
 *   dépenses       'exp_…' — les vraies sont des UUID, jamais préfixées
 *   justificatifs  storage_path like 'seed/%'
 *
 * Les soldes historiques partent avec leurs comptes, par cascade.
 *
 * Ce qui **reste** volontairement :
 *
 *   • les catégories et leurs règles de correspondance — c'est le plan
 *     comptable, pas de la démonstration : la synchronisation s'en sert pour
 *     ranger les vraies dépenses ;
 *   • le journal `finance_sync_runs` — les trois fausses lignes que le seed y
 *     écrivait sont désormais noyées par les passages réels, et
 *     l'amorçage n'en écrit plus (une synchronisation qui n'a pas eu lieu n'a
 *     pas à laisser de trace de réussite).
 *
 * Le script compte avant d'effacer et n'efface rien s'il ne trouve rien : le
 * rejouer est sans effet.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  // Supabase impose TLS ; un Postgres local n'en parle pas. Forcer `ssl` sur
  // le second ferait échouer la connexion avant la première requête.
  const local = /localhost|127\.0\.0\.1|sslmode=disable/.test(connectionString);
  const db = new Client({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations where slug = 'antidotes'",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Organisation « antidotes » introuvable.");

    // Une transaction : un effacement à moitié fait laisserait des dépenses de
    // démonstration orphelines de leurs justificatifs.
    await db.query("begin");

    const receipts = await db.query(
      "delete from finance_receipts where org_id = $1 and storage_path like 'seed/%'",
      [orgId],
    );
    const transactions = await db.query(
      "delete from finance_transactions where org_id = $1 and external_id like 'exp\\_%'",
      [orgId],
    );
    /* Le regex et non le préfixe : `inv_bondet-2026-08` (seed) tombe,
       `inv_sgpdwdhb5hl36cpai11` (réel) reste. */
    const invoices = await db.query(
      String.raw`delete from finance_invoices
        where org_id = $1 and external_id ~ '^inv_[a-z]+-[0-9]{4}-[0-9]{2}$'`,
      [orgId],
    );
    // Les instantanés d'abord : la contrainte de clé étrangère vers le compte
    // n'est pas déclarée `on delete cascade` partout, et compter les lignes
    // effacées ici renseigne mieux qu'un silence.
    const snapshots = await db.query(
      `delete from finance_balances_history
        where org_id = $1
          and account_id in (
            select id from finance_accounts
             where org_id = $1 and external_id = 'acct_antidotes'
          )`,
      [orgId],
    );
    const accounts = await db.query(
      "delete from finance_accounts where org_id = $1 and external_id = 'acct_antidotes'",
      [orgId],
    );

    await db.query("commit");

    console.log(
      [
        `Données de démonstration effacées :`,
        `  comptes        ${accounts.rowCount}`,
        `  soldes         ${snapshots.rowCount}`,
        `  factures       ${invoices.rowCount}`,
        `  dépenses       ${transactions.rowCount}`,
        `  justificatifs  ${receipts.rowCount}`,
        `Catégories, règles et journal de synchronisation conservés.`,
      ].join("\n"),
    );
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
