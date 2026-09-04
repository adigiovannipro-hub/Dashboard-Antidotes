import { NextResponse } from "next/server";

import { lookupEntreprise } from "@/lib/billing/entreprise";
import { requireFinanceAccess } from "@/lib/finance/access";

export const dynamic = "force-dynamic";

/**
 * L'identité d'une entreprise, depuis un SIREN, un SIRET ou un numéro de TVA.
 *
 * Le panneau des devis s'en sert pour remplir la raison sociale et l'adresse
 * d'un coup, au lieu de les recopier d'un document. La donnée vient de
 * l'annuaire public des entreprises — voir `src/lib/billing/entreprise.ts`.
 *
 * Pourquoi passer par une route plutôt qu'appeler l'annuaire depuis le
 * navigateur : la règle du projet est qu'aucun fetch tiers ne part du client.
 * Elle vaut ici comme ailleurs, même pour une donnée publique.
 *
 * Le contrôle d'accès vient en premier : c'est un module interne, donc 404 et
 * non 403 à qui n'y a pas droit.
 */
export async function GET(request: Request) {
  await requireFinanceAccess();

  const identifiant = new URL(request.url).searchParams.get("identifiant") ?? "";
  if (!identifiant.trim()) {
    return NextResponse.json({ error: "Identifiant absent." }, { status: 400 });
  }

  try {
    const entreprise = await lookupEntreprise(identifiant);
    if (!entreprise) {
      return NextResponse.json(
        { error: "Aucune entreprise sous cet identifiant." },
        { status: 404 },
      );
    }
    return NextResponse.json(entreprise);
  } catch (error) {
    /* L'annuaire est un service public : il tombe, et ce n'est pas une raison
       pour que la fiche devienne impossible à remplir. Le message le dit. */
    return NextResponse.json(
      {
        error: `L'annuaire des entreprises n'a pas répondu — saisir à la main : ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }
}
