/**
 * La réponse du prompt d'intentions, lue et rapprochée du planning — **module
 * pur**, zéro import Supabase.
 *
 * Le prompt rend du texte, pas du JSON : un bloc par publication, délimité par
 * `---`, aux clés fixes (`PLATEFORME :`, `DATE :`, `FORMAT :`, `NOM :`,
 * `STATUT :`, `SPONSO : … | OBJECTIF : …`, `WORDING :`, `SOURCES :`), puis
 * quatre rubriques de fin — récapitulatif, rotation, points signalés, éléments
 * à marquer utilisés. C'est le format écrit par l'utilisateur, lisible tel
 * quel ; la lecture tolère ce qu'un modèle ajoute autour (gras markdown,
 * dièses de titre, jour de la semaine après la date) et rien de plus.
 */

import { formatForCategory, platformForNetwork } from "./quotas";
import type { PlanningFormat, PlanningPlatform } from "@/lib/planning/types";

export type IntentionStatus = "existant" | "a_creer";

export type ParsedIntention = {
  plateforme: string;
  /** `YYYY-MM-DD`, ou `null` si la ligne n'en porte pas de lisible. */
  date: string | null;
  format: string;
  nom: string;
  statut: IntentionStatus;
  sponso: number | null;
  objectif: string | null;
  wording: string;
  sources: string;
};

export type IntentionsNotes = {
  recapitulatif: string;
  rotation: string;
  pointsSignales: string;
  elementsUtilises: string;
};

export type IntentionsOutput = {
  items: ParsedIntention[];
  notes: IntentionsNotes;
};

const ITEM_KEYS = [
  "PLATEFORME",
  "DATE",
  "FORMAT",
  "NOM",
  "STATUT",
  "SPONSO",
  "WORDING",
  "SOURCES",
] as const;
type ItemKey = (typeof ITEM_KEYS)[number];

const NOTE_KEYS: Record<string, keyof IntentionsNotes> = {
  RECAPITULATIF: "recapitulatif",
  ROTATION: "rotation",
  "POINTS SIGNALES": "pointsSignales",
  "ELEMENTS A MARQUER UTILISES": "elementsUtilises",
};

