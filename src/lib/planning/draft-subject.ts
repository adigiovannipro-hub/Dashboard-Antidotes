/**
 * La ligne qu'affiche « Ajouter une publication » avant que le serveur ne
 * réponde — module pur.
 *
 * L'identifiant naît dans le navigateur et part avec la création : la ligne
 * du serveur porte donc le même, et React garde la même ligne à l'écran quand
 * elle arrive — curseur, saisie en cours et focus compris. Avant, un fantôme
 * grisé occupait la place pendant tout l'aller-retour, et rien ne pouvait
 * s'y taper.
 *
 * Les valeurs par défaut sont celles de la table (`0006_planning_schema`) :
 * statut « — », format post, aucun visuel, aucune colonne ajoutée remplie.
 */

import type { PlanningLane, SubjectRow } from "./types";

export function draftSubject(input: {
  id: string;
  lane: PlanningLane;
  /** Le mois du couloir, `YYYY-MM-01`. */
  monthKey: string;
  position: number;
  /** Horodatage ISO — passé en argument, le module reste pur. */
  now: string;
}): SubjectRow {
  return {
    id: input.id,
    lane_id: input.lane.id,
    month_id: input.lane.month_id,
    board_id: input.lane.board_id,
    workspace_id: input.lane.workspace_id,
    name: "",
    status: "idea",
    format: "post",
    scheduled_on: null,
    wording: null,
    sponsoring: null,
    ad_objective: null,
    ad_status: null,
    owner_id: null,
    visual_urls: [],
    custom: {},
    position: input.position,
    archived_at: null,
    deleted_at: null,
    created_at: input.now,
    updated_at: input.now,
    updated_by: null,
    platform: input.lane.platform,
    lane_name: input.lane.name,
    month_key: input.monthKey,
    owner: null,
    comments: [],
    visuals: [],
    updater: null,
    updated_label: "à l'instant",
  };
}

/** La position qui suit la dernière ligne du couloir. */
export function nextPosition(subjects: { position: number }[]): number {
  return subjects.reduce((max, subject) => Math.max(max, subject.position), -1) + 1;
}

/**
 * Les lignes du serveur, puis les brouillons qu'il n'a pas encore rendus.
 *
 * Un brouillon dont l'identifiant est déjà dans la liste est la même ligne :
 * le garder la doublerait le temps d'un rendu.
 */
export function withDrafts(subjects: SubjectRow[], drafts: SubjectRow[]): SubjectRow[] {
  const known = new Set(subjects.map((subject) => subject.id));
  return [...subjects, ...drafts.filter((draft) => !known.has(draft.id))];
}
