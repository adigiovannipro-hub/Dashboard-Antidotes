import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { toJobPayload } from "@/lib/production/card-model";
import { ACTIVE_JOB_STATUSES, type GenerationJob } from "@/lib/production/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Arrêt manuel d'un job de génération.
 *
 * L'unique sortie quand une génération traîne : le bouton de la carte est son
 * témoin, et rien d'autre ne peut être lancé sur l'espace tant qu'un job est
 * actif. Poser `cancelled` libère la carte tout de suite, et le worker s'en
 * sert de point d'arrêt — le wording s'interrompt entre deux lots.
 *
 * L'écriture est conditionnée aux statuts actifs : un verdict arrivé pendant
 * le clic gagne, et un job déjà terminé ne se fait pas relabelliser.
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Contrôle d'accès d'abord : module interne, 404 et jamais 403.
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

  const { data: updated, error } = await supabase
    .from("generation_jobs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .in("status", ACTIVE_JOB_STATUSES)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Arrêt impossible." },
      { status: 500 },
    );
  }

  // Aucune ligne touchée : le job avait rendu son verdict entre le clic et
  // l'écriture. Il n'y a plus rien à arrêter — on relit pour répondre l'état
  // réel plutôt que celui, périmé, qu'on avait chargé au-dessus.
  if (!updated) {
    const { data: fresh } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      job: toJobPayload((fresh as unknown as GenerationJob | null) ?? job),
    });
  }

  return NextResponse.json({
    ok: true,
    job: toJobPayload(updated as unknown as GenerationJob),
  });
}