function unaccent(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Une ligne sans ses décorations markdown de tête et de queue. */
function bare(line: string): string {
  return line.replace(/^[#*_>\s]+/, "").replace(/[*_\s]+$/, "");
}

/**
 * `CLÉ : reste` si la ligne ouvre une clé — accents indifférents. `upper` dit
 * si la clé était écrite en capitales, comme le format l'exige : « Rotation :
 * les montures tournent » dans un wording n'ouvre pas la rubrique ROTATION.
 */
function keyOf(line: string): { key: string; rest: string; upper: boolean } | null {
  const match = /^([A-Za-zÀ-ÿ ]+?)\s*:\s*(.*)$/.exec(bare(line));
  if (!match) return null;
  const raw = match[1]!.trim();
  return {
    key: unaccent(raw).toUpperCase(),
    rest: match[2]!.trim(),
    upper: raw === raw.toUpperCase(),
  };
}

function isSeparator(line: string): boolean {
  return /^\s*-{3,}\s*$/.test(line);
}

function parseAmount(raw: string): number | null {
  const match = /(\d[\d\s  ]*(?:[.,]\d+)?)/.exec(raw);
  if (!match) return null;
  const value = Number(match[1]!.replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function cleanBlock(lines: string[]): string {
  return lines
    .filter((line) => !isSeparator(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toItem(fields: Partial<Record<ItemKey, string>>, wording: string[]): ParsedIntention | null {
  const nom = bare(fields.NOM ?? "").replace(/^\[|\]$/g, "").trim();
  if (nom === "") return null;

  const statutRaw = unaccent(fields.STATUT ?? "").toUpperCase();
  const statut: IntentionStatus = statutRaw.includes("EXISTANT") ? "existant" : "a_creer";

  // `SPONSO : 50 € | OBJECTIF : Engagement` — les deux vivent sur la même ligne.
  const [sponsoPart = "", ...rest] = (fields.SPONSO ?? "").split("|");
  const objectifMatch = /OBJECTIF\s*:\s*(.*)$/i.exec(rest.join("|"));
  const objectif = objectifMatch ? objectifMatch[1]!.trim() : "";

  return {
    plateforme: bare(fields.PLATEFORME ?? ""),
    date: /(\d{4}-\d{2}-\d{2})/.exec(fields.DATE ?? "")?.[1] ?? null,
    format: bare(fields.FORMAT ?? ""),
    nom,
    statut,
    sponso: parseAmount(sponsoPart),
    objectif: objectif === "" || /^vide$/i.test(objectif) ? null : objectif,
    wording: cleanBlock(wording),
    sources: (fields.SOURCES ?? "").trim(),
  };
}

/**
 * Lit la réponse entière : les blocs de publication, puis les rubriques de fin.
 *
 * Un bloc commence à `PLATEFORME :` et s'arrête au suivant ou à la première
 * rubrique de fin ; le `WORDING` court jusqu'à `SOURCES :` ou la fin du bloc,
 * sur autant de lignes qu'il en faut — un carrousel s'écrit slide par slide.
 */
export function parseIntentionsOutput(text: string): IntentionsOutput {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const items: ParsedIntention[] = [];
  const notes: IntentionsNotes = {
    recapitulatif: "",
    rotation: "",
    pointsSignales: "",
    elementsUtilises: "",
  };

  let fields: Partial<Record<ItemKey, string>> | null = null;
  let wording: string[] = [];
  let inWording = false;
  let note: keyof IntentionsNotes | null = null;
  const noteLines: Record<keyof IntentionsNotes, string[]> = {
    recapitulatif: [],
    rotation: [],
    pointsSignales: [],
    elementsUtilises: [],
  };

  const flush = () => {
    if (fields) {
      const item = toItem(fields, wording);
      if (item) items.push(item);
    }
    fields = null;
    wording = [];
    inWording = false;
  };

  for (const line of lines) {
    if (isSeparator(line)) {
      inWording = false;
      continue;
    }

    const parsed = keyOf(line);
    const noteKey = parsed?.upper ? NOTE_KEYS[parsed.key] : undefined;

    if (noteKey) {
      flush();
      note = noteKey;
      if (parsed!.rest) noteLines[noteKey].push(parsed!.rest);
      continue;
    }

    if (parsed?.upper && parsed.key === "PLATEFORME") {
      flush();
      note = null;
      fields = { PLATEFORME: parsed.rest };
      continue;
    }

    if (fields) {
      if (parsed && (ITEM_KEYS as readonly string[]).includes(parsed.key) && !(inWording && parsed.key !== "SOURCES")) {
        const key = parsed.key as ItemKey;
        if (key === "WORDING") {
          inWording = true;
          if (parsed.rest) wording.push(parsed.rest);
        } else {
          inWording = false;
          fields[key] = parsed.rest;
        }
        continue;
      }
      if (inWording) {
        wording.push(line);
        continue;
      }
      // Une ligne libre hors wording, dans un bloc : le séparateur, ou du bruit.
      continue;
    }

    if (note) noteLines[note].push(line);
  }
  flush();

  for (const key of Object.keys(noteLines) as (keyof IntentionsNotes)[]) {
    notes[key] = cleanBlock(noteLines[key]);
  }
  return { items, notes };
}

// --- Rapprochement avec le planning -------------------------------------------

/**
 * Le format du planning que désigne le libellé de la fiche.
 *
 * Le libellé exact d'abord (`formatForCategory`, le même rapprochement que le
 * décompte des livrables), puis un mot-clé contenu — « Quiz story » est une
 * story, « Carrousel produit » un carrousel. Rien de reconnu : `other`, qui se
 * voit au planning, plutôt qu'un format deviné.
 */
export function formatFromLabel(label: string): PlanningFormat {
  const exact = formatForCategory(label);
  if (exact) return exact;
  const key = unaccent(label).toLowerCase();
  if (/carrou?sel|carousel/.test(key)) return "carousel";
  if (/stor(y|ie)/.test(key)) return "story";
  if (/reel|short/.test(key)) return "reel";
  if (/video/.test(key)) return "video";
  if (/post|photo|visuel/.test(key)) return "post";
  return "other";
}

/**
 * Le couloir où ranger une publication : le réseau nommé s'il a déjà son
 * couloir ce mois-ci, sinon le parapluie META pour Instagram ou Facebook quand
 * c'est lui qui existe — le board d'origine range les deux sous META, et un
 * couloir « Instagram » ouvert à côté éclaterait le mois en deux.
 */
export function lanePlatformFor(
  label: string,
  existing: PlanningPlatform[],
): PlanningPlatform {
  const key = unaccent(label).toUpperCase().trim();
  const named = platformForNetwork(label) ?? (key.includes("META") ? "meta" : null);
  if (!named) return existing.length === 1 ? existing[0]! : "other";
  if (existing.includes(named)) return named;
  if ((named === "instagram" || named === "facebook") && existing.includes("meta")) return "meta";
  if (named === "meta") {
    const member = existing.find((platform) => platform === "instagram" || platform === "facebook");
    if (member) return member;
  }
  return named;
}

/** Un nom pour comparer deux sujets : casse, accents et ponctuation ignorés. */
export function subjectKey(name: string): string {
  return unaccent(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// --- Rendu pour le prompt ------------------------------------------------------

export type Coquille = {
  date: string | null;
  platform: string;
  format: string;
  name: string;
  status: string;
  visuals: number;
  wording: string | null;
};

/**
 * Les coquilles du mois cible, telles que le prompt les reçoit : tout ce qui
 * est déjà posé, avec sa consigne éventuelle — c'est elle que la génération
 * doit compléter, sans toucher au nom ni à la date.
 */
export function renderCoquilles(coquilles: Coquille[]): string {
  if (coquilles.length === 0) return "";
  return coquilles
    .slice()
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .map((item) => {
      const visuals = item.visuals > 0 ? `, ${item.visuals} visuel${item.visuals > 1 ? "s" : ""}` : "";
      const head = `- ${item.date ?? "sans date"} · ${item.platform} · ${item.format} · « ${item.name} » (statut ${item.status}${visuals})`;
      const wording = (item.wording ?? "").trim();
      return wording ? `${head}\n  Wording actuel : ${wording.replace(/\s*\n\s*/g, " / ")}` : `${head}\n  Wording actuel : vide`;
    })
    .join("\n");
}

/** Les rubriques de fin, en un texte : ce que le journal et le job gardent. */
export function renderNotes(notes: IntentionsNotes): string {
  return [
    ["RÉCAPITULATIF", notes.recapitulatif],
    ["ROTATION", notes.rotation],
    ["POINTS SIGNALÉS", notes.pointsSignales],
    ["ÉLÉMENTS À MARQUER UTILISÉS", notes.elementsUtilises],
  ]
    .filter(([, value]) => value.trim() !== "")
    .map(([title, value]) => `${title} :\n${value}`)
    .join("\n\n");
}

/** Vrai quand les points signalés disent quelque chose d'autre que « aucun ». */
export function hasSignaledPoints(notes: IntentionsNotes): boolean {
  const value = unaccent(notes.pointsSignales).trim().toLowerCase().replace(/[.\s]+$/, "");
  return value !== "" && value !== "aucun";
}
