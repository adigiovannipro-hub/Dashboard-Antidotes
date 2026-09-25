/**
 * Une ligne de l'historique servi au prompt d'intentions — **module pur**.
 *
 * L'historique ne portait que la date, le réseau, le format et le titre. Le
 * modèle savait qu'un « CARROUSEL » s'appelait « JACKIE COULEURS VERRES »,
 * pas que c'était huit photos d'une monture déclinée en coloris : il a donc
 * proposé à Bondet des carrousels pédagogiques à slides de texte, une forme
 * que la marque ne publie pas (25/09/2026). Le nombre de visuels et la
 * légende disent ce qu'est un format chez ce client — c'est ce qu'il doit
 * reproduire.
 */

import { WORDING_PENDING_STATUSES } from "./wording-state";

/** Assez pour lire l'intention d'une légende, pas assez pour noyer trois mois. */
export const CAPTION_EXCERPT_LENGTH = 220;

/** Une légende sur une ligne, coupée au mot, ou `null` si elle est vide. */
export function captionExcerpt(
  text: string | null,
  max: number = CAPTION_EXCERPT_LENGTH,
): string | null {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat === "") return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type HistorySubject = {
  date: string | null;
  platform: string;
  format: string;
  name: string;
  status: string;
  visuals: number;
  wording: string | null;
};

/**
 * La ligne d'un sujet passé, mesure exclue — elle se greffe derrière.
 *
 * La cellule d'un sujet encore en attente de rédaction porte un brief, pas
 * une légende : elle dirait ce qui était prévu, pas ce qui a été publié, et
 * n'entre donc pas.
 */
export function historyLine(subject: HistorySubject): string {
  const visuals =
    subject.visuals > 0
      ? ` · ${subject.visuals} visuel${subject.visuals > 1 ? "s" : ""}`
      : "";
  const line = `- ${subject.date ?? "sans date"} · ${subject.platform} · ${subject.format} · « ${subject.name} »${visuals}`;
  const isBrief = (WORDING_PENDING_STATUSES as string[]).includes(subject.status);
  const caption = isBrief ? null : captionExcerpt(subject.wording);
  return caption ? `${line}\n  Légende : « ${caption} »` : line;
}
