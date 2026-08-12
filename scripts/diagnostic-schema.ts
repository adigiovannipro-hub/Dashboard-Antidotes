/**
 * Diagnostic du schéma réel — lecture seule, rien n'est écrit.
 *
 *   pnpm diagnostic:schema            toutes les tables
 *   pnpm diagnostic:schema wording_history client_context
 *
 * Écrit parce qu'une suite d'isolation a échoué trois fois de suite sur
 * `PGRST204 : Could not find the 'accroche' column of 'wording_history' in
 * the schema cache`, sans qu'on puisse trancher entre trois causes qui
 * rendent toutes le même message :
 *
 *   1. la colonne n'existe pas dans la vraie base ;
 *   2. elle existe mais `authenticated` n'a aucun droit dessus — PostgREST
 *      construit son cache **à partir des privilèges**, une colonne sans
 *      droit est donc invisible pour l'API alors qu'elle est bien là ;
 *   3. le cache est simplement en retard.
 *
 * Sans terminal sur la base, on ne peut pas les distinguer en devinant.
 * Ce script le dit : colonnes réellement présentes, privilèges par rôle
 * d'API, et migrations enregistrées dans le journal.
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

/** Les rôles par lesquels passe l'API REST. */
const API_ROLES = ["anon", "authenticated", "service_role"];

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
};

type GrantRow = {
  table_name: string;
  column_name: string | null;
  grantee: string;
  privilege_type: string;
};

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL manquante. Bouton « Connect » du tableau de bord Supabase, option Session pooler.",
    );
    process.exit(1);
  }

  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: migrations } = await client.query<{ name: string; applied_at: string }>(
      "select name, applied_at from app.schema_migrations order by name",
    );
    console.log(`\n=== ${migrations.length} migration(s) au journal ===`);
    console.log(`  de ${migrations[0]?.name ?? "—"} à ${migrations.at(-1)?.name ?? "—"}`);

    const { rows: columns } = await client.query<ColumnRow>(
      `select table_name, column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public'
          and ($1::text[] is null or table_name = any($1))
        order by table_name, ordinal_position`,
      [wanted.length > 0 ? wanted : null],
    );

    // Privilèges de table **et** de colonne : un grant posé colonne par
    // colonne n'apparaît pas dans `table_privileges`.
    const { rows: tableGrants } = await client.query<GrantRow>(
      `select table_name, null::text as column_name, grantee, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public' and grantee = any($1)`,
      [API_ROLES],
    );
    const { rows: columnGrants } = await client.query<GrantRow>(
      `select table_name, column_name, grantee, privilege_type
         from information_schema.column_privileges
        where table_schema = 'public' and grantee = any($1)`,
      [API_ROLES],
    );

    const byTable = new Map<string, ColumnRow[]>();
    for (const column of columns) {
      byTable.set(column.table_name, [...(byTable.get(column.table_name) ?? []), column]);
    }

    for (const [table, tableColumns] of [...byTable].sort()) {
      const grants = tableGrants.filter((grant) => grant.table_name === table);
      const roles = API_ROLES.map((role) => {
        const privileges = grants
          .filter((grant) => grant.grantee === role)
          .map((grant) => grant.privilege_type.toLowerCase())
          .sort();
        return `${role}: ${privileges.length > 0 ? privileges.join("/") : "aucun"}`;
      });

      console.log(`\n--- ${table} (${tableColumns.length} colonnes)`);
      console.log(`    ${roles.join("  |  ")}`);
      console.log(
        `    ${tableColumns.map((column) => `${column.column_name}:${column.data_type}${column.is_nullable === "NO" ? "!" : ""}`).join(", ")}`,
      );

      // Le cas qui rend PGRST204 sur une colonne pourtant présente.
      const invisible = tableColumns.filter(
        (column) =>
          !columnGrants.some(
            (grant) =>
              grant.table_name === table &&
              grant.column_name === column.column_name &&
              grant.grantee === "authenticated",
          ),
      );
      if (invisible.length > 0) {
        console.log(
          `    ⚠ invisibles pour l'API (aucun privilège authenticated) : ${invisible
            .map((column) => column.column_name)
            .join(", ")}`,
        );
      }
    }

    if (wanted.length > 0) {
      const absentes = wanted.filter((table) => !byTable.has(table));
      if (absentes.length > 0) {
        console.log(`\n⚠ table(s) absente(s) du schéma public : ${absentes.join(", ")}`);
      }
    }

    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
