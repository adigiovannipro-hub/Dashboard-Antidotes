/**
 * Ce qu'une séquence vaut par défaut — trois emails, J+0 / J+4 / J+9, comme
 * le cahier des charges l'écrit — et la forme complète de ses réglages.
 *
 * Les gabarits proposés sont courts et sans promesse : le vrai travail de
 * ton est celui de l'utilisateur, qui les réécrit dans l'écran. Ils servent
 * surtout à montrer les variables.
 */

import { DEFAULT_SEND_WINDOW, type SendWindow } from "./schedule";

export type SequenceSettings = {
  /** La landing du case study, injectée par `{{lien_case_study}}`. */
  case_study_url: string | null;
  /** Emails au plus par jour de Paris pour cette séquence. */
  daily_cap: number;
  send_window: SendWindow;
  /** Le nom qui signe — `{{expediteur}}` et le `From` affiché. */
  sender_name: string | null;
  /** Le message pré-rédigé de la piste LinkedIn (contacts `risky`). */
  linkedin_message: string;
  /** L'observation doit-elle être prête avant le premier envoi ? */
  require_observation: boolean;
};

export const DEFAULT_DAILY_CAP = 25;

export const DEFAULT_LINKEDIN_MESSAGE =
  "Bonjour {{prenom|à vous}}, je suis tombé sur {{societe}} en regardant ce qui se fait autour de {{secteur|votre métier}}. {{observation|J'aimerais échanger sur votre communication.}} Je vous propose un échange de quinze minutes si le sujet vous parle.";

export function resolveSequenceSettings(raw: unknown): SequenceSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const window = (source.send_window && typeof source.send_window === "object"
    ? source.send_window
    : {}) as Partial<SendWindow>;
  const days = Array.isArray(window.days)
    ? window.days.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7)
    : DEFAULT_SEND_WINDOW.days;
  const cap = Number(source.daily_cap);
  return {
    case_study_url: typeof source.case_study_url === "string" && source.case_study_url.trim()
      ? source.case_study_url.trim()
      : null,
    daily_cap: Number.isInteger(cap) && cap > 0 ? Math.min(cap, 500) : DEFAULT_DAILY_CAP,
    send_window: {
      days,
      start_hour: clampHour(window.start_hour, DEFAULT_SEND_WINDOW.start_hour),
      end_hour: clampHour(window.end_hour, DEFAULT_SEND_WINDOW.end_hour),
    },
    sender_name: typeof source.sender_name === "string" && source.sender_name.trim()
      ? source.sender_name.trim()
      : null,
    linkedin_message:
      typeof source.linkedin_message === "string" && source.linkedin_message.trim()
        ? source.linkedin_message
        : DEFAULT_LINKEDIN_MESSAGE,
    require_observation: source.require_observation === true,
  };
}

function clampHour(value: unknown, fallback: number): number {
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 24 ? hour : fallback;
}

export type DefaultStep = { position: number; delay_days: number; subject_template: string; body_template: string };

export const DEFAULT_STEPS: DefaultStep[] = [
  {
    position: 1,
    delay_days: 0,
    subject_template: "{{societe}} et ce qu'on a fait pour un concurrent",
    body_template:
      "Bonjour {{prenom|à vous}},\n\n{{observation}}\n\nOn accompagne des marques comme la vôtre sur les réseaux, et le dernier cas ressemble beaucoup à {{societe}} : {{lien_case_study}}\n\nSi c'est un sujet pour vous ce trimestre, je vous propose quinze minutes pour vous montrer ce qui a marché.\n\n{{expediteur}}",
  },
  {
    position: 2,
    delay_days: 4,
    subject_template: "{{societe}} et ce qu'on a fait pour un concurrent",
    body_template:
      "Bonjour {{prenom|à vous}},\n\nJe me permets de revenir vers vous : le cas que je vous ai envoyé montre le détail des chiffres, mois par mois.\n\nSi le moment est mal choisi, dites-le-moi et je ne vous relance pas.\n\n{{expediteur}}",
  },
  {
    position: 3,
    delay_days: 9,
    subject_template: "{{societe}} et ce qu'on a fait pour un concurrent",
    body_template:
      "Bonjour {{prenom|à vous}},\n\nDernier message de ma part. Si {{societe}} veut structurer sa présence sur les réseaux cette année, je suis à un email.\n\nBonne continuation,\n{{expediteur}}",
  },
];
