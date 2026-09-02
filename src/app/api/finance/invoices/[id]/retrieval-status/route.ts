import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizedRetrievalJob } from "@/lib/finance/retrieval-job";
import type { FinanceRetrievalSource } from "@/lib/finance/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le compte rendu du passage extérieur, fiche par fiche.
 *
 * `done` : la facture est récupérée **et** envoyée à Airwallex — c'est le
 * moment où la date se pose, et c'est elle que l'écran compare au mois
 * courant. `failed` : la cause s'affiche dans la cellule, le prochain passage
 * réessaie. `pending` : remettre en attente, sans effacer la dernière date
 * réussie.
 *
 * Même garde que la liste : `Bearer CRON_SECRET`, client de service.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  retrieval_status: z.enum(["pending", "done", "failed"], {
    error: "Statut inconnu : pending, done ou failed.",
  }),
  /** La cause d'un échec, affichée telle quelle dans la cellule. */
  error: z.string().trim().max(500).optional(),
  /** L'instant de la récupération, sinon maintenant. */
  retrieved_at: z.iso.datetime({ offset: true }).optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  if (!authorizedRetrievalJob(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 },
    );
  }

  const { retrieval_status, error, retrieved_at } = parsed.data;
  const patch: Partial<FinanceRetrievalSource> =
    retrieval_status === "done"
      ? {
          retrieval_status,
          auto_retrieved_at: retrieved_at ?? new Date().toISOString(),
          last_error: null,
        }
      : retrieval_status === "failed"
        ? { retrieval_status, last_error: error ?? "Échec sans détail." }
        : { retrieval_status, last_error: null };

  const admin = createAdminClient();
  const { data, error: writeError } = await admin
    .from("finance_retrieval_sources")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (writeError) {
    return NextResponse.json(
      { ok: false, error: `Mise à jour refusée : ${writeError.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Fiche introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, source: data });
}
