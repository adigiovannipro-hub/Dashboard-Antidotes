/**
 * Reprend chez Airwallex ce qu'il sait déjà des clients, et le pose sur les
 * devis — pour ne pas avoir à recopier une adresse qui existe déjà.
 *
 *   pnpm factures:fiches            liste ce qui serait écrit, sans écrire
 *   pnpm factures:fiches --ecrire   écrit
 *
 * Le rapprochement se fait sur le nom, normalisé (casse, accents, espaces).
 * Ce qui est déjà renseigné sur le devis n'est jamais écrasé : la fiche fait
 * autorité une fois qu'un humain l'a touchée.
 *
 * À jouer sur un runner GitHub : Airwallex refuse les adresses IP de Vercel.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

type Customer = {
  id: string;
  name?: string;
  email?: string;
  tax_identification_number?: string;
  address?: {
    street?: string;
    city?: string;
    postcode?: string;
    country_code?: string;
  };
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const ecrire = process.argv.includes("--ecrire");

  const { call } = await import("../src/lib/airwallex/transport");
  const { createAdminClient } = await import("../src/lib/supabase/server");
  const admin = createAdminClient();

  /* Toutes les fiches connues d'Airwallex, en une passe. */
  const customers: Customer[] = [];
  let pageAfter: string | undefined;
  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (pageAfter) params.set("page_after", pageAfter);
    const page = await call<{
      items?: Customer[];
      has_more?: boolean;
      page_after?: string;
    }>(`/api/v1/billing_customers?${params.toString()}`);
    customers.push(...(page.items ?? []));
    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter);

  console.log(`${customers.length} fiche(s) client chez Airwallex.\n`);

  const byName = new Map<string, Customer>();
  for (const customer of customers) {
    if (customer.name) byName.set(normalize(customer.name), customer);
  }

  const { data, error } = await admin
    .from("billing_engagements")
    .select(
      "id, client_name, billing_name, billing_email, billing_street, billing_city, billing_postcode, billing_country, billing_tax_id, airwallex_customer_id",
    )
    .eq("status", "active");
  if (error) throw new Error(`Lecture des devis : ${error.message}`);

  for (const devis of (data ?? []) as unknown as {
    id: string;
    client_name: string;
    billing_name: string | null;
    billing_email: string | null;
    billing_street: string | null;
    billing_city: string | null;
    billing_postcode: string | null;
    billing_country: string | null;
    billing_tax_id: string | null;
    airwallex_customer_id: string | null;
  }[]) {
    /* On cherche sous les deux noms : celui de la facturation s'il est posé,
       celui du devis sinon. */
    const candidat =
      byName.get(normalize(devis.billing_name ?? "")) ??
      byName.get(normalize(devis.client_name));

    if (!candidat) {
      console.log(`· ${devis.client_name} — rien chez Airwallex`);
      continue;
    }

    /* Ce qui est déjà là ne bouge pas : un humain qui a corrigé une adresse a
       toujours raison contre un miroir. */
    const patch: Record<string, string> = {};
    if (!devis.airwallex_customer_id) patch.airwallex_customer_id = candidat.id;
    if (!devis.billing_name && candidat.name) patch.billing_name = candidat.name;
    if (!devis.billing_email && candidat.email) patch.billing_email = candidat.email;
    if (!devis.billing_tax_id && candidat.tax_identification_number) {
      patch.billing_tax_id = candidat.tax_identification_number;
    }
    if (!devis.billing_street && candidat.address?.street) {
      patch.billing_street = candidat.address.street;
    }
    if (!devis.billing_city && candidat.address?.city) {
      patch.billing_city = candidat.address.city;
    }
    if (!devis.billing_postcode && candidat.address?.postcode) {
      patch.billing_postcode = candidat.address.postcode;
    }
    if (candidat.address?.country_code && devis.billing_country !== candidat.address.country_code) {
      patch.billing_country = candidat.address.country_code;
    }

    if (Object.keys(patch).length === 0) {
      console.log(`✓ ${devis.client_name} — déjà complet (${candidat.id})`);
      continue;
    }

    console.log(
      `${ecrire ? "→" : "≈"} ${devis.client_name} — ${Object.entries(patch)
        .map(([key, value]) => `${key.replace("billing_", "")}=${value}`)
        .join(", ")}`,
    );

    if (ecrire) {
      const { error: patchError } = await admin
        .from("billing_engagements")
        .update(patch as never)
        .eq("id", devis.id);
      if (patchError) console.log(`  ✗ ${patchError.message}`);
    }
  }

  /* Les fiches qu'aucun devis n'a réclamées : c'est là que se lisent les
     écarts de nom — « L'ORIGINEL » chez nous, autre chose chez Airwallex. Sans
     cette liste, un client non rapproché reste une énigme. */
  const reclamees = new Set(
    ((data ?? []) as unknown as { client_name: string; billing_name: string | null }[])
      .flatMap((devis) => [normalize(devis.client_name), normalize(devis.billing_name ?? "")])
      .filter(Boolean),
  );

  const orphelines = customers.filter(
    (customer) => customer.name && !reclamees.has(normalize(customer.name)),
  );
  if (orphelines.length > 0) {
    console.log("\n— Fiches Airwallex sans devis correspondant —");
    for (const customer of orphelines) {
      const adresse = [
        customer.address?.street,
        customer.address?.postcode,
        customer.address?.city,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        `  ${customer.name} · ${customer.id}${customer.email ? ` · ${customer.email}` : ""}${adresse ? ` · ${adresse}` : ""}${customer.tax_identification_number ? ` · ${customer.tax_identification_number}` : ""}`,
      );
    }
  }

  if (!ecrire) console.log("\n— Aperçu seul : relancer avec --ecrire —");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
