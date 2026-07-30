/**
 * Applique les migrations SQL de `supabase/migrations` dans l'ordre.
 *
 *   pnpm db:migrate            applique ce qui manque
 *   pnpm db:migrate --status   liste sans rien appliquer
 *
 * Chaque fichier tourne dans une transaction et son nom est enregistré dans
 * `app.schema_migrations` : un second passage ne réapplique rien.
 *
 * Nécessite `SUPABASE_DB_URL` (Supabase > Project Settings > Database >
 * Connection string > URI).
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const statusOnly = process.argv.includes("--status");
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL est absent de .env.local.\n" +
        "Supabase > Project Settings > Database > Connection string (URI).",
    );
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString,
    // Supabase impose TLS mais présente un certificat que Node ne valide pas
    // sans son CA : on chiffre sans vérifier la chaîne.
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("create schema if not exists app");
    await client.query(`
      create table if not exists app.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      "select name, checksum from app.schema_migrations",
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const name of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(name);

      if (previous) {
        // Une migration déjà appliquée ne doit plus changer : sinon la base et
        // le dépôt racontent deux histoires différentes.
        const drift = previous !== checksum ? "  ⚠ modifiée depuis" : "";
        console.log(`= ${name}${drift}`);
        continue;
      }

      if (statusOnly) {
        console.log(`+ ${name}  (en attente)`);
        continue;
      }

      process.stdout.write(`→ ${name} … `);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into app.schema_migrations (name, checksum) values ($1, $2)",
          [name, checksum],
        );
        await client.query("commit");
        console.log("ok");
      } catch (error) {
        await client.query("rollback");
        console.log("échec");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
