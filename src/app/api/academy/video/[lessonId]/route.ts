import { NextResponse } from "next/server";
import { z } from "zod";

import {
  canReachLesson,
  getAcademyContext,
  isPublishedChain,
} from "@/lib/academy/access";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Lecture d'une vidéo hébergée dans le bucket `academy-videos`.
 *
 * Le bucket n'a aucune politique de lecture : c'est cette route qui vérifie le
 * droit, puis signe une URL de six heures avec la clé de service. Même doctrine
 * que les justificatifs et les logos de marchands : jamais de fichier servi
 * sans vérification, jamais d'URL signée stockée.
 *
 * La vérification ne s'en remet **pas** à la RLS seule. En accès ouvert, le
 * client de lecture bascule en `service_role` et les politiques ne filtrent
 * plus rien : une élève pourrait alors signer la vidéo d'une formation qu'elle
 * n'a pas achetée, en devinant un identifiant de leçon. Le contrôle est donc
 * explicite — la leçon doit appartenir à une formation où la personne est
 * inscrite, et être publiée en chaîne. La RLS reste l'autorité quand elle est
 * active ; ce code tient la même règle quand elle ne l'est pas.
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
    .select("id, course_id, org_id, module_id, published, video_provider, video_storage_path")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || lesson.video_provider !== "supabase" || !lesson.video_storage_path) {
    return new NextResponse(null, { status: 404 });
  }

  // L'organisation d'abord, la formation ensuite : une élève n'atteint que
  // celles où elle est inscrite, un membre de l'équipe toutes celles de son
  // organisation.
  if (!canReachLesson(context, lesson)) {
    return new NextResponse(null, { status: 404 });
  }

  // La chaîne du publié, que l'owner seul traverse — c'est la règle de la RLS
  // (0057), rejouée ici parce que l'accès ouvert la désarme.
  if (!context.isAdmin) {
    const [{ data: parentModule }, { data: course }] = await Promise.all([
      supabase
        .from("academy_modules")
        .select("published")
        .eq("id", lesson.module_id)
        .maybeSingle(),
      supabase
        .from("academy_courses")
        .select("published")
        .eq("id", lesson.course_id)
        .maybeSingle(),
    ]);

    const chaine = {
      lesson: lesson.published,
      module: parentModule?.published ?? false,
      course: course?.published ?? false,
    };
    if (!isPublishedChain(context, chaine)) {
      return new NextResponse(null, { status: 404 });
    }
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
