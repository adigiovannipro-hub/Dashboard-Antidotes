import Anthropic from "@anthropic-ai/sdk";

import { htmlToText } from "../sourcing/website-people";
import type { Observation, ObservationInput, Observer } from "./passage";

/**
 * L'observation qui ouvre un email : une phrase concrète tirée du site de la
 * société ou de ses publicités — jamais inventée.
 *
 * Le modèle ne reçoit que ce qu'on sait : le texte de la page d'accueil, le
 * fait que des publicités tournent et depuis quand, la ville, le secteur, la
 * note Google. Il doit répondre « AUCUNE » quand rien de concret ne s'en
 * dégage, et c'est ce mot qui protège le contact d'une flatterie creuse :
 * une observation absente vaut mieux qu'une observation fausse, et le
 * gabarit prévoit le repli.
 *
 * Opus, comme les autres modules : la phrase est l'accroche de l'email, et
 * c'est elle qui décide si on est lu. Une centaine de jetons en sortie,
 * quelques milliers en entrée — de l'ordre de trois centimes par contact.
 */

export const OBSERVATION_MODEL = "claude-opus-5";
const SITE_CHARS = 5000;
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; AntidotesBot/1.0; +https://antidotes.fr)";

const SYSTEM = `Tu écris pour une agence social media française qui prospecte des commerces et marques.
On te donne ce que l'on sait d'une société. Tu rends UNE phrase d'observation, en français, à la deuxième personne du pluriel, concrète et vérifiable, tirée uniquement des éléments fournis : ce que la société met en avant, une gamme, un lieu, une actualité, le fait que ses publicités tournent.
Trente mots au plus. Pas de compliment vague, pas de question, pas de promesse, pas de chiffre qui ne figure pas dans les éléments.
Si rien de concret ne se dégage des éléments fournis, réponds exactement : AUCUNE`;

async function fetchHomepageText(fetcher: typeof fetch, website: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const text = htmlToText(await response.text());
    return text ? text.slice(0, SITE_CHARS) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function buildObservationPrompt(input: ObservationInput, siteText: string | null): string {
  const { prospect } = input;
  const facts: string[] = [`Société : ${prospect.company_name}`];
  if (prospect.sector) facts.push(`Secteur : ${prospect.sector}`);
  if (prospect.city) facts.push(`Ville : ${prospect.city}`);
  if (prospect.rating !== null) facts.push(`Note Google : ${prospect.rating}/5`);
  if (prospect.ads_active) {
    facts.push(
      prospect.ads_last_seen_at
        ? `Publicités Meta actives (vues le ${prospect.ads_last_seen_at.slice(0, 10)})`
        : "Publicités Meta actives",
    );
  }
  if (siteText) facts.push(`Page d'accueil du site :\n${siteText}`);
  return facts.join("\n\n");
}

export function parseObservation(raw: string): string | null {
  const text = raw.trim().replace(/^["«\s]+|["»\s]+$/g, "");
  if (!text || /^aucune\b/i.test(text)) return null;
  // Une seule phrase : on coupe à la première fin de phrase suivie d'un espace.
  const single = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return single.length > 240 ? null : single;
}

export function createObserver(options: { fetcher?: typeof fetch; anthropic?: Anthropic } = {}): Observer | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const fetcher = options.fetcher ?? fetch;
  const anthropic = options.anthropic ?? new Anthropic();

  return async (input): Promise<Observation> => {
    const siteText = input.prospect.website
      ? await fetchHomepageText(fetcher, input.prospect.website)
      : null;
    if (!siteText && !input.prospect.ads_active) {
      return { observation: null, source: "none" };
    }

    const response = await anthropic.messages.create({
      model: OBSERVATION_MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: buildObservationPrompt(input, siteText) }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("Observation refusée par les garde-fous du modèle.");
    }
    const block = response.content.find((entry) => entry.type === "text");
    const observation = parseObservation(block?.type === "text" ? block.text : "");
    return { observation, source: observation ? (siteText ? "site" : "ads") : "none" };
  };
}
