/**
 * Accorder ou retirer l'automatisme d'un fournisseur des Reçus.
 *
 *   pnpm recus:confiance                     liste les règles et leur état
 *   pnpm recus:confiance finary.com          le fournisseur part désormais seul
 *   pnpm recus:confiance stripe.com --retirer  retour à la validation manuelle
 *
 * Pourquoi cette commande existe : le bouton « Toujours » de l'écran Reçus
 * n'apparaît que sur une **pièce en attente**. Un fournisseur dont toutes les
 * pièces sont déjà traitées n'a donc aucun chemin d'écran, et il faut attendre
 * sa prochaine facture pour l'automatiser — soit un mois. C'est le seul trou
 * de cette boucle d'apprentissage, et il se comble ici.
 *
 * **La règle porte sur le domaine d'expéditeur, pas sur le marchand** — c'est
 * la clé d'unicité de la table, et `pipeline.ts` la retrouve par ce seul
 * champ. Automatiser `stripe.com` pour Superwhisper automatise donc tout
 * fournisseur qui facture via Stripe. Les autres gardes tiennent toujours
 * (confiance, plafond, rapprochement obligatoire), mais la portée est bien
 * celle du domaine : la commande le dit avant d'écrire.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type Rule = {
  id: string;
  org_id: string;
  merchant: string | null;
  sender_domain: string;
  auto_forward: boolean;
  approvals: number;
  rejections: number;
};

async function main(): Promise<void> {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Variables absentes : ${missing.join(", ")}.`);

  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();

  const [domaine, ...reste] = process.argv.slice(2);
  const retirer = reste.includes("--retirer");

  const { data, error } = await admin
    .from("receipt_merchant_rules")
    .select("id, org_id, merchant, sender_domain, auto_forward, approvals, rejections")
    .order("sender_domain", { ascending: true });
  if (error) throw new Error(`Lecture des règles : ${error.message}`);
  const rules = (data ?? []) as unknown as Rule[];

  if (!domaine) {
    console.log(`${rules.length} règle(s) — « auto » = part sans validation :`);
    for (const rule of rules) {
      console.log(
        `  ${rule.sender_domain.padEnd(26)} ${(rule.merchant ?? "—").slice(0, 34).padEnd(36)}` +
          ` auto=${String(rule.auto_forward).padEnd(5)} ok=${rule.approvals} ko=${rule.rejections}`,
      );
    }
    console.log("\nUsage : pnpm recus:confiance <domaine> [--retirer]");
    return;
  }

  const rule = rules.find((candidate) => candidate.sender_domain === domaine);
  if (!rule) {
    throw new Error(
      `Aucune règle pour « ${domaine} ». Domaines connus : ` +
        rules.map((candidate) => candidate.sender_domain).join(", "),
    );
  }

  const enabled = !retirer;
  if (rule.auto_forward === enabled) {
    console.log(`${domaine} est déjà ${enabled ? "automatisé" : "manuel"} — rien à faire.`);
    return;
  }

  /* La portée réelle, dite avant d'écrire : la règle vaut pour le domaine,
     donc pour tout marchand qui facture par lui. */
  const voisins = [...new Set(rules.filter((r) => r.sender_domain === domaine).map((r) => r.merchant))];
  console.log(
    `${enabled ? "Automatisation" : "Retrait"} de « ${domaine} »` +
      ` (marchand vu : ${voisins.filter(Boolean).join(", ") || "aucun"}).`,
  );
  if (enabled) {
    console.log(
      "  Portée : toute facture reçue de ce domaine, quel que soit le marchand.\n" +
        "  Gardes conservées : confiance minimale, plafond de montant,\n" +
        "  rapprochement obligatoire avec une dépense Airwallex.",
    );
  }

  const { error: writeError } = await admin
    .from("receipt_merchant_rules")
    .update({ auto_forward: enabled } as never)
    .eq("id", rule.id);
  if (writeError) throw new Error(`Écriture refusée : ${writeError.message}`);

  console.log(`✔ ${domaine} → auto_forward = ${enabled}`);
}

main().catch((error: unknown) => {
  console.error(`ERREUR : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
