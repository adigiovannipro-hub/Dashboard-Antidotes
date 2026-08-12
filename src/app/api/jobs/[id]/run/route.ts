import { NextResponse, after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { toJobPayload } from "@/lib/production/card-model";
import { runGenerationJob } from "@/lib/production/generate";
import type { GenerationJob } from "@/lib/production/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Réveil manuel d'un job resté en `pending`.
 *
 * Le chemin nominal n'en a pas besoin — `/api/generate/[phase]` enchaîne déjà
 * le traitement via `after()`. Cette route est la roue de secours du cahier
 * des charges : si la fonction a été coupée avant de traiter, un POST ici
 * relance le worker sur le même job, sans en créer un autre.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });

  const job = data as unknown as GenerationJob;
  if (!viewer.ownedOrgIds.includes(job.org_id)) {
    return new NextResponse(null, { status: 404 });
  }

  if (job.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Ce job n'attend pas de traitement." },
      { status: 409 },
    );
  }

  after(() => runGenerationJob(job.id));
  return NextResponse.json({ ok: true, job: toJobPayload(job) });
}
