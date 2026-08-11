import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { toJobPayload } from "@/lib/production/card-model";
import type { GenerationJob } from "@/lib/production/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * État d'un job de génération — ce que la carte interroge toutes les 3 s.
 *
 * Lecture par le client admin après contrôle d'accès explicite : la route
 * vérifie que le job appartient à une organisation dont le lecteur est owner,
 * et répond 404 dans tous les autres cas — module interne, il ne se signale
 * pas.
 */

export const dynamic = "force-dynamic";

export async function GET(
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

  return NextResponse.json({ ok: true, job: toJobPayload(job) });
}
