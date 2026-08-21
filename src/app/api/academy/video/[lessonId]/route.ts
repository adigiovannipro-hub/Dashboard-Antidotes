import { NextResponse } from "next/server";
import { z } from "zod";

import { getAcademyContext } from "@/lib/academy/access";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Lecture d'une vidéo hébergée dans le bucket `academy-videos`.
 *
 * Le bucket n'a aucune politique de lecture : c'est cette route qui vérifie le
 * droit — être membre de l'organisation, et que la leçon se lise à travers la
 * RLS — puis signe une URL de six heures avec la clé de service. Même doctrine
 * que les justificatifs et les logos de marchands : jamais de fichier servi
 * sans vérification, jamais d'URL signée stockée.
 */

export const dynamic = "force-dynamic";

/** Six heures : une session de formation, pas un lien permanent. */
const SIGNED_URL_SECONDS = 6 * 60 * 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  // Le contrôle d'accès d'abord, avant tout travail.
  const context = await getAcademyContext();
  if (!context) {
    // 404 et non 403 : le module ne se signale pas à qui n'y a pas droit.
    return new NextResponse(null, { status: 404 });
  }

  const { lessonId } = await params;
  if (!z.uuid().safeParse(lessonId).success) {
    return new NextResponse(null, { status: 404 });
  }

  // Lue avec le client de session : la RLS tranche — un membre n'atteint pas
  // une leçon en brouillon, et la route ne peut pas signer ce qu'il ne lit pas.
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("academy_lessons")
    .select("id, video_provider, video_storage_path")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || lesson.video_provider !== "supabase" || !lesson.video_storage_path) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("academy-videos")
    .createSignedUrl(lesson.video_storage_path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "La vidéo est introuvable dans le stockage." },
      { status: 404 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
