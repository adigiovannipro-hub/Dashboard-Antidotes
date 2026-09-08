/**
 * Amorçage des données de démonstration du pôle Antidotes (phases 1 à 4).
 *
 *   pnpm seed:antidotes          pose ou met à jour le jeu
 *   pnpm seed:antidotes --reset  l'efface entièrement
 *
 * Sert à *regarder* les six écrans remplis — pipeline, sourcing, séquences,
 * radar, studio, bibliothèque — avant qu'un vrai passage ne les remplisse.
 * Rien ici n'est mesuré : ce sont des sociétés, des personnes et des chiffres
 * inventés, cohérents d'un écran à l'autre pour que le parcours se juge.
 *
 * Tous les identifiants sont dérivés d'un SHA-256 du namespace
 * `antidotes-demo:` — d'où l'idempotence (rejouer ne double rien) et la
 * purge exacte (`--reset` ne supprime que ces lignes-là, jamais un vrai
 * prospect posé à côté).
 *
 * Les dates sont relatives au jour du lancement : rejouer recale la démo.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

/** UUID stable dérivé d'une clé : rejouer l'amorçage ne recrée rien. */
function stableId(key: string): string {
  const hex = createHash("sha256").update(`antidotes-demo:${key}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

const DAY = 86_400_000;
const now = Date.now();
/** Un instant à N jours d'ici — négatif dans le passé, positif à venir. */
const at = (days: number, hour = 9): string =>
  new Date(new Date(now + days * DAY).setUTCHours(hour, 0, 0, 0)).toISOString();

// --- Campagnes de sourcing ---------------------------------------------------

type CampaignSeed = {
  key: string;
  name: string;
  engine: "maps" | "ecommerce";
  reference_client: string | null;
  source_params: Record<string, unknown>;
  filters: Record<string, unknown>;
  targeting: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
};

const CAMPAIGNS: CampaignSeed[] = [
  {
    key: "opticiens-lyon",
    name: "Opticiens — Lyon et couronne",
    engine: "maps",
    reference_client: "Bondet",
    source_params: {
      keywords: ["opticien", "lunetier", "optique"],
      cities: ["Lyon", "Villeurbanne", "Écully", "Bron", "Oullins"],
      radius_km: 12,
      max_places: 120,
      category: "Opticien",
      country: "FR",
    },
    filters: {
      size_tolerance: 0.4,
      require_ads: "bonus",
      countries: ["FR"],
      min_rating: 4.2,
      reference_sector: "Optique",
      reference_size: { reviews_count: 180 },
    },
    targeting: { marketing_threshold: 20, verification_ttl_days: 180 },
    is_active: true,
    last_run_at: at(-2, 5),
  },
  {
    key: "loisirs-indoor",
    name: "Loisirs indoor — Auvergne-Rhône-Alpes",
    engine: "maps",
    reference_client: "I-WAY",
    source_params: {
      keywords: ["karting indoor", "simulateur", "escape game", "bowling"],
      cities: ["Lyon", "Saint-Étienne", "Grenoble", "Annecy", "Clermont-Ferrand"],
      radius_km: 25,
      max_places: 80,
      category: "Loisirs",
      country: "FR",
    },
    filters: {
      size_tolerance: 0.5,
      require_ads: true,
      countries: ["FR"],
      min_rating: 4,
      reference_sector: "Loisirs indoor",
      reference_size: { reviews_count: 950 },
    },
    targeting: { marketing_threshold: 15, verification_ttl_days: 120 },
    is_active: true,
    last_run_at: at(-9, 5),
  },
  {
    /* Le moteur e-commerce n'a pas de source branchée : la campagne existe,
       « Lancer » refuse et le dit. C'est exactement ce qu'il faut montrer. */
    key: "ecommerce-lunetterie",
    name: "Boutiques en ligne — lunetterie",
    engine: "ecommerce",
    reference_client: "Bondet",
    source_params: { keywords: ["lunettes", "solaires"], country: "FR", traffic_min: 5000, traffic_max: 120000 },
    filters: { size_tolerance: 0.6, require_ads: "bonus", countries: ["FR"], reference_sector: "E-commerce lunetterie" },
    targeting: {},
    is_active: false,
    last_run_at: null,
  },
];

// --- Passages de sourcing ----------------------------------------------------

type RunSeed = {
  key: string;
  campaign: string;
  status: "done" | "error";
  stage: "done" | "discovering" | "verifying";
  started: number;
  finished: number;
  stats: Record<string, unknown>;
  errors: { at: string; step: string; message: string; prospect?: string }[];
};

const RUNS: RunSeed[] = [
  {
    key: "run-opticiens-3",
    campaign: "opticiens-lyon",
    status: "done",
    stage: "done",
    started: -2,
    finished: -2,
    stats: {
      sourced: 46, qualified: 14, to_review: 5, contact_found: 11, email_valid: 7, email_risky: 3,
      rejected: { "note trop basse": 12, "taille hors tolérance": 9, "pas de publicité active": 6 },
    },
    errors: [],
  },
  {
    key: "run-opticiens-2",
    campaign: "opticiens-lyon",
    status: "done",
    stage: "done",
    started: -16,
    finished: -16,
    stats: {
      sourced: 38, qualified: 9, to_review: 3, contact_found: 7, email_valid: 4, email_risky: 2,
      rejected: { "note trop basse": 14, "taille hors tolérance": 8, "déjà au pipeline": 4 },
    },
    errors: [{ at: at(-16, 5), step: "verifying", message: "Hunter : quota mensuel atteint, deux adresses non vérifiées." }],
  },
  {
    key: "run-loisirs-1",
    campaign: "loisirs-indoor",
    status: "error",
    stage: "discovering",
    started: -9,
    finished: -9,
    stats: { sourced: 22, qualified: 6, to_review: 2, contact_found: 2, email_valid: 1, email_risky: 0, rejected: { "pas de publicité active": 11 } },
    errors: [
      { at: at(-9, 5), step: "discovering", message: "Apify : l'acteur de recherche Google a rendu 429 (trop de requêtes). Passage repris au prochain tour." },
    ],
  },
];

// --- Prospects, contacts, journal --------------------------------------------

type ContactSeed = {
  first: string;
  last: string;
  role: string;
  email: string | null;
  email_status: "unknown" | "valid" | "risky" | "invalid";
  seniority: "founder" | "head_of" | "manager" | "other";
  discovery: "linkedin" | "legal_registry" | "website" | "inferred" | "manual";
  linkedin?: string;
  opted_out?: boolean;
};

type InteractionSeed = {
  type: "email_sent" | "email_open" | "email_click" | "reply" | "call" | "note" | "linkedin_dm" | "meeting" | "bounce" | "opt_out";
  days: number;
  payload: Record<string, unknown>;
  /* Les mesures d'une séquence se comptent sur les interactions qui portent
     son identifiant — c'est ce que le passage réel écrit. Sans lui, l'écran
     afficherait « 0 envoyé » sur des inscriptions pourtant parties. */
  sequence?: string;
};

type ProspectSeed = {
  key: string;
  campaign: string | null;
  source: "maps" | "shopify" | "linkedin" | "inbound" | "manual";
  company: string;
  city: string;
  sector: string;
  website?: string;
  status: "to_qualify" | "qualified" | "no_contact_found" | "contacted" | "replied" | "meeting" | "won" | "lost";
  score: number;
  reviews: number;
  rating?: number;
  ads: boolean;
  reference: string;
  notes?: string;
  contacts?: ContactSeed[];
  journal?: InteractionSeed[];
};

const PROSPECTS: ProspectSeed[] = [
  // — À qualifier : ce que le dernier passage a rapporté sans pouvoir trancher.
  {
    key: "optique-belle-vue", campaign: "opticiens-lyon", source: "maps", company: "Optique Belle Vue",
    city: "Villeurbanne", sector: "Optique", website: "https://optique-bellevue.fr", status: "to_qualify",
    score: 40, reviews: 143, rating: 4.4, ads: false, reference: "Bondet",
    notes: "Ad Library muette : impossible de dire si la boutique diffuse.",
  },
  {
    key: "lunetier-des-terreaux", campaign: "opticiens-lyon", source: "maps", company: "Le Lunetier des Terreaux",
    city: "Lyon 1er", sector: "Optique", website: "https://lunetier-terreaux.fr", status: "to_qualify",
    score: 30, reviews: 96, rating: 4.7, ads: false, reference: "Bondet",
  },
  {
    key: "vision-croix-rousse", campaign: "opticiens-lyon", source: "maps", company: "Vision Croix-Rousse",
    city: "Lyon 4e", sector: "Optique", status: "to_qualify", score: 30, reviews: 211, rating: 4.3, ads: false,
    reference: "Bondet", notes: "Site vitrine sans mentions légales : pas de nom de dirigeant.",
  },
  {
    key: "kart-arena-annecy", campaign: "loisirs-indoor", source: "maps", company: "Kart Arena Annecy",
    city: "Annecy", sector: "Loisirs indoor", website: "https://kartarena-annecy.fr", status: "to_qualify",
    score: 40, reviews: 640, rating: 4.5, ads: true, reference: "I-WAY",
  },

  // — Qualifiés : décisionnaire trouvé, prêts pour une séquence.
  {
    key: "atelier-du-regard", campaign: "opticiens-lyon", source: "maps", company: "L'Atelier du Regard",
    city: "Lyon 6e", sector: "Optique", website: "https://atelier-du-regard.fr", status: "qualified",
    score: 100, reviews: 187, rating: 4.8, ads: true, reference: "Bondet",
    notes: "Deux boutiques, campagnes Meta en continu depuis mars.",
    contacts: [{ first: "Camille", last: "Rousset", role: "Cofondatrice", email: "camille.rousset@atelier-du-regard.fr", email_status: "valid", seniority: "founder", discovery: "linkedin", linkedin: "https://www.linkedin.com/in/camille-rousset-optique/" }],
  },
  {
    key: "optic-presquile", campaign: "opticiens-lyon", source: "maps", company: "Optic Presqu'île",
    city: "Lyon 2e", sector: "Optique", website: "https://optic-presquile.fr", status: "qualified",
    score: 90, reviews: 205, rating: 4.6, ads: true, reference: "Bondet",
    contacts: [{ first: "Nicolas", last: "Béraud", role: "Gérant", email: "nicolas.beraud@optic-presquile.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry" }],
  },
  {
    key: "lunettes-co-ecully", campaign: "opticiens-lyon", source: "maps", company: "Lunettes & Co",
    city: "Écully", sector: "Optique", website: "https://lunettesandco.fr", status: "qualified",
    score: 70, reviews: 132, rating: 4.5, ads: false, reference: "Bondet",
    contacts: [{ first: "Sophie", last: "Marchand", role: "Responsable marketing", email: "sophie.marchand@lunettesandco.fr", email_status: "risky", seniority: "head_of", discovery: "website", linkedin: "https://www.linkedin.com/in/sophie-marchand-mkt/" }],
    notes: "Adresse en catch-all : la piste part sur LinkedIn, pas par mail.",
  },
  {
    key: "regard-neuf", campaign: "opticiens-lyon", source: "maps", company: "Regard Neuf",
    city: "Bron", sector: "Optique", status: "qualified", score: 70, reviews: 168, rating: 4.4, ads: true,
    reference: "Bondet",
    contacts: [{ first: "Émilie", last: "Fauvel", role: "Directrice", email: "emilie.fauvel@regardneuf.fr", email_status: "valid", seniority: "founder", discovery: "linkedin" }],
  },
  {
    key: "escape-lyon-sud", campaign: "loisirs-indoor", source: "maps", company: "Escape Lyon Sud",
    city: "Oullins", sector: "Loisirs indoor", website: "https://escapelyonsud.fr", status: "qualified",
    score: 90, reviews: 880, rating: 4.7, ads: true, reference: "I-WAY",
    contacts: [{ first: "Julien", last: "Peyrard", role: "Cofondateur", email: "julien.peyrard@escapelyonsud.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry" }],
  },
  {
    key: "bowling-grand-est", campaign: "loisirs-indoor", source: "maps", company: "Bowling du Grand Large",
    city: "Grenoble", sector: "Loisirs indoor", status: "qualified", score: 70, reviews: 1240, rating: 4.2, ads: true,
    reference: "I-WAY",
    contacts: [{ first: "Marc", last: "Delorme", role: "Responsable communication", email: "marc.delorme@bowling-grandlarge.fr", email_status: "valid", seniority: "manager", discovery: "website" }],
  },

  // — Sans contact : le passage a tout tenté, personne n'est nommé.
  {
    key: "optique-part-dieu", campaign: "opticiens-lyon", source: "maps", company: "Optique Part-Dieu",
    city: "Lyon 3e", sector: "Optique", status: "no_contact_found", score: 50, reviews: 240, rating: 4.3, ads: true,
    reference: "Bondet", notes: "Franchise : aucune adresse nominative, seulement la boîte du réseau.",
  },
  {
    key: "laser-game-valence", campaign: "loisirs-indoor", source: "maps", company: "Laser Game Valence",
    city: "Valence", sector: "Loisirs indoor", status: "no_contact_found", score: 40, reviews: 410, rating: 4.1, ads: false,
    reference: "I-WAY",
  },

  // — Contactés : la séquence tourne.
  {
    key: "maison-optique-chambery", campaign: "opticiens-lyon", source: "maps", company: "Maison Optique Chambéry",
    city: "Chambéry", sector: "Optique", website: "https://maisonoptique-chambery.fr", status: "contacted",
    score: 100, reviews: 176, rating: 4.9, ads: true, reference: "Bondet",
    contacts: [{ first: "Laure", last: "Vignon", role: "Fondatrice", email: "laure.vignon@maisonoptique-chambery.fr", email_status: "valid", seniority: "founder", discovery: "linkedin" }],
    journal: [
      { type: "note", days: -12, payload: { text: "Trois boutiques, une identité forte, aucun compte Instagram actif depuis janvier." } },
      { type: "email_sent", days: -8, sequence: "concurrents-optique", payload: { subject: "Maison Optique et ce qu'on a fait pour un concurrent", message_id: "<demo-1@antidotes>" } },
      { type: "email_open", days: -8, payload: {} },
      { type: "email_sent", days: -4, sequence: "concurrents-optique", payload: { subject: "Maison Optique et ce qu'on a fait pour un concurrent", message_id: "<demo-2@antidotes>" } },
    ],
  },
  {
    key: "opticien-saint-etienne", campaign: "opticiens-lyon", source: "maps", company: "L'Opticien Stéphanois",
    city: "Saint-Étienne", sector: "Optique", status: "contacted", score: 90, reviews: 154, rating: 4.6, ads: true,
    reference: "Bondet",
    contacts: [{ first: "Antoine", last: "Bonnet", role: "Gérant", email: "antoine.bonnet@opticien-stephanois.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry" }],
    journal: [
      { type: "email_sent", days: -6, sequence: "concurrents-optique", payload: { subject: "L'Opticien Stéphanois et ce qu'on a fait pour un concurrent", message_id: "<demo-3@antidotes>" } },
      { type: "email_open", days: -5, payload: {} },
      { type: "email_click", days: -5, payload: { url: "https://antidotes.studio/cas/bondet" } },
    ],
  },
  {
    key: "vue-alpine", campaign: "opticiens-lyon", source: "maps", company: "Vue Alpine",
    city: "Grenoble", sector: "Optique", status: "contacted", score: 70, reviews: 121, rating: 4.4, ads: false,
    reference: "Bondet",
    contacts: [{ first: "Pauline", last: "Gérard", role: "Responsable marketing", email: "pauline.gerard@vuealpine.fr", email_status: "risky", seniority: "head_of", discovery: "linkedin", linkedin: "https://www.linkedin.com/in/pauline-gerard-vuealpine/" }],
    journal: [{ type: "linkedin_dm", days: -3, payload: { text: "Message d'accroche envoyé à la main depuis LinkedIn." } }],
  },
  {
    key: "trampoline-park-lyon", campaign: "loisirs-indoor", source: "maps", company: "Trampoline Park Lyon",
    city: "Vénissieux", sector: "Loisirs indoor", status: "contacted", score: 90, reviews: 1580, rating: 4.4, ads: true,
    reference: "I-WAY",
    contacts: [{ first: "Kevin", last: "Traoré", role: "Directeur", email: "kevin.traore@trampolinepark-lyon.fr", email_status: "valid", seniority: "head_of", discovery: "website" }],
    journal: [
      { type: "email_sent", days: -10, sequence: "loisirs-indoor", payload: { subject: "Trampoline Park et ce qu'on a fait pour un concurrent", message_id: "<demo-4@antidotes>" } },
      { type: "email_sent", days: -5, sequence: "loisirs-indoor", payload: { subject: "Trampoline Park et ce qu'on a fait pour un concurrent", message_id: "<demo-5@antidotes>" } },
      { type: "note", days: -2, payload: { text: "Relance 3 prévue lundi ; sinon on passe la main." } },
    ],
  },
  {
    key: "optique-du-lac", campaign: "opticiens-lyon", source: "maps", company: "Optique du Lac",
    city: "Annecy", sector: "Optique", status: "contacted", score: 70, reviews: 98, rating: 4.8, ads: false,
    reference: "Bondet",
    contacts: [{ first: "Hélène", last: "Ducret", role: "Gérante", email: "helene.ducret@optiquedulac.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry", opted_out: true }],
    notes: "Désinscription au premier envoi : plus jamais de mail, la ligne reste pour mémoire.",
    journal: [
      { type: "email_sent", days: -7, sequence: "concurrents-optique", payload: { subject: "Optique du Lac et ce qu'on a fait pour un concurrent", message_id: "<demo-6@antidotes>" } },
      { type: "opt_out", days: -6, sequence: "concurrents-optique", payload: { text: "Désinscription par le lien en pied de message." } },
    ],
  },

  {
    key: "optique-horizon", campaign: "opticiens-lyon", source: "maps", company: "Optique Horizon",
    city: "Lyon 5e", sector: "Optique", status: "contacted", score: 70, reviews: 134, rating: 4.5, ads: true,
    reference: "Bondet", notes: "Adresse rebondie au premier envoi : la piste repart sur LinkedIn.",
    contacts: [{ first: "Manon", last: "Sabatier", role: "Gérante", email: "manon.sabatier@optique-horizon.fr", email_status: "invalid", seniority: "founder", discovery: "inferred", linkedin: "https://www.linkedin.com/in/manon-sabatier-optique/" }],
    journal: [
      { type: "email_sent", days: -5, sequence: "concurrents-optique", payload: { subject: "Optique Horizon et ce qu'on a fait pour un concurrent", message_id: "<demo-14@antidotes>" } },
      { type: "bounce", days: -5, sequence: "concurrents-optique", payload: { from: "mailer-daemon@googlemail.com", subject: "Address not found", snippet: "550 5.1.1 The email account that you tried to reach does not exist." } },
    ],
  },

  // — Réponses.
  {
    key: "optique-mercier", campaign: "opticiens-lyon", source: "maps", company: "Optique Mercier",
    city: "Lyon 7e", sector: "Optique", website: "https://optique-mercier.fr", status: "replied",
    score: 100, reviews: 193, rating: 4.7, ads: true, reference: "Bondet",
    contacts: [{ first: "Thomas", last: "Mercier", role: "Fondateur", email: "thomas.mercier@optique-mercier.fr", email_status: "valid", seniority: "founder", discovery: "linkedin", linkedin: "https://www.linkedin.com/in/thomas-mercier-optique/" }],
    journal: [
      { type: "email_sent", days: -14, sequence: "concurrents-optique", payload: { subject: "Optique Mercier et ce qu'on a fait pour un concurrent", message_id: "<demo-7@antidotes>" } },
      { type: "reply", days: -11, sequence: "concurrents-optique", payload: { text: "Intéressé, mais pas avant la rentrée. Relancez-moi fin septembre." } },
      { type: "note", days: -11, payload: { text: "Relance calée fin septembre — sortie de séquence." } },
    ],
  },
  {
    key: "atelier-lunettes-clermont", campaign: "opticiens-lyon", source: "maps", company: "Atelier Lunettes Clermont",
    city: "Clermont-Ferrand", sector: "Optique", status: "replied", score: 90, reviews: 147, rating: 4.5, ads: true,
    reference: "Bondet",
    contacts: [{ first: "Sarah", last: "Lemoine", role: "Cofondatrice", email: "sarah.lemoine@atelier-clermont.fr", email_status: "valid", seniority: "founder", discovery: "website" }],
    journal: [
      { type: "email_sent", days: -9, sequence: "concurrents-optique", payload: { subject: "Atelier Lunettes et ce qu'on a fait pour un concurrent", message_id: "<demo-8@antidotes>" } },
      { type: "reply", days: -6, sequence: "concurrents-optique", payload: { text: "On a déjà une agence, mais le reporting ne suit pas. Vous faites ça aussi ?" } },
    ],
  },
  {
    key: "indoor-golf-lyon", campaign: "loisirs-indoor", source: "maps", company: "Indoor Golf Lyon",
    city: "Lyon 9e", sector: "Loisirs indoor", status: "replied", score: 70, reviews: 320, rating: 4.6, ads: false,
    reference: "I-WAY",
    contacts: [{ first: "Rémi", last: "Chastel", role: "Gérant", email: "remi.chastel@indoorgolf-lyon.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry" }],
    journal: [
      { type: "email_sent", days: -13, sequence: "loisirs-indoor", payload: { subject: "Indoor Golf et ce qu'on a fait pour un concurrent", message_id: "<demo-9@antidotes>" } },
      { type: "reply", days: -10, sequence: "loisirs-indoor", payload: { text: "Envoyez-moi vos tarifs." } },
      { type: "call", days: -9, payload: { text: "Appel de dix minutes : budget 1 200 €/mois, décision en septembre." } },
    ],
  },

  // — Rendez-vous, gagné, perdu.
  {
    key: "optique-des-brotteaux", campaign: "opticiens-lyon", source: "maps", company: "Optique des Brotteaux",
    city: "Lyon 6e", sector: "Optique", website: "https://optique-brotteaux.fr", status: "meeting",
    score: 100, reviews: 214, rating: 4.8, ads: true, reference: "Bondet",
    contacts: [{ first: "Claire", last: "Ferrand", role: "Directrice", email: "claire.ferrand@optique-brotteaux.fr", email_status: "valid", seniority: "founder", discovery: "linkedin" }],
    journal: [
      { type: "email_sent", days: -18, payload: { subject: "Optique des Brotteaux et ce qu'on a fait pour un concurrent", message_id: "<demo-10@antidotes>" } },
      { type: "reply", days: -15, payload: { text: "Volontiers, mardi 14 h ?" } },
      { type: "meeting", days: 2, payload: { text: "Visio de découverte — 30 minutes." } },
    ],
  },
  {
    key: "karting-indoor-st-priest", campaign: "loisirs-indoor", source: "maps", company: "Karting Indoor Saint-Priest",
    city: "Saint-Priest", sector: "Loisirs indoor", status: "meeting", score: 90, reviews: 760, rating: 4.5, ads: true,
    reference: "I-WAY",
    contacts: [{ first: "David", last: "Nunez", role: "Cofondateur", email: "david.nunez@karting-stpriest.fr", email_status: "valid", seniority: "founder", discovery: "linkedin" }],
    journal: [
      { type: "reply", days: -4, payload: { text: "Disponible jeudi matin." } },
      { type: "meeting", days: 4, payload: { text: "Rendez-vous sur place, avec le responsable des événements." } },
    ],
  },
  {
    key: "optique-nouvelle-vague", campaign: "opticiens-lyon", source: "maps", company: "Nouvelle Vague Optique",
    city: "Lyon 8e", sector: "Optique", website: "https://nouvellevague-optique.fr", status: "won",
    score: 100, reviews: 165, rating: 4.9, ads: true, reference: "Bondet",
    notes: "Signé : trois mois d'essai, planning + reporting.",
    contacts: [{ first: "Inès", last: "Bakouche", role: "Fondatrice", email: "ines.bakouche@nouvellevague-optique.fr", email_status: "valid", seniority: "founder", discovery: "linkedin" }],
    journal: [
      { type: "meeting", days: -21, payload: { text: "Découverte." } },
      { type: "note", days: -13, payload: { text: "Devis envoyé : 1 400 €/mois." } },
      { type: "note", days: -6, payload: { text: "Signé. À basculer en espace client." } },
    ],
  },
  {
    key: "optique-rive-gauche", campaign: "opticiens-lyon", source: "maps", company: "Optique Rive Gauche",
    city: "Villeurbanne", sector: "Optique", status: "lost", score: 50, reviews: 118, rating: 4.2, ads: false,
    reference: "Bondet", notes: "Refus net : la communication est faite par la fille du gérant.",
    contacts: [{ first: "Bernard", last: "Coste", role: "Gérant", email: "bernard.coste@optique-rivegauche.fr", email_status: "valid", seniority: "founder", discovery: "legal_registry" }],
    journal: [
      { type: "email_sent", days: -25, sequence: "concurrents-optique", payload: { subject: "Optique Rive Gauche et ce qu'on a fait pour un concurrent", message_id: "<demo-11@antidotes>" } },
      { type: "email_sent", days: -21, sequence: "concurrents-optique", payload: { subject: "Optique Rive Gauche et ce qu'on a fait pour un concurrent", message_id: "<demo-12@antidotes>" } },
      { type: "email_sent", days: -16, sequence: "concurrents-optique", payload: { subject: "Optique Rive Gauche et ce qu'on a fait pour un concurrent", message_id: "<demo-13@antidotes>" } },
      /* Réponse arrivée après la fin de la séquence, donc hors de son taux :
         la relance a été faite à la main. */
      { type: "reply", days: -20, payload: { text: "Merci, on gère en interne." } },
    ],
  },

  // — Entrés autrement que par le sourcing.
  {
    key: "studio-lunetterie", campaign: null, source: "inbound", company: "Studio Lunetterie",
    city: "Paris 11e", sector: "E-commerce lunetterie", website: "https://studio-lunetterie.com", status: "qualified",
    score: 80, reviews: 0, ads: true, reference: "Bondet",
    notes: "Arrivé par un commentaire LinkedIn sur le post « Montrez le prix ».",
    contacts: [{ first: "Yanis", last: "Belaïd", role: "Fondateur", email: "yanis.belaid@studio-lunetterie.com", email_status: "valid", seniority: "founder", discovery: "manual", linkedin: "https://www.linkedin.com/in/yanis-belaid/" }],
    journal: [{ type: "note", days: -5, payload: { text: "A commenté deux posts cette semaine — à traiter en priorité." } }],
  },
  {
    key: "les-verres-du-nord", campaign: null, source: "manual", company: "Les Verres du Nord",
    city: "Lille", sector: "Optique", status: "to_qualify", score: 30, reviews: 88, rating: 4.3, ads: false,
    reference: "Bondet", notes: "Saisi à la main après un salon.",
  },
];

// --- Séquences ---------------------------------------------------------------

type StepSeed = { position: number; delay_days: number; subject: string; body: string };

type EnrollmentSeed = {
  prospect: string;
  status: "active" | "paused" | "completed" | "stopped_on_reply" | "stopped_on_opt_out";
  channel: "email" | "linkedin";
  step: number;
  enrolled: number;
  next?: number;
  last_sent?: number;
  replied?: number;
  stopped?: number;
  observation?: string;
  ready?: boolean;
  paused_reason?: string;
};

type SequenceSeed = {
  key: string;
  name: string;
  description: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  steps: StepSeed[];
  enrollments: EnrollmentSeed[];
};

const SEQUENCES: SequenceSeed[] = [
  {
    key: "concurrents-optique",
    name: "Concurrents — optique",
    description: "Les opticiens sourcés autour de Bondet, trois messages en neuf jours.",
    is_active: true,
    settings: {
      case_study_url: "https://antidotes.studio/cas/bondet",
      daily_cap: 20,
      send_window: { days: [1, 2, 3, 4, 5], start_hour: 9, end_hour: 17 },
      sender_name: "Alessandro Di Giovanni",
      require_observation: true,
    },
    steps: [
      {
        position: 1, delay_days: 0,
        subject: "{{societe}} et ce qu'on a fait pour un concurrent",
        body: "Bonjour {{prenom|à vous}},\n\n{{observation}}\n\nOn accompagne des opticiens sur les réseaux, et le dernier cas ressemble beaucoup à {{societe}} : {{lien_case_study}}\n\nSi c'est un sujet pour vous ce trimestre, je vous propose quinze minutes pour vous montrer ce qui a marché.\n\n{{expediteur}}",
      },
      {
        position: 2, delay_days: 4,
        subject: "{{societe}} et ce qu'on a fait pour un concurrent",
        body: "Bonjour {{prenom|à vous}},\n\nJe me permets de revenir vers vous : le cas que je vous ai envoyé montre le détail des chiffres, mois par mois.\n\nSi le moment est mal choisi, dites-le-moi et je ne vous relance pas.\n\n{{expediteur}}",
      },
      {
        position: 3, delay_days: 5,
        subject: "{{societe}} et ce qu'on a fait pour un concurrent",
        body: "Bonjour {{prenom|à vous}},\n\nDernier message de ma part. Si le sujet revient à l'automne, ma porte est ouverte.\n\n{{expediteur}}",
      },
    ],
    enrollments: [
      { prospect: "maison-optique-chambery", status: "active", channel: "email", step: 2, enrolled: -8, next: 1, last_sent: -4, observation: "Trois boutiques, et aucune publication Instagram depuis janvier." , ready: true },
      { prospect: "opticien-saint-etienne", status: "active", channel: "email", step: 1, enrolled: -6, next: 0, last_sent: -6, observation: "Vos campagnes tournent, mais la page Instagram renvoie vers un site sans page produit." , ready: true },
      { prospect: "vue-alpine", status: "paused", channel: "email", step: 0, enrolled: -3, paused_reason: "Observation manquante : le modèle n'a rien trouvé de concret sur le site." },
      { prospect: "lunettes-co-ecully", status: "active", channel: "linkedin", step: 0, enrolled: -2, observation: "Adresse en catch-all : piste LinkedIn, message à copier." },
      { prospect: "optique-mercier", status: "stopped_on_reply", channel: "email", step: 1, enrolled: -14, last_sent: -14, replied: -11, stopped: -11, observation: "Deux boutiques, un compte Instagram soigné mais aucune publicité depuis mars.", ready: true },
      { prospect: "atelier-lunettes-clermont", status: "stopped_on_reply", channel: "email", step: 1, enrolled: -9, last_sent: -9, replied: -6, stopped: -6, observation: "Le site ne dit nulle part où sont vos boutiques.", ready: true },
      { prospect: "optique-du-lac", status: "stopped_on_opt_out", channel: "email", step: 1, enrolled: -7, last_sent: -7, stopped: -6, observation: "Une devanture refaite en juin, jamais montrée en ligne.", ready: true },
      { prospect: "optique-rive-gauche", status: "completed", channel: "email", step: 3, enrolled: -25, last_sent: -16, observation: "Aucune publication depuis deux ans.", ready: true },
      { prospect: "optique-horizon", status: "paused", channel: "email", step: 1, enrolled: -5, last_sent: -5, stopped: -5, observation: "Une vitrine refaite au printemps, invisible en ligne.", ready: true, paused_reason: "Adresse rebondie : plus aucun envoi." },
    ],
  },
  {
    key: "loisirs-indoor",
    name: "Loisirs indoor — rentrée",
    description: "Deux messages, calés sur la reprise de septembre.",
    is_active: true,
    settings: {
      case_study_url: "https://antidotes.studio/cas/i-way",
      daily_cap: 15,
      send_window: { days: [2, 3, 4], start_hour: 10, end_hour: 16 },
      sender_name: "Alessandro Di Giovanni",
      require_observation: false,
    },
    steps: [
      {
        position: 1, delay_days: 0,
        subject: "La rentrée de {{societe}}",
        body: "Bonjour {{prenom|à vous}},\n\n{{observation|J'aimerais échanger sur votre communication de rentrée.}}\n\nOn a fait passer un parc de loisirs de 12 000 à 21 000 abonnés en un an, sans budget publicitaire supplémentaire : {{lien_case_study}}\n\n{{expediteur}}",
      },
      {
        position: 2, delay_days: 6,
        subject: "La rentrée de {{societe}}",
        body: "Bonjour {{prenom|à vous}},\n\nUn mot avant la fin du mois : si votre planning de rentrée est déjà bouclé, je repasse en janvier.\n\n{{expediteur}}",
      },
    ],
    enrollments: [
      { prospect: "trampoline-park-lyon", status: "active", channel: "email", step: 2, enrolled: -10, next: 2, last_sent: -5, observation: "Vos vidéos de sauts tournent bien, mais aucune ne dit le prix ni comment réserver.", ready: true },
      { prospect: "indoor-golf-lyon", status: "stopped_on_reply", channel: "email", step: 1, enrolled: -13, last_sent: -13, replied: -10, stopped: -10, observation: "Le practice est neuf et n'apparaît sur aucune photo du compte.", ready: true },
      { prospect: "bowling-grand-est", status: "active", channel: "email", step: 0, enrolled: -1, next: 0, observation: "Deux mille avis, et pas une photo des soirées du jeudi.", ready: true },
    ],
  },
];

// --- Bibliothèque (mes posts) ------------------------------------------------

type LibrarySeed = { key: string; content: string; url: string; days: number; likes: number; comments: number; tags: string[] };

const LIBRARY: LibrarySeed[] = [
  { key: "meta-tunnel", days: -88, likes: 142, comments: 19, tags: ["acquisition", "meta"], url: "https://www.linkedin.com/feed/update/urn:li:share:7001",
    content: "Pourquoi vos publicités Meta ne convertissent pas.\n\nCe n'est pas le ciblage. C'est le tunnel : une pub qui envoie sur une page d'accueil, c'est un rendez-vous manqué.\n\nChez un opticien lyonnais, on a changé une seule chose : la page d'arrivée. Le coût par achat a baissé de 36 %.\n\nLe ciblage, on l'a touché après." },
  { key: "deux-clients", days: -67, likes: 388, comments: 54, tags: ["coulisses"], url: "https://www.linkedin.com/feed/update/urn:li:share:7002",
    content: "J'ai perdu deux clients le même mois.\n\nPas pour le travail. Pour le contexte : un rachat, une réorganisation.\n\nCe que j'en retire : un freelance qui dépend de trois clients n'est pas libre, il est fragile. Depuis, je prospecte même quand tout va bien." },
  { key: "planning-promesse", days: -110, likes: 97, comments: 8, tags: ["planning"], url: "https://www.linkedin.com/feed/update/urn:li:share:7003",
    content: "Le planning éditorial n'est pas un calendrier.\n\nC'est une promesse faite à une audience : voilà ce que vous trouverez ici, et à quel rythme.\n\nQuand une marque le tient trois mois, les abonnés arrivent. Quand elle le tient six mois, ils restent." },
  { key: "reporting-lu", days: -38, likes: 211, comments: 23, tags: ["reporting"], url: "https://www.linkedin.com/feed/update/urn:li:share:7004",
    content: "Un reporting que le client ne lit pas est un reporting raté.\n\nJ'ai remplacé quarante pages Looker par trois bandes : les chiffres, l'audience, le détail. Le client ouvre le lien, il comprend en une minute.\n\nLa clarté, c'est du respect." },
  { key: "montrez-le-prix", days: -17, likes: 264, comments: 31, tags: ["prospection"], url: "https://www.linkedin.com/feed/update/urn:li:share:7005",
    content: "Les posts d'expertise ne font pas signer.\n\nIls rassurent. Ce qui fait signer, c'est le post où vous montrez un client qui a changé quelque chose, et ce que ça lui a coûté.\n\nMontrez le prix, pas la méthode." },
  { key: "devis-refuse", days: -54, likes: 176, comments: 27, tags: ["freelance", "coulisses"], url: "https://www.linkedin.com/feed/update/urn:li:share:7006",
    content: "J'ai refusé un devis à 3 000 € le mois dernier.\n\nLe client voulait vingt publications par mois et zéro rendez-vous de cadrage. C'est une usine, pas une collaboration.\n\nDire non à un mauvais contrat, c'est se garder disponible pour le bon." },
  { key: "story-monologue", days: -29, likes: 143, comments: 12, tags: ["stories", "engagement"], url: "https://www.linkedin.com/feed/update/urn:li:share:7007",
    content: "Un client m'a demandé pourquoi ses stories ne servaient à rien.\n\nRéponse : parce qu'elles ne demandent rien.\n\nUne story sans question est un monologue. Et personne ne répond à un monologue." },
  { key: "un-an-outil", days: -8, likes: 302, comments: 44, tags: ["produit", "coulisses"], url: "https://www.linkedin.com/feed/update/urn:li:share:7008",
    content: "J'ai passé un an à construire l'outil que je voulais utiliser.\n\nReporting, planning, modération, facturation : tout ce que je payais à cinq endroits vit maintenant au même.\n\nCe n'est pas un side project. C'est ce qui me permet de tenir six clients seul." },
  { key: "abonnes-mensonge", days: -74, likes: 128, comments: 16, tags: ["mesure"], url: "https://www.linkedin.com/feed/update/urn:li:share:7009",
    content: "Le nombre d'abonnés est la métrique la plus rassurante et la moins utile.\n\nCe qui compte : combien de personnes ont vu votre offre cette semaine, et combien ont cliqué.\n\nUn compte de 3 000 abonnés qui vend bat un compte de 30 000 qui décore." },
  { key: "ia-brouillon", days: -46, likes: 219, comments: 38, tags: ["ia", "process"], url: "https://www.linkedin.com/feed/update/urn:li:share:7010",
    content: "J'utilise l'IA pour écrire mes brouillons, jamais mes publications.\n\nLa différence : le brouillon me fait gagner l'angoisse de la page blanche. La publication, elle, doit porter une expérience que la machine n'a pas vécue.\n\nCe post-là, je l'ai écrit à la main. Ça se sent, et c'est le but." },
  { key: "client-fantome", days: -96, likes: 87, comments: 9, tags: ["freelance"], url: "https://www.linkedin.com/feed/update/urn:li:share:7011",
    content: "Le client fantôme n'existe pas.\n\nQuand un client ne répond plus, il a une raison : il a peur du budget, il a un autre feu, ou il ne comprend pas ce qu'il achète.\n\nLes trois se règlent avec un appel, pas avec une relance de plus." },
  { key: "avant-apres", days: -23, likes: 341, comments: 52, tags: ["cas-client", "reporting"], url: "https://www.linkedin.com/feed/update/urn:li:share:7012",
    content: "Six mois d'accompagnement, en trois chiffres :\n\n• 12 400 → 21 700 abonnés\n• coût par achat divisé par deux\n• zéro euro de budget publicitaire en plus\n\nCe n'est pas un miracle. C'est un planning tenu et un tunnel réparé." },
];

// --- Radar -------------------------------------------------------------------

type AccountSeed = {
  key: string;
  platform: "linkedin" | "x" | "youtube" | "tiktok" | "instagram";
  handle: string;
  url?: string;
  label: string;
  followers: number | null;
  active: boolean;
  collected?: number;
  error?: string;
};

const ACCOUNTS: AccountSeed[] = [
  { key: "clara-social", platform: "linkedin", handle: "clara-social", url: "https://www.linkedin.com/in/clara-social/", label: "Clara — social media B2B", followers: 14200, active: true, collected: -1 },
  { key: "hugo-ads", platform: "linkedin", handle: "hugo-ads", url: "https://www.linkedin.com/in/hugo-ads/", label: "Hugo — media buying", followers: 8600, active: true, collected: -1 },
  { key: "agence-lumen", platform: "instagram", handle: "agence.lumen", label: "Agence Lumen", followers: 31000, active: true, collected: -1 },
  { key: "growthfr", platform: "youtube", handle: "growthmarketingfr", label: "Growth Marketing FR", followers: 52000, active: true, collected: -2 },
  { key: "lemlist-x", platform: "x", handle: "lemlist", label: "Lemlist", followers: 88000, active: false, collected: -12, error: "Apify : l'acteur a rendu 0 tweet, compte peut-être protégé." },
];

type RadarPostSeed = { key: string; account: string; days: number; likes: number; comments: number; shares?: number; content: string; url: string };

const RADAR_POSTS: RadarPostSeed[] = [
  { key: "clara-1", account: "clara-social", days: -3, likes: 1240, comments: 188, shares: 61, url: "https://www.linkedin.com/feed/update/urn:li:share:8001",
    content: "Vos posts d'expertise n'attirent aucun client, et voici pourquoi : ils parlent de vous.\n\nLe seul post qui a fait signer cette année montrait un client, ses chiffres, ses doutes. Rien d'autre." },
  { key: "clara-2", account: "clara-social", days: -9, likes: 610, comments: 92, shares: 24, url: "https://www.linkedin.com/feed/update/urn:li:share:8002",
    content: "J'ai arrêté les carrousels.\n\nTrois mois de posts texte seul : plus de commentaires, plus de rendez-vous. Le format n'est pas le message." },
  { key: "clara-3", account: "clara-social", days: -16, likes: 385, comments: 41, shares: 12, url: "https://www.linkedin.com/feed/update/urn:li:share:8003",
    content: "Pourquoi je facture le reporting à part : parce qu'un client qui ne paie pas pour comprendre ne lira pas." },
  { key: "clara-4", account: "clara-social", days: -24, likes: 902, comments: 121, shares: 47, url: "https://www.linkedin.com/feed/update/urn:li:share:8004",
    content: "Un prospect m'a dit : « votre offre est trop chère ».\n\nJe lui ai demandé par rapport à quoi. Silence.\n\nCe n'était pas cher : c'était flou. J'ai réécrit la proposition en trois lignes, il a signé." },
  { key: "clara-5", account: "clara-social", days: -38, likes: 214, comments: 18, shares: 6, url: "https://www.linkedin.com/feed/update/urn:li:share:8005",
    content: "Le community management est mort, vive l'éditorial. (Non, mais le titre vous a fait cliquer, et c'est justement le sujet.)" },
  { key: "hugo-1", account: "hugo-ads", days: -2, likes: 452, comments: 63, shares: 19, url: "https://www.linkedin.com/feed/update/urn:li:share:8101",
    content: "Le CPM augmente de 30 % à la rentrée. Ce n'est pas Meta qui vous punit : c'est que tout le monde revient en même temps.\n\nCe qu'il faut faire dès août : accumuler de l'audience chaude pendant que personne n'enchérit." },
  { key: "hugo-2", account: "hugo-ads", days: -6, likes: 288, comments: 34, shares: 11, url: "https://www.linkedin.com/feed/update/urn:li:share:8102",
    content: "Une créa qui fatigue ne se remplace pas : elle se décline.\n\nMême promesse, autre première seconde. J'ai gardé le même ROAS pendant sept semaines comme ça." },
  { key: "hugo-3", account: "hugo-ads", days: -13, likes: 176, comments: 21, shares: 5, url: "https://www.linkedin.com/feed/update/urn:li:share:8103",
    content: "Arrêtez de regarder le coût par clic. Regardez le coût par achat, et si vous ne l'avez pas, votre pixel est mal posé." },
  { key: "hugo-4", account: "hugo-ads", days: -27, likes: 640, comments: 88, shares: 31, url: "https://www.linkedin.com/feed/update/urn:li:share:8104",
    content: "J'ai fait tourner la même publicité avec deux budgets : 20 € et 200 € par jour.\n\nLe petit budget a gagné, en coût par achat. Personne ne le dit, parce que ça ne vend pas de prestation." },
  { key: "lumen-1", account: "agence-lumen", days: -4, likes: 4200, comments: 138, url: "https://www.instagram.com/reel/lumen-a1/",
    content: "Coulisses d'un shooting produit : ce qu'on prépare la veille, ce qu'on jette le jour même." },
  { key: "lumen-2", account: "agence-lumen", days: -11, likes: 2760, comments: 74, url: "https://www.instagram.com/reel/lumen-a2/",
    content: "Trois plans, un produit, zéro studio. Tourné dans une cuisine." },
  { key: "lumen-3", account: "agence-lumen", days: -19, likes: 1180, comments: 42, url: "https://www.instagram.com/p/lumen-a3/",
    content: "Le brief que nos clients détestent remplir — et pourquoi on le maintient." },
  { key: "lumen-4", account: "agence-lumen", days: -33, likes: 890, comments: 26, url: "https://www.instagram.com/reel/lumen-a4/",
    content: "(Reel sans légende)" },
  { key: "growth-1", account: "growthfr", days: -5, likes: 3100, comments: 214, url: "https://www.youtube.com/watch?v=demo-g1",
    content: "J'ai audité 12 comptes Instagram de PME : voici les 4 erreurs que tout le monde répète" },
  { key: "growth-2", account: "growthfr", days: -14, likes: 1840, comments: 96, url: "https://www.youtube.com/watch?v=demo-g2",
    content: "Faut-il encore payer une agence social media en 2027 ?" },
  { key: "growth-3", account: "growthfr", days: -26, likes: 960, comments: 51, url: "https://www.youtube.com/watch?v=demo-g3",
    content: "Le calendrier éditorial que j'utilise pour six marques (fichier offert)" },
  { key: "lemlist-1", account: "lemlist-x", days: -12, likes: 520, comments: 47, shares: 88, url: "https://x.com/lemlist/status/demo-l1",
    content: "Cold email is not dead. Bad cold email is. Voici les 3 lignes qu'on teste en ce moment." },
  { key: "lemlist-2", account: "lemlist-x", days: -31, likes: 310, comments: 22, shares: 41, url: "https://x.com/lemlist/status/demo-l2",
    content: "Votre taux de réponse chute ? Regardez d'abord votre volume quotidien, pas votre copie." },
];

type TopicSeed = { key: string; title: string; angle: string; score: number; status: "new" | "used" | "dismissed"; evidence: { post: string; why: string }[] };

const TOPICS: TopicSeed[] = [
  { key: "montrer-le-client", title: "Pourquoi vos posts d'expertise n'attirent aucun client", angle: "L'expertise rassure, elle ne fait pas signer : montrez un client, ses chiffres et ce que ça lui a coûté.", score: 104.9, status: "new",
    evidence: [{ post: "clara-1", why: "105 ‰ sur un post qui dit exactement cela" }, { post: "clara-4", why: "le même angle, quatre semaines plus tôt" }] },
  { key: "petit-budget", title: "Le petit budget qui bat le gros", angle: "Même créa, deux budgets : le coût par achat ne suit pas la dépense.", score: 89.4, status: "used",
    evidence: [{ post: "hugo-4", why: "89 ‰ sur un contre-pied qui ne vend pas de prestation" }] },
  { key: "prix-flou", title: "« Trop cher » veut presque toujours dire « trop flou »", angle: "Réécrire une proposition en trois lignes vaut mieux que baisser le prix.", score: 78.4, status: "new",
    evidence: [{ post: "clara-4", why: "78 ‰, le post le plus partagé du mois" }] },
  { key: "cpm-rentree", title: "Le CPM de septembre n'est pas une punition", angle: "Tout le monde revient en même temps : ce qui se joue en août, c'est l'audience chaude.", score: 60.6, status: "new",
    evidence: [{ post: "hugo-1", why: "61 ‰ en deux jours, saisonnalité" }] },
  { key: "format-message", title: "Le format n'est pas le message", angle: "Trois mois sans carrousel, et plus de rendez-vous.", score: 52.1, status: "new",
    evidence: [{ post: "clara-2", why: "les commentaires ont doublé sur du texte seul" }] },
  { key: "agence-2027", title: "Faut-il encore payer une agence en 2027 ?", angle: "La question est posée par tout le monde ; personne n'y répond en montrant ses chiffres.", score: 36.9, status: "dismissed",
    evidence: [{ post: "growth-2", why: "37 ‰, mais le sujet est déjà saturé" }] },
];

// --- Studio ------------------------------------------------------------------

type DraftSeed = {
  key: string;
  topic: string;
  topicKey?: string;
  sourceKey?: string;
  brief?: string;
  content: string;
  status: "draft" | "approved" | "published" | "rejected";
  days: number;
  examples: { post: string; similarity: number }[];
  imagePrompt?: string;
  publishedUrl?: string;
};

const DRAFTS: DraftSeed[] = [
  {
    key: "expertise-client", topic: "Pourquoi vos posts d'expertise n'attirent aucun client",
    topicKey: "montrer-le-client", sourceKey: "clara-1", status: "draft", days: -1,
    brief: "Angle : l'expertise rassure, elle ne fait pas signer.",
    imagePrompt: "portrait en atelier, lumière naturelle, regard caméra",
    examples: [{ post: "montrez-le-prix", similarity: 0.81 }, { post: "deux-clients", similarity: 0.42 }],
    content: "Vos posts d'expertise rassurent. Ils ne font pas signer.\n\nCe qui fait signer, c'est le post où un client apparaît avec ses chiffres, ses doutes, et ce que ça lui a coûté d'essayer.\n\nChez un opticien lyonnais, un seul post a amené trois rendez-vous : celui qui montrait le prix.\n\nMontrez le prix, pas la méthode.",
  },
  {
    key: "prix-flou", topic: "« Trop cher » veut presque toujours dire « trop flou »",
    topicKey: "prix-flou", sourceKey: "clara-4", status: "draft", days: -2,
    examples: [{ post: "devis-refuse", similarity: 0.74 }, { post: "client-fantome", similarity: 0.51 }],
    content: "« C'est trop cher. »\n\nJ'ai mis trois ans à comprendre que cette phrase ne parle presque jamais du prix.\n\nElle dit : je ne vois pas ce que j'achète. Un devis à 1 400 € qui liste douze lignes techniques est plus cher, dans la tête du client, qu'un devis à 1 800 € qui dit ce qu'il obtient.\n\nAvant de baisser vos tarifs, réécrivez votre proposition en trois lignes.",
  },
  {
    key: "petit-budget", topic: "Le petit budget qui bat le gros",
    topicKey: "petit-budget", sourceKey: "hugo-4", status: "approved", days: -4,
    imagePrompt: "deux écrans côte à côte, chiffres, ambiance sobre",
    examples: [{ post: "meta-tunnel", similarity: 0.69 }, { post: "abonnes-mensonge", similarity: 0.44 }],
    content: "On m'a demandé combien il fallait mettre pour que la publicité « marche ».\n\nLa vraie réponse tient en une expérience : même créa, même audience, 20 € par jour d'un côté, 200 € de l'autre. Le petit budget a gagné, en coût par achat.\n\nUn budget qui monte trop vite apprend mal. Il achète large avant d'avoir compris qui achète.\n\nCommencez petit, laissez apprendre, montez ensuite.",
  },
  {
    key: "reporting-lu", topic: "Un reporting que personne ne lit",
    status: "published", days: -11, publishedUrl: "https://www.linkedin.com/feed/update/urn:li:share:7004",
    examples: [{ post: "reporting-lu", similarity: 0.88 }],
    content: "Un reporting que le client ne lit pas est un reporting raté.\n\nQuarante pages, trois bandes : les chiffres, l'audience, le détail. Le client ouvre le lien et comprend en une minute.\n\nLa clarté, c'est du respect.",
  },
  {
    key: "agence-2027", topic: "Faut-il encore payer une agence en 2027 ?",
    topicKey: "agence-2027", status: "rejected", days: -6,
    examples: [{ post: "un-an-outil", similarity: 0.58 }],
    content: "Faut-il encore payer une agence social media en 2027 ?\n\nLa question revient partout, et la réponse honnête est : ça dépend de ce que vous savez mesurer.\n\n(Sujet écarté : trop de monde le traite, et je n'ai rien de neuf à dire dessus.)",
  },
];

// --- Écriture ----------------------------------------------------------------

async function main() {
  const reset = process.argv.includes("--reset");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  const db = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations order by created_at limit 1",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Aucune organisation — appliquer les migrations.");

    /* La purge ne vise que les identifiants du seed : un prospect saisi à la
       main à côté de la démo n'est jamais emporté. */
    const ids = {
      campaigns: CAMPAIGNS.map((c) => stableId(`campagne:${c.key}`)),
      runs: RUNS.map((r) => stableId(`passage:${r.key}`)),
      prospects: PROSPECTS.map((p) => stableId(`prospect:${p.key}`)),
      contacts: PROSPECTS.flatMap((p) => (p.contacts ?? []).map((_, index) => stableId(`contact:${p.key}:${index}`))),
      sequences: SEQUENCES.map((s) => stableId(`sequence:${s.key}`)),
      posts: [
        ...LIBRARY.map((p) => stableId(`mon-post:${p.key}`)),
        ...RADAR_POSTS.map((p) => stableId(`post-veille:${p.key}`)),
      ],
      accounts: ACCOUNTS.map((a) => stableId(`compte:${a.key}`)),
      topics: TOPICS.map((t) => stableId(`sujet:${t.key}`)),
      drafts: DRAFTS.map((d) => stableId(`brouillon:${d.key}`)),
    };

    const purge = async () => {
      await db.query("delete from antidotes_generated_posts where id = any($1::uuid[])", [ids.drafts]);
      await db.query("delete from antidotes_radar_topics where id = any($1::uuid[])", [ids.topics]);
      await db.query("delete from antidotes_reference_posts where id = any($1::uuid[])", [ids.posts]);
      await db.query("delete from antidotes_radar_accounts where id = any($1::uuid[])", [ids.accounts]);
      // Inscriptions, étapes, interactions et contacts partent en cascade.
      await db.query("delete from antidotes_sequences where id = any($1::uuid[])", [ids.sequences]);
      await db.query("delete from antidotes_prospects where id = any($1::uuid[])", [ids.prospects]);
      await db.query("delete from antidotes_campaign_runs where id = any($1::uuid[])", [ids.runs]);
      await db.query("delete from antidotes_campaigns where id = any($1::uuid[])", [ids.campaigns]);
    };

    if (reset) {
      await purge();
      console.log("Démonstration du pôle Antidotes effacée.");
      return;
    }

    // Campagnes.
    for (const campaign of CAMPAIGNS) {
      await db.query(
        `insert into antidotes_campaigns (id, org_id, name, engine, reference_client, source_params, filters, targeting, is_active, last_run_at)
         values ($1, $2, $3, $4::antidotes_campaign_engine, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
         on conflict (id) do update set name = excluded.name, engine = excluded.engine,
           reference_client = excluded.reference_client, source_params = excluded.source_params,
           filters = excluded.filters, targeting = excluded.targeting, is_active = excluded.is_active,
           last_run_at = excluded.last_run_at`,
        [
          stableId(`campagne:${campaign.key}`), orgId, campaign.name, campaign.engine, campaign.reference_client,
          JSON.stringify(campaign.source_params), JSON.stringify(campaign.filters), JSON.stringify(campaign.targeting),
          campaign.is_active, campaign.last_run_at,
        ],
      );
    }

    // Passages.
    for (const run of RUNS) {
      await db.query(
        `insert into antidotes_campaign_runs (id, org_id, campaign_id, status, stage, stats, errors, requested_at, started_at, finished_at, heartbeat_at)
         values ($1, $2, $3, $4::antidotes_run_status, $5::antidotes_run_stage, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
         on conflict (id) do update set status = excluded.status, stage = excluded.stage, stats = excluded.stats,
           errors = excluded.errors, requested_at = excluded.requested_at, started_at = excluded.started_at,
           finished_at = excluded.finished_at, heartbeat_at = excluded.heartbeat_at`,
        [
          stableId(`passage:${run.key}`), orgId, stableId(`campagne:${run.campaign}`), run.status, run.stage,
          JSON.stringify(run.stats), JSON.stringify(run.errors),
          at(run.started, 5), at(run.started, 5), at(run.finished, 6), at(run.finished, 6),
        ],
      );
    }

    // Prospects, contacts, journal.
    let contactCount = 0;
    let journalCount = 0;
    for (const prospect of PROSPECTS) {
      const prospectId = stableId(`prospect:${prospect.key}`);
      const qualification = prospect.status === "to_qualify"
        ? { outcome: "to_review", reasons: ["publicités non vérifiables"], size_ratio: null, checked_at: at(-2, 5) }
        : { outcome: "qualified", reasons: [], size_ratio: prospect.reviews ? Number((prospect.reviews / 180).toFixed(2)) : null, checked_at: at(-2, 5) };
      const enrichment = prospect.contacts?.length
        ? {
            discovery_at: at(-2, 6),
            discovery_source: prospect.contacts[0]!.discovery,
            candidates: 1,
            email_at: at(-2, 6),
            email_provider: prospect.contacts[0]!.email_status === "valid" ? "hunter" : "pattern",
          }
        : {};
      await db.query(
        `insert into antidotes_prospects (id, org_id, campaign_id, source, company_name, website, country, city, sector,
           size_signal, ads_active, ads_last_seen_at, status, score, reference_client, notes, external_ids, rating,
           qualification, enrichment, last_run_id, created_at)
         values ($1, $2, $3, $4::antidotes_prospect_source, $5, $6, 'FR', $7, $8, $9::jsonb, $10, $11,
           $12::antidotes_prospect_status, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19::jsonb, $20, $21)
         on conflict (id) do update set campaign_id = excluded.campaign_id, company_name = excluded.company_name,
           website = excluded.website, city = excluded.city, sector = excluded.sector, size_signal = excluded.size_signal,
           ads_active = excluded.ads_active, ads_last_seen_at = excluded.ads_last_seen_at, status = excluded.status,
           score = excluded.score, reference_client = excluded.reference_client, notes = excluded.notes,
           rating = excluded.rating, qualification = excluded.qualification, enrichment = excluded.enrichment,
           last_run_id = excluded.last_run_id`,
        [
          prospectId, orgId, prospect.campaign ? stableId(`campagne:${prospect.campaign}`) : null, prospect.source,
          prospect.company, prospect.website ?? null, prospect.city, prospect.sector,
          JSON.stringify(prospect.reviews ? { reviews_count: prospect.reviews } : {}),
          prospect.ads, prospect.ads ? at(-3, 5) : null, prospect.status, prospect.score,
          prospect.reference, prospect.notes ?? null,
          JSON.stringify({ place_id: `demo-${prospect.key}` }), prospect.rating ?? null,
          JSON.stringify(qualification), JSON.stringify(enrichment),
          prospect.campaign === "opticiens-lyon" ? stableId("passage:run-opticiens-3") : prospect.campaign === "loisirs-indoor" ? stableId("passage:run-loisirs-1") : null,
          at(-Math.min(30, 3 + PROSPECTS.indexOf(prospect)), 5),
        ],
      );

      for (const [index, contact] of (prospect.contacts ?? []).entries()) {
        const contactId = stableId(`contact:${prospect.key}:${index}`);
        await db.query(
          `insert into antidotes_contacts (id, org_id, prospect_id, first_name, last_name, role, email,
             email_status, linkedin_url, is_primary, seniority, discovery_source, email_source, email_verified_at, opted_out, opted_out_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8::antidotes_email_status, $9, $10, $11::antidotes_seniority,
             $12::antidotes_discovery_source, $13, $14, $15, $16)
           on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name,
             role = excluded.role, email = excluded.email, email_status = excluded.email_status,
             linkedin_url = excluded.linkedin_url, seniority = excluded.seniority,
             discovery_source = excluded.discovery_source, opted_out = excluded.opted_out,
             opted_out_at = excluded.opted_out_at`,
          [
            contactId, orgId, prospectId, contact.first, contact.last, contact.role, contact.email,
            contact.email_status, contact.linkedin ?? null, index === 0, contact.seniority, contact.discovery,
            contact.email_status === "valid" ? "hunter" : "pattern",
            contact.email_status === "unknown" ? null : at(-2, 6),
            contact.opted_out ?? false, contact.opted_out ? at(-6, 10) : null,
          ],
        );
        contactCount += 1;
      }

      for (const [index, entry] of (prospect.journal ?? []).entries()) {
        await db.query(
          `insert into antidotes_interactions (id, org_id, prospect_id, contact_id, type, payload, occurred_at)
           values ($1, $2, $3, $4, $5::antidotes_interaction_type, $6::jsonb, $7)
           on conflict (id) do update set type = excluded.type, payload = excluded.payload,
             occurred_at = excluded.occurred_at`,
          [
            stableId(`journal:${prospect.key}:${index}`), orgId, prospectId,
            prospect.contacts?.length ? stableId(`contact:${prospect.key}:0`) : null,
            entry.type,
            JSON.stringify({
              ...entry.payload,
              ...(entry.sequence ? { sequence_id: stableId(`sequence:${entry.sequence}`) } : {}),
            }),
            at(entry.days, 9 + (index % 8)),
          ],
        );
        journalCount += 1;
      }
    }

    // Séquences, étapes, inscriptions.
    let enrollmentCount = 0;
    for (const sequence of SEQUENCES) {
      const sequenceId = stableId(`sequence:${sequence.key}`);
      await db.query(
        `insert into antidotes_sequences (id, org_id, name, description, is_active, settings)
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (id) do update set name = excluded.name, description = excluded.description,
           is_active = excluded.is_active, settings = excluded.settings`,
        [sequenceId, orgId, sequence.name, sequence.description, sequence.is_active, JSON.stringify(sequence.settings)],
      );
      for (const step of sequence.steps) {
        await db.query(
          `insert into antidotes_sequence_steps (id, org_id, sequence_id, position, delay_days, subject_template, body_template)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set position = excluded.position, delay_days = excluded.delay_days,
             subject_template = excluded.subject_template, body_template = excluded.body_template`,
          [stableId(`etape:${sequence.key}:${step.position}`), orgId, sequenceId, step.position, step.delay_days, step.subject, step.body],
        );
      }
      for (const enrollment of sequence.enrollments) {
        await db.query(
          `insert into antidotes_sequence_enrollments (id, org_id, sequence_id, contact_id, current_step, status,
             enrolled_at, next_send_at, channel, personalization, thread_id, last_message_id, last_sent_at,
             replied_at, stopped_at, paused_reason)
           values ($1, $2, $3, $4, $5, $6::antidotes_enrollment_status, $7, $8, $9::antidotes_outreach_channel,
             $10::jsonb, $11, $12, $13, $14, $15, $16)
           on conflict (id) do update set current_step = excluded.current_step, status = excluded.status,
             enrolled_at = excluded.enrolled_at, next_send_at = excluded.next_send_at, channel = excluded.channel,
             personalization = excluded.personalization, last_sent_at = excluded.last_sent_at,
             replied_at = excluded.replied_at, stopped_at = excluded.stopped_at, paused_reason = excluded.paused_reason`,
          [
            stableId(`inscription:${sequence.key}:${enrollment.prospect}`), orgId, sequenceId,
            stableId(`contact:${enrollment.prospect}:0`), enrollment.step, enrollment.status,
            at(enrollment.enrolled, 9), enrollment.next === undefined ? null : at(enrollment.next, 10),
            enrollment.channel,
            JSON.stringify({
              ...(enrollment.observation ? { observation: enrollment.observation } : {}),
              ...(enrollment.ready ? { ready: true } : {}),
            }),
            enrollment.last_sent === undefined ? null : `demo-thread-${enrollment.prospect}`,
            enrollment.last_sent === undefined ? null : `<demo-${enrollment.prospect}@antidotes>`,
            enrollment.last_sent === undefined ? null : at(enrollment.last_sent, 10),
            enrollment.replied === undefined ? null : at(enrollment.replied, 11),
            enrollment.stopped === undefined ? null : at(enrollment.stopped, 11),
            enrollment.paused_reason ?? null,
          ],
        );
        enrollmentCount += 1;
      }
    }

    // Comptes veillés.
    for (const account of ACCOUNTS) {
      await db.query(
        `insert into antidotes_radar_accounts (id, org_id, platform, handle, url, label, followers, is_active, last_collected_at, last_error)
         values ($1, $2, $3::antidotes_post_platform, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set platform = excluded.platform, handle = excluded.handle, url = excluded.url,
           label = excluded.label, followers = excluded.followers, is_active = excluded.is_active,
           last_collected_at = excluded.last_collected_at, last_error = excluded.last_error`,
        [
          stableId(`compte:${account.key}`), orgId, account.platform, account.handle, account.url ?? null,
          account.label, account.followers, account.active,
          account.collected === undefined ? null : at(account.collected, 5), account.error ?? null,
        ],
      );
    }

    // Mes posts.
    for (const post of LIBRARY) {
      await db.query(
        `insert into antidotes_reference_posts (id, org_id, platform, content, url, metrics, is_mine, tags, published_at, collected_at)
         values ($1, $2, 'linkedin', $3, $4, $5::jsonb, true, $6::text[], $7, $8)
         on conflict (id) do update set content = excluded.content, url = excluded.url, metrics = excluded.metrics,
           tags = excluded.tags, published_at = excluded.published_at`,
        [
          stableId(`mon-post:${post.key}`), orgId, post.content, post.url,
          JSON.stringify({ likes: post.likes, comments: post.comments }), post.tags,
          at(post.days, 8), at(post.days, 8),
        ],
      );
    }

    // Posts relevés.
    for (const post of RADAR_POSTS) {
      const account = ACCOUNTS.find((entry) => entry.key === post.account)!;
      await db.query(
        `insert into antidotes_reference_posts (id, org_id, platform, author_handle, content, url, metrics, is_mine, account_id, published_at, collected_at)
         values ($1, $2, $3::antidotes_post_platform, $4, $5, $6, $7::jsonb, false, $8, $9, $10)
         on conflict (id) do update set content = excluded.content, url = excluded.url, metrics = excluded.metrics,
           account_id = excluded.account_id, published_at = excluded.published_at, collected_at = excluded.collected_at`,
        [
          stableId(`post-veille:${post.key}`), orgId, account.platform, account.handle, post.content, post.url,
          JSON.stringify({ likes: post.likes, comments: post.comments, ...(post.shares ? { shares: post.shares } : {}) }),
          stableId(`compte:${post.account}`), at(post.days, 8), at(-1, 5),
        ],
      );
    }

    // Sujets proposés.
    for (const topic of TOPICS) {
      await db.query(
        `insert into antidotes_radar_topics (id, org_id, title, angle, evidence, score, status, created_at)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7::antidotes_topic_status, $8)
         on conflict (id) do update set title = excluded.title, angle = excluded.angle, evidence = excluded.evidence,
           score = excluded.score, status = excluded.status, created_at = excluded.created_at`,
        [
          stableId(`sujet:${topic.key}`), orgId, topic.title, topic.angle,
          JSON.stringify(topic.evidence.map((entry) => ({ post_id: stableId(`post-veille:${entry.post}`), why: entry.why }))),
          topic.score, topic.status, at(-1, 18 - TOPICS.indexOf(topic)),
        ],
      );
    }

    // Brouillons.
    for (const draft of DRAFTS) {
      await db.query(
        `insert into antidotes_generated_posts (id, org_id, source_post_id, topic, content, status, topic_id, brief,
           examples, image_prompt, published_url, published_at, created_at)
         values ($1, $2, $3, $4, $5, $6::antidotes_generated_post_status, $7, $8, $9::jsonb, $10, $11, $12, $13)
         on conflict (id) do update set source_post_id = excluded.source_post_id, topic = excluded.topic,
           content = excluded.content, status = excluded.status, topic_id = excluded.topic_id, brief = excluded.brief,
           examples = excluded.examples, image_prompt = excluded.image_prompt, published_url = excluded.published_url,
           published_at = excluded.published_at, created_at = excluded.created_at`,
        [
          stableId(`brouillon:${draft.key}`), orgId,
          draft.sourceKey ? stableId(`post-veille:${draft.sourceKey}`) : null,
          draft.topic, draft.content, draft.status,
          draft.topicKey ? stableId(`sujet:${draft.topicKey}`) : null, draft.brief ?? null,
          JSON.stringify(draft.examples.map((entry) => ({ post_id: stableId(`mon-post:${entry.post}`), similarity: entry.similarity }))),
          draft.imagePrompt ?? null, draft.publishedUrl ?? null,
          draft.status === "published" ? at(draft.days, 14) : null, at(draft.days, 9),
        ],
      );
    }

    console.log(`Campagnes           ${CAMPAIGNS.length} (dont 1 e-commerce sans source branchée)`);
    console.log(`Passages            ${RUNS.length}`);
    console.log(`Prospects           ${PROSPECTS.length}`);
    console.log(`Contacts            ${contactCount}`);
    console.log(`Journal             ${journalCount} entrées`);
    console.log(`Séquences           ${SEQUENCES.length} · ${enrollmentCount} inscriptions`);
    console.log(`Mes posts           ${LIBRARY.length}`);
    console.log(`Comptes veillés     ${ACCOUNTS.length} · ${RADAR_POSTS.length} posts relevés`);
    console.log(`Sujets              ${TOPICS.length} · brouillons ${DRAFTS.length}`);
    console.log("\nOuvrir /antidotes/outbound/pipeline — puis sourcing, séquences, radar, studio, bibliothèque.");
    console.log("Effacer : pnpm seed:antidotes --reset");
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
