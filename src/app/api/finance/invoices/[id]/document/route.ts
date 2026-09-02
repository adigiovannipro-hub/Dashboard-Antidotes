import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizedRetrievalJob } from "@/lib/finance/retrieval-job";
import type { FinanceRetrievalSource } from "@/lib/finance/types";
import { sendFileToAirwallex } from "@/lib/recus/pipeline";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La facture récupérée, déposée par le passage extérieur.
 *
 * Le passage télécharge, mais n'envoie pas lui-même : c'est le dashboard qui
 * la fait partir à Airwallex, depuis la boîte Gmail déjà connectée aux Reçus.
 * Le Mac n'a ainsi aucun secret de messagerie à porter — un seul secret,
 * celui de ces routes — et l'envoi passe par le même chemin que les
 * justificatifs reçus par mail. La fiche passe à « récupérée » **après**
 * l'envoi confirmé, jamais avant.
 *
 * Multipart, champ `file`, PDF seulement, 10 Mo au plus — la limite
 * d'Airwallex, autant la partager.
 */

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-");

/* La date du jour telle que le sujet la dit — celle qu'on lit à Paris. */
const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  if (!authorizedRetrievalJob(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant (champ « file »)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd : 10 Mo au plus." }, { status: 413 });
  }
  const content = Buffer.from(await file.arrayBuffer());
  if (content.length < 1024 || !content.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return NextResponse.json({ error: "Le fichier n'est pas un PDF." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_retrieval_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: `Lecture de la fiche : ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Fiche introuvable." }, { status: 404 });
  }
  const source = data as unknown as FinanceRetrievalSource;

  const now = new Date();
  const subject = `Facture ${source.merchant_label} - ${DATE.format(now)}`;
  const sent = await sendFileToAirwallex({
    orgId: source.org_id,
    subject,
    merchant: source.merchant_label,
    fileName: file.name || `facture-${source.merchant_key}.pdf`,
    content,
  });

  if (!sent.ok) {
    await admin
      .from("finance_retrieval_sources")
      .update({ retrieval_status: "failed", last_error: `Envoi : ${sent.error}` } as never)
      .eq("id", id);
    return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
  }

  const { error: writeError } = await admin
    .from("finance_retrieval_sources")
    .update({
      retrieval_status: "done",
      auto_retrieved_at: now.toISOString(),
      last_error: null,
    } as never)
    .eq("id", id);
  if (writeError) {
    /* Le mail est parti : le dire, même si la fiche n'a pas pu être marquée —
       le passage suivant ne renverra pas la pièce sans ce marquage, et c'est
       cette ligne qui permet de le poser à la main. */
    return NextResponse.json(
      {
        ok: false,
        error: `Facture envoyée à ${sent.to} mais fiche non marquée : ${writeError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent_to: sent.to,
    subject,
    message_id: sent.messageId,
    retrieved_at: now.toISOString(),
  });
}
