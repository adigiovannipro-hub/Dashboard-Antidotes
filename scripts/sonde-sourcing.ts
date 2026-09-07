/**
 * La sonde du sourcing : ce que chaque fournisseur répond **vraiment** pour
 * une société, réponses brutes comprises — avant de croire au connecteur.
 *
 *   pnpm sonde:sourcing --societe "Optique Saint-Jean" --ville Lyon
 *   pnpm sonde:sourcing --societe "Optique Saint-Jean" --maps opticien
 *
 * Lecture seule : rien n'est écrit en base. Chaque étape s'exécute si sa clé
 * est là, et dit sinon laquelle manque. Étape optionnelle de `db-admin`, seul
 * endroit d'où les API tierces sont joignables.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const company = argument("societe");
  if (!company) {
    console.error('Usage : pnpm sonde:sourcing --societe "Nom" [--ville Lyon] [--site https://…] [--maps opticien]');
    process.exit(1);
  }
  const city = argument("ville");
  const website = argument("site");
  const mapsKeyword = argument("maps");

  const { assembleProviders } = await import("../src/lib/antidotes/sourcing/assemble");
  const { resolveSourceParams } = await import("../src/lib/antidotes/sourcing/config");
  const { pickDecisionMaker } = await import("../src/lib/antidotes/sourcing/decision-maker");
  const { DEFAULT_JOB_KEYWORDS, DEFAULT_MARKETING_THRESHOLD } = await import(
    "../src/lib/antidotes/sourcing/config"
  );

  const providers = assembleProviders();
  console.log(`Société : ${company}${city ? ` · ${city}` : ""}${website ? ` · ${website}` : ""}`);
  if (providers.missing.length > 0) console.log(`Non branchés : ${providers.missing.join(" · ")}`);

  // --- Google Maps -----------------------------------------------------------
  if (mapsKeyword) {
    const engine = providers.engines.maps;
    if (!engine) console.log("\n[Maps] APIFY_TOKEN absent.");
    else {
      console.log(`\n[Maps] « ${mapsKeyword} » à ${city ?? "Lyon"} (3 lieux)…`);
      try {
        const companies = await engine(
          resolveSourceParams({ keywords: [mapsKeyword], cities: [city ?? "Lyon"], max_places: 3 }),
        );
        console.log(JSON.stringify(companies, null, 2));
      } catch (error) {
        console.log(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // --- Publicités ----------------------------------------------------------------
  if (!providers.ads) console.log("\n[Ad Library] META_AD_LIBRARY_TOKEN absent.");
  else {
    console.log("\n[Ad Library] annonces actives…");
    const verdict = await providers.ads({ company_name: company, country: "FR" });
    console.log(verdict === null ? "  refus ou plafond (on ne sait pas)" : JSON.stringify(verdict));
  }

  // --- Décisionnaire ---------------------------------------------------------------
  const input = { company_name: company, website, city, postal_code: null, country: "FR" };
  for (const source of ["legal_registry", "linkedin", "website"] as const) {
    const finder = providers.discovery[source];
    if (!finder) {
      console.log(`\n[${source}] non branché.`);
      continue;
    }
    console.log(`\n[${source}]…`);
    try {
      const result = await finder(input);
      console.log(JSON.stringify(result, null, 2));
      const picked = pickDecisionMaker(result.people, {
        jobKeywords: DEFAULT_JOB_KEYWORDS,
        marketingThreshold: DEFAULT_MARKETING_THRESHOLD,
        employees: result.employees ?? null,
      });
      console.log(
        picked
          ? `  → décisionnaire : ${picked.person.first_name} ${picked.person.last_name} (${picked.person.role}, ${picked.seniority})`
          : "  → aucun poste reconnu",
      );
    } catch (error) {
      console.log(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // --- Adresses (une seule personne, pour ne pas brûler de crédit) ------------------
  const first = argument("prenom");
  const last = argument("nom");
  if (first && last) {
    for (const provider of ["dropcontact", "hunter"] as const) {
      const finder = providers.email[provider];
      if (!finder) {
        console.log(`\n[${provider}] non branché.`);
        continue;
      }
      console.log(`\n[${provider}] ${first} ${last}…`);
      try {
        console.log(JSON.stringify(await finder({ first_name: first, last_name: last, website, company_name: company })));
      } catch (error) {
        console.log(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else {
    console.log("\n(ajouter --prenom et --nom pour sonder les fournisseurs d'adresse)");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
