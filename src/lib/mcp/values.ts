import { STATUS_LABELS, type PlanningFormat, type PlanningStatus } from "@/lib/planning/types";

/**
 * Les valeurs qu'un modèle écrit à sa façon, ramenées à celles de la base.
 * Pur : testé sans base.
 */

/** « 2026-11 », « 2026-11-15 » ou « 2026-11-01 » → `2026-11-01`. */
export function parseMonth(raw: unknown): string {
  const match = /^(\d{4})-(\d{2})/.exec(String(raw ?? "").trim());
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new Error(`Mois illisible : « ${String(raw)} ». Format attendu : AAAA-MM.`);
  }
  return `${match[1]}-${match[2]}-01`;
}

const FORMATS: Record<string, PlanningFormat> = {
  post: "post",
  carrousel: "carousel",
  carousel: "carousel",
  reel: "reel",
  reels: "reel",
  story: "story",
  storie: "story",
  stories: "story",
  video: "video",
  vidéo: "video",
};

/** Un type absent ou inconnu devient un post, le format par défaut du tableau. */
export function resolveFormat(raw: unknown): PlanningFormat {
  return FORMATS[String(raw ?? "").trim().toLowerCase()] ?? "post";
}

/**
 * Les statuts qu'un modèle n'a pas le droit de poser.
 *
 * `validated` est le geste du client, jamais celui d'un assistant ;
 * `scheduled` (« Programmé ») déclenche la publication automatique de 16h00 (Bali),
 * c'est le geste de l'agence ; `published` affirmerait une publication qui
 * n'a pas eu lieu.
 */
export const FORBIDDEN_STATUSES: PlanningStatus[] = ["validated", "scheduled", "published"];

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Un statut écrit en clé (`in_progress`) ou en libellé (« En cours »), ramené
 * à sa clé — ou une erreur qui dit lesquels sont permis.
 */
export function resolveEditableStatus(raw: unknown): PlanningStatus {
  const wanted = fold(String(raw ?? "")).replace(/\s+/g, " ");
  const entries = Object.entries(STATUS_LABELS) as [PlanningStatus, string][];
  const found = entries.find(
    ([key, label]) => key === wanted.replace(/ /g, "_") || fold(label) === wanted,
  )?.[0];
  const allowed = entries
    .filter(([key]) => !FORBIDDEN_STATUSES.includes(key) && key !== "idea")
    .map(([, label]) => label)
    .join(", ");
  if (!found) throw new Error(`Statut inconnu : « ${String(raw)} ». Statuts : ${allowed}.`);
  if (FORBIDDEN_STATUSES.includes(found)) {
    throw new Error(
      `« ${STATUS_LABELS[found]} » ne se pose que dans l'application : la validation appartient au client, et « Programmé » déclenche la publication automatique de 16h00 (heure de Bali).`,
    );
  }
  return found;
}

/** `AAAA-MM-JJ` réel, ou une erreur. */
export function parseDay(raw: unknown): string {
  const text = String(raw ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = match ? new Date(`${text}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`Date illisible : « ${text} ». Format attendu : AAAA-MM-JJ.`);
  }
  return text;
}
