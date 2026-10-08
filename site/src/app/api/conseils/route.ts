import { after } from "next/server";
import { z } from "zod";

import { enqueue, leadProfile } from "@/lib/db";
import { allow, json, readJson } from "@/lib/http/request";
import { processOutbox } from "@/lib/mail/outbox";
import type { TipsResponse } from "@/lib/funnel-contract";

export const dynamic = "force-dynamic";

/** Les trois gestes par courriel, proposés à un lead froid à la place du rendez-vous. */
export async function POST(request: Request): Promise<Response> {
  if (!(await allow(request, "conseils", 10, 3600))) return json<TipsResponse>({ ok: false, error: "generic" }, 429);
  const parsed = z.object({ leadId: z.uuid() }).safeParse(await readJson(request));
  if (!parsed.success) return json<TipsResponse>({ ok: false, error: "invalid" }, 400);
  try {
    const profile = await leadProfile(parsed.data.leadId);
    if (!profile) return json<TipsResponse>({ ok: false, error: "invalid" }, 404);
    await enqueue("cold_tips", { lead_id: parsed.data.leadId, email: profile.email, first_name: profile.first_name, locale: profile.locale });
    after(() => processOutbox().catch((error) => console.error("[outbox]", error)));
    return json<TipsResponse>({ ok: true });
  } catch (error) {
    console.error("[conseils]", error);
    return json<TipsResponse>({ ok: false, error: "generic" }, 500);
  }
}
