import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Chiffrement des tokens d'accès aux plateformes, et vérification des
 * signatures de webhook.
 *
 * Les tokens sont chiffrés en AES-256-GCM avant d'atteindre la base : un dump
 * Postgres ne livre pas les accès aux comptes clients. GCM et non CBC parce
 * qu'il authentifie le chiffré — un blob altéré est rejeté au déchiffrement
 * plutôt que de produire silencieusement des octets faux.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, la taille recommandée pour GCM
const KEY_LENGTH = 32;

/* La clé par défaut protège les jetons des plateformes. Un appelant peut en
   nommer une autre : les sessions de navigateur de la récupération de factures
   se chiffrent avec `FACTURES_SESSION_KEY`, parce qu'elles voyagent entre le
   Mac qui ouvre la session et le runner GitHub qui la rejoue — deux endroits
   qui n'ont pas la clé de production. */
export const DEFAULT_KEY_ENV = "CREDENTIALS_ENCRYPTION_KEY";

function readKey(keyEnv: string = DEFAULT_KEY_ENV): Buffer {
  const raw = process.env[keyEnv];
  if (!raw) {
    throw new Error(`${keyEnv} absent. Générer avec : openssl rand -base64 32`);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `${keyEnv} doit faire 32 octets une fois décodée, ${key.length} trouvés.`,
    );
  }
  return key;
}

/**
 * Format : `v1.<iv>.<tag>.<chiffré>`, chaque partie en base64url.
 *
 * Le préfixe de version permettra de changer d'algorithme sans casser les
 * blobs existants — on saura les relire pour les migrer.
 */
export function encryptSecret(plaintext: string, keyEnv?: string): string {
  const key = readKey(keyEnv);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(blob: string, keyEnv?: string): string {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Format de secret chiffré non reconnu.");
  }

  const key = readKey(keyEnv);
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const encrypted = Buffer.from(parts[3]!, "base64url");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // `final()` lève si le tag ne correspond pas : un blob altéré ne peut pas
  // produire de texte clair silencieusement faux.
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Vérifie la signature `X-Hub-Signature-256` de Meta.
 *
 * Comparaison à temps constant : un `===` sur les signatures fuiterait, par la
 * durée de la comparaison, combien de caractères de tête sont corrects — de quoi
 * reconstruire une signature valide octet par octet.
 */
export function verifyMetaSignature(options: {
  rawBody: string;
  header: string | null;
  appSecret: string;
}): boolean {
  const { rawBody, header, appSecret } = options;
  if (!header || !header.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

/** WhatsApp Cloud API utilise le même schéma HMAC-SHA256 que Meta. */
export const verifyWhatsAppSignature = verifyMetaSignature;

/**
 * Backoff exponentiel de la file de reprise, avec gigue.
 *
 * La gigue n'est pas cosmétique : sans elle, cent webhooks tombés pendant la
 * même panne repartiraient tous exactement en même temps et referaient tomber
 * ce qui vient de se rétablir.
 */
export function nextRetryDelayMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 60 * 60 * 1000);
  const jitter = base * 0.2 * Math.random();
  return Math.round(base + jitter);
}

/** Au-delà, la livraison passe en `dead` et attend une reprise manuelle. */
export const MAX_WEBHOOK_ATTEMPTS = 8;
