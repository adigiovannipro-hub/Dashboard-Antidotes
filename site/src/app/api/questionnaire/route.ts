import { after } from "next/server";
import { z } from "zod";

import { DbError, saveAnswers } from "@/lib/db";
import { allow, json, readJson } from "@/lib/http/request";
import { processOutbox } from "@/lib/mail/outbox";
import { computeScoring, validateAnswers, type Answers } from "@/lib/questionnaire";
import type { QuestionnaireResponse } from "@/lib/funnel-contract";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadId: z.uuid(),
  answers: z.record(z.string().max(40), z.union([z.string().max(60), z.array(z.string().max(60)).max(10)])),
  completed: z.boolean(),
});

export async function POST(request: Request): Promise<Response> {
  if (!(await allow(request, "questionnaire", 120, 3600))) return json<QuestionnaireResponse>({ ok: false, error: "generic" }, 429);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json<QuestionnaireResponse>({ ok: false, error: "invalid" }, 400);
  const { leadId, completed } = parsed.data;
  const answers = parsed.data.answers as Answers;

  const validation = validateAnswers(answers);
  if (completed && !validation.ok) {
    return json<QuestionnaireResponse>({ ok: false, error: "incomplete", missing: validation.missing }, 400);
  }
  // La note se calcule à chaque sauvegarde, mais ne quitte jamais le serveur :
  // la réponse ne porte que la température, qui décide de la suite du parcours.
  const scoring = completed ? computeScoring(answers) : null;
  try {
    await saveAnswers({
      leadId,
      answers,
      score: scoring?.score ?? null,
      temperature: scoring?.temperature ?? null,
      completed,
    });
    if (completed) after(() => processOutbox().catch((error) => console.error("[outbox]", error)));
    return json<QuestionnaireResponse>({ ok: true, temperature: scoring?.temperature ?? null });
  } catch (error) {
    if (error instanceof DbError && error.code === "P0002") return json<QuestionnaireResponse>({ ok: false, error: "invalid" }, 404);
    console.error("[questionnaire]", error);
    return json<QuestionnaireResponse>({ ok: false, error: "generic" }, 500);
  }
}
