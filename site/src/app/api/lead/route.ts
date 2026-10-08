import { after } from "next/server";
import { z } from "zod";

import { getDictionary } from "@/i18n";
import { createLead, DbError } from "@/lib/db";
import { allow, json, readJson } from "@/lib/http/request";
import { processOutbox } from "@/lib/mail/outbox";
import type { LeadResponse } from "@/lib/funnel-contract";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  firstName: z.string().trim().min(1).max(80),
  locale: z.enum(["fr", "en"]),
  consent: z.literal(true),
  timezone: z.string().max(64).nullable(),
  utm: z.record(z.string().max(80), z.string().max(200)).default({}),
  website: z.string().max(0).optional(),
});

/** Le texte de consentement enregistré est celui que la personne a lu, mot pour mot : il vient du dictionnaire. */
function consentText(locale: "fr" | "en"): string {
  const { consent, consentLink } = getDictionary(locale).funnel.email;
  return `${consent} ${consentLink}.`;
}

export async function POST(request: Request): Promise<Response> {
  if (!(await allow(request, "lead", 12, 3600))) return json<LeadResponse>({ ok: false, error: "rate_limited" }, 429);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json<LeadResponse>({ ok: false, error: "invalid" }, 400);
  const input = parsed.data;
  try {
    const lead = await createLead({
      email: input.email,
      firstName: input.firstName,
      locale: input.locale,
      consentText: consentText(input.locale),
      utm: input.utm,
      userAgent: request.headers.get("user-agent"),
      timezone: input.timezone,
    });
    after(() => processOutbox().catch((error) => console.error("[outbox]", error)));
    return json<LeadResponse>({ ok: true, leadId: lead.lead_id, created: lead.created });
  } catch (error) {
    console.error("[lead]", error instanceof DbError ? `${error.code} ${error.message}` : error);
    return json<LeadResponse>({ ok: false, error: "generic" }, 500);
  }
}
