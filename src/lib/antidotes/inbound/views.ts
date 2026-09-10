/**
 * Les deux façons de regarder l'inbound : le tableau, ou le mois.
 *
 * Il y en avait six. Radar, studio, bibliothèque, sujets et consignes étaient
 * cinq écrans pour un seul geste — regarder ce qui a marché, en tirer quelque
 * chose. Tout est revenu dans **le tableau** ; ce qui reste ici n'est plus
 * qu'un changement de représentation des mêmes lignes, et les réglages sont
 * passés dans des fenêtres (Comptes, Prompts, Filtres).
 *
 * Ni `"use client"` ni `server-only` : la page serveur lit `?vue=`, la barre
 * cliente rend la bascule.
 */

export const INBOUND_VIEWS = [
  { key: "tableau", label: "Tableau" },
  { key: "calendrier", label: "Calendrier" },
] as const;

export type InboundView = (typeof INBOUND_VIEWS)[number]["key"];

export function parseInboundView(raw: string | undefined | null): InboundView {
  return raw === "calendrier" ? "calendrier" : "tableau";
}
