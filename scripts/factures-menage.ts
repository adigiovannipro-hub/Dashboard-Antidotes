/**
 * Le ménage d'après essais : annule chez Airwallex les factures qui n'auraient
 * jamais dû exister, et efface le devis d'essai.
 *
 *   pnpm factures:menage            liste ce qui serait fait, sans rien faire
 *   pnpm factures:menage --ecrire   le fait
 *
 * Ce qu'il annule, et rien d'autre : les factures **nommées ici**, une par
 * une. Une facture finalisée est un document comptable — elle ne se supprime
 * pas, elle se `void`, et cela se décide ligne par ligne, jamais par un
 * filtre qui pourrait attraper une vraie.
 *
 * À jouer sur un runner GitHub : Airwallex refuse les adresses IP de Vercel.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

/**
 * Les factures d'essai à 1 €, créées pour éprouver la chaîne d'émission.
 *
 * La facture d'août de Chasseurs de Graines — 2 102,50 € — n'y figure pas et
 * n'y figurera pas : elle est réelle, elle est gardée.
 */
const FACTURES_D_ESSAI = [
  "inv_sgpd67zm2hly0tw7by5",
  "inv_sgpdktrn2hly0uzdill",
  "inv_sgpd644f9hly1jrm6kq",
  "inv_sgpdwtxb7hly1jtd6nb",
];

/** Le client d'essai, et rien d'autre : son nom est explicite. */
const CLIENT_D_ESSAI = "TEST FACTURATION AUTOMATIQUE";

async function main() {
  const ecrire = process.argv.includes("--ecrire");

  const { call, post } = await import("../src/lib/airwallex/transport");
  const { createAdminClient } = await import("../src/lib/supabase/server");
  const admin = createAdminClient();

  console.log("— Factures d'essai —");
  for (const id of FACTURES_D_ESSAI) {
    let etat = "introuvable";
    try {
      const raw = await call<{ status?: string; number?: string; total_amount?: number }>(
        `/api/v1/invoices/${id}`,
      );
      etat = `${raw.number ?? "?"} · ${raw.status ?? "?"} · ${raw.total_amount ?? "?"} EUR`;

      /* Garde-fou : on n'annule que ce qui est petit. Une facture d'essai vaut
         un euro ; au-delà, c'est qu'on s'est trompé d'identifiant. */
      if ((raw.total_amount ?? 0) > 5) {
        console.log(`✗ ${id} — ${etat} : montant trop élevé pour un essai, laissée`);
        continue;
      }

      if (ecrire) {
        const result = await post<{ status?: string }>(`/api/v1/invoices/${id}/void`, {
          request_id: `menage-${id}`,
        });
        console.log(`→ ${id} — ${etat} → ${result.status ?? "annulée"}`);
      } else {
        console.log(`≈ ${id} — ${etat} → serait annulée`);
      }
    } catch (error) {
      console.log(`· ${id} — ${etat} (${error instanceof Error ? error.message : error})`);
    }
  }

  /* Les essais dont on a perdu l'identifiant — le journal a été effacé avec le
     devis. On les reconnaît à leur montant : une facture d'un euro n'est
     jamais une vraie. Le seuil est bas exprès, et rien au-dessus n'est
     touché. */
  console.log("\n— Autres factures d'un euro encore vivantes —");
  let pageAfter: string | undefined;
  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (pageAfter) params.set("page_after", pageAfter);
    const page = await call<{
      items?: { id?: string; number?: string; status?: string; total_amount?: number }[];
      has_more?: boolean;
      page_after?: string;
    }>(`/api/v1/invoices?${params.toString()}`);

    for (const item of page.items ?? []) {
      const montant = item.total_amount ?? 0;
      if (!item.id || montant > 1 || item.status === "VOIDED") continue;
      if (FACTURES_D_ESSAI.includes(item.id)) continue;

      if (ecrire) {
        const result = await post<{ status?: string }>(
          `/api/v1/invoices/${item.id}/void`,
          { request_id: `menage-${item.id}` },
        );
        console.log(`→ ${item.id} — ${item.number} · ${montant} EUR → ${result.status ?? "annulée"}`);
      } else {
        console.log(`≈ ${item.id} — ${item.number} · ${montant} EUR → serait annulée`);
      }
    }

    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter);

  console.log("\n— Devis d'essai —");
  const { data, error } = await admin
    .from("billing_engagements")
    .select("id, client_name")
    .eq("client_name", CLIENT_D_ESSAI);
  if (error) throw new Error(`Lecture des devis : ${error.message}`);

  const devis = (data ?? []) as unknown as { id: string; client_name: string }[];
  if (devis.length === 0) {
    console.log("· aucun");
  } else if (ecrire) {
    /* La cascade emporte mensualités et journal. */
    const { error: deleteError } = await admin
      .from("billing_engagements")
      .delete()
      .in(
        "id",
        devis.map((row) => row.id),
      );
    if (deleteError) throw new Error(`Suppression refusée : ${deleteError.message}`);
    console.log(`→ ${devis.length} devis d'essai supprimé(s), journal compris`);
  } else {
    console.log(`≈ ${devis.length} devis d'essai seraient supprimés`);
  }

  if (!ecrire) console.log("\n— Aperçu seul : relancer avec --ecrire —");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
