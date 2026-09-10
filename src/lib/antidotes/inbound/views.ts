/**
 * Les vues de la page inbound — la même idée que les onglets d'un espace :
 * une liste, lue par la barre de vues et par la page qui la sert. Un nom
 * ajouté ici apparaît à l'écran sans autre retouche.
 *
 * Ni `"use client"` ni `server-only` : la page serveur lit `?vue=`, la barre
 * cliente rend les onglets.
 */

export const INBOUND_VIEWS = [
  { key: "contenus", label: "Contenus" },
  { key: "comptes", label: "Comptes" },
  { key: "sujets", label: "Sujets" },
  { key: "mes-posts", label: "Mes posts" },
  { key: "calendrier", label: "Calendrier" },
  { key: "consignes", label: "Consignes" },
] as const;

export type InboundView = (typeof INBOUND_VIEWS)[number]["key"];

export function parseInboundView(raw: string | undefined): InboundView {
  return INBOUND_VIEWS.some((view) => view.key === raw) ? (raw as InboundView) : "contenus";
}
