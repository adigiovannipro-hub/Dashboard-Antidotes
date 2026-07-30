/**
 * Amorçage des données de démonstration du module Modération.
 *
 *   pnpm seed:moderation          crée ou met à jour
 *   pnpm seed:moderation --reset  efface d'abord les données du client de démo
 *
 * Les embeddings sont calculés avec le fournisseur déterministe : l'amorçage ne
 * doit pas dépendre du téléchargement d'un modèle de 25 Mo, et deux exécutions
 * doivent produire exactement les mêmes vecteurs.
 *
 * Idempotent : réexécutable sans créer de doublon.
 */
import { createHash } from "node:crypto";

import dotenv from "dotenv";
import { Client } from "pg";

import {
  DeterministicEmbeddings,
  faqEmbeddingText,
  toPgVector,
} from "../src/lib/moderation/embeddings";
import { triageMessage } from "../src/lib/moderation/triage";
import { computeWindowExpiry } from "../src/lib/moderation/response-window";
import type {
  ConversationKind,
  ModerationChannel,
} from "../src/lib/moderation/types";

dotenv.config({ path: ".env.local", quiet: true });

const provider = new DeterministicEmbeddings();

/** UUID stable dérivé d'une clé : rejouer l'amorçage ne recrée rien. */
function stableId(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

// --- FAQ de démonstration --------------------------------------------------

type FaqSeed = {
  key: string;
  question: string;
  variants: string[];
  fr: string;
  en: string | null;
  category: string;
  channels: ModerationChannel[];
  usage: number;
  validations: number;
  corrections: number;
  confidence: number;
};

const CATEGORIES = ["Livraison", "SAV & retours", "Produit", "Commande", "Boutique"];

const FAQ: FaqSeed[] = [
  {
    key: "delais",
    question: "Quels sont les délais de livraison ?",
    variants: [
      "combien de temps pour recevoir ma commande",
      "quand vais-je recevoir mon colis",
      "ça arrive quand",
      "delai expedition",
    ],
    fr: "Nos commandes partent sous 24 h ouvrées et arrivent en 2 à 4 jours en France métropolitaine. Vous recevez un lien de suivi dès l'expédition.",
    en: "Orders ship within 24 business hours and arrive in 2–4 days within mainland France. You get a tracking link as soon as it ships.",
    category: "Livraison",
    channels: [],
    usage: 47,
    validations: 44,
    corrections: 3,
    confidence: 1,
  },
  {
    key: "retour",
    question: "Comment retourner ou échanger un article ?",
    variants: [
      "procedure de retour",
      "renvoyer un article",
      "je veux échanger ma taille",
      "retour gratuit",
    ],
    fr: "Vous avez 30 jours pour nous retourner un article non porté, étiquette d'origine attachée. Le bon de retour se génère depuis votre espace commande, et le renvoi est à notre charge.",
    en: "You have 30 days to return an unworn item with its original tag. Generate the return label from your order page — return shipping is on us.",
    category: "SAV & retours",
    channels: [],
    usage: 31,
    validations: 26,
    corrections: 5,
    confidence: 0.9,
  },
  {
    key: "tailles",
    question: "Comment choisir ma taille ?",
    variants: ["guide des tailles", "je fais du 38", "taille grand ou petit"],
    fr: "Un guide des tailles est disponible sur chaque fiche produit. Nos modèles taillent normalement ; en cas d'hésitation entre deux tailles, nous conseillons la plus grande.",
    en: "A size guide is on every product page. Our items fit true to size; if you are between two sizes, we recommend sizing up.",
    category: "Produit",
    channels: [],
    usage: 28,
    validations: 25,
    corrections: 3,
    confidence: 1,
  },
  {
    key: "suivi",
    question: "Où en est ma commande ?",
    variants: ["suivi de commande", "numero de suivi", "tracking", "colis bloqué"],
    fr: "Le lien de suivi vous est envoyé par email à l'expédition. Si le suivi n'a pas bougé depuis 48 h, écrivez-nous votre numéro de commande et nous ouvrons une enquête auprès du transporteur.",
    en: "Your tracking link is emailed at dispatch. If tracking hasn't moved in 48 hours, send us your order number and we'll open an inquiry with the carrier.",
    category: "Commande",
    channels: [],
    usage: 39,
    validations: 30,
    corrections: 9,
    // Souvent corrigée : elle remontera dans « à retravailler ».
    confidence: 0.55,
  },
  {
    key: "paiement",
    question: "Quels moyens de paiement acceptez-vous ?",
    variants: ["paiement en plusieurs fois", "vous prenez paypal", "cb visa"],
    fr: "Nous acceptons les cartes bancaires, PayPal et Apple Pay. Le paiement en trois fois sans frais est disponible dès 80 € d'achat.",
    en: "We accept credit cards, PayPal and Apple Pay. Interest-free payment in three instalments is available from €80.",
    category: "Commande",
    channels: [],
    usage: 18,
    validations: 18,
    corrections: 0,
    confidence: 1,
  },
  {
    key: "boutique",
    question: "Avez-vous une boutique physique ?",
    variants: ["adresse magasin", "on peut essayer sur place", "horaires"],
    fr: "Notre boutique est au 12 rue de la Paix à Paris, ouverte du mardi au samedi de 11 h à 19 h.",
    en: null,
    category: "Boutique",
    channels: ["instagram", "facebook"],
    usage: 12,
    validations: 11,
    corrections: 1,
    confidence: 1,
  },
  {
    key: "stock",
    question: "Quand ce produit sera-t-il de nouveau en stock ?",
    variants: ["reassort", "rupture de stock", "alerte dispo"],
    fr: "Les réassorts arrivent en général sous 3 à 4 semaines. Activez l'alerte « Prévenez-moi » sur la fiche produit pour être informé en premier.",
    en: "Restocks usually arrive within 3–4 weeks. Turn on the \"Notify me\" alert on the product page to hear first.",
    category: "Produit",
    channels: [],
    usage: 22,
    validations: 19,
    corrections: 3,
    confidence: 0.95,
  },
  {
    key: "international",
    question: "Livrez-vous à l'étranger ?",
    variants: ["livraison belgique suisse", "do you ship abroad", "international shipping"],
    fr: "Nous livrons dans toute l'Union européenne, en Suisse et au Royaume-Uni. Comptez 5 à 7 jours ouvrés et 9 € de frais de port.",
    en: "We ship across the EU, Switzerland and the UK. Allow 5–7 business days and €9 shipping.",
    category: "Livraison",
    channels: [],
    usage: 15,
    validations: 14,
    corrections: 1,
    confidence: 1,
  },
];

// --- Conversations de démonstration ---------------------------------------

type ConversationSeed = {
  key: string;
  channel: ModerationChannel;
  kind: ConversationKind;
  handle: string;
  status: string;
  hoursAgo: number;
  messages: { from: "client" | "brand"; body: string; hoursAgo: number }[];
  draft?: { body: string; confidence: number; sources: string[]; status: string };
};

const CONVERSATIONS: ConversationSeed[] = [
  {
    key: "camille-livraison",
    channel: "instagram",
    kind: "dm",
    handle: "camille.rvl",
    status: "to_process",
    hoursAgo: 2,
    messages: [
      {
        from: "client",
        body: "Bonjour ! J'ai commandé samedi, ça arrive quand normalement ?",
        hoursAgo: 2,
      },
    ],
    draft: {
      body: "Bonjour ! Nos commandes partent sous 24 h ouvrées et arrivent en 2 à 4 jours en France métropolitaine. Vous recevrez un lien de suivi dès l'expédition.",
      confidence: 0.94,
      sources: ["delais"],
      status: "proposed",
    },
  },
  {
    key: "marc-taille",
    channel: "instagram",
    kind: "comment",
    handle: "marc_dubois",
    status: "to_process",
    hoursAgo: 4,
    messages: [
      {
        from: "client",
        body: "Je fais du 38 d'habitude, je prends quelle taille chez vous ?",
        hoursAgo: 4,
      },
    ],
    draft: {
      body: "Un guide des tailles est disponible sur chaque fiche produit. Nos modèles taillent normalement ; entre deux tailles, nous conseillons la plus grande.",
      confidence: 0.91,
      sources: ["tailles"],
      status: "proposed",
    },
  },
  {
    key: "sarah-remboursement",
    channel: "facebook",
    kind: "dm",
    handle: "Sarah Lemoine",
    status: "to_process",
    hoursAgo: 6,
    messages: [
      {
        from: "client",
        body: "Ça fait trois semaines que j'attends, je veux être remboursée immédiatement. C'est de l'arnaque.",
        hoursAgo: 6,
      },
    ],
    // Signalé : aucun brouillon automatique, lecture humaine obligatoire.
  },
  {
    key: "james-shipping",
    channel: "instagram",
    kind: "dm",
    handle: "james.whitfield",
    status: "to_process",
    hoursAgo: 9,
    messages: [
      {
        from: "client",
        body: "Hi! Do you ship to the UK and how long does it take?",
        hoursAgo: 9,
      },
    ],
    draft: {
      body: "Hi! We ship across the EU, Switzerland and the UK. Allow 5–7 business days and €9 shipping.",
      confidence: 0.89,
      sources: ["international"],
      status: "proposed",
    },
  },
  {
    key: "lea-recrutement",
    channel: "instagram",
    kind: "dm",
    handle: "lea.mrtn",
    status: "to_process",
    hoursAgo: 11,
    messages: [
      {
        from: "client",
        body: "Bonjour, est-ce que vous recrutez des alternants en communication pour la rentrée ?",
        hoursAgo: 11,
      },
    ],
    // Hors FAQ : « sans réponse disponible », traitement manuel.
  },
  {
    key: "nadia-whatsapp",
    channel: "whatsapp",
    kind: "dm",
    handle: "+33 6 12 34 56 78",
    status: "awaiting_validation",
    hoursAgo: 14,
    messages: [
      { from: "client", body: "Vous acceptez le paiement en plusieurs fois ?", hoursAgo: 14 },
    ],
    draft: {
      body: "Nous acceptons les cartes bancaires, PayPal et Apple Pay. Le paiement en trois fois sans frais est disponible dès 80 € d'achat.",
      confidence: 0.96,
      sources: ["paiement"],
      status: "proposed",
    },
  },
  {
    key: "thomas-suivi",
    channel: "facebook",
    kind: "comment",
    handle: "Thomas Girard",
    status: "sent",
    hoursAgo: 26,
    messages: [
      { from: "client", body: "Mon suivi ne bouge plus depuis 4 jours…", hoursAgo: 26 },
      {
        from: "brand",
        body: "Le lien de suivi vous est envoyé à l'expédition. Le suivi n'ayant pas bougé depuis 48 h, envoyez-nous votre numéro de commande : nous ouvrons une enquête auprès du transporteur.",
        hoursAgo: 25,
      },
    ],
    draft: {
      body: "Le lien de suivi vous est envoyé à l'expédition. Le suivi n'ayant pas bougé depuis 48 h, envoyez-nous votre numéro de commande : nous ouvrons une enquête auprès du transporteur.",
      confidence: 0.87,
      sources: ["suivi"],
      status: "sent",
    },
  },
  {
    key: "spam-crypto",
    channel: "instagram",
    kind: "comment",
    handle: "crypto_signals_pro",
    status: "to_process",
    hoursAgo: 3,
    messages: [
      {
        from: "client",
        body: "Check my profile for free followers, dm me for info 🚀",
        hoursAgo: 3,
      },
    ],
  },
  {
    key: "julie-allergie",
    channel: "instagram",
    kind: "dm",
    handle: "julie.bnt",
    status: "to_process",
    hoursAgo: 5,
    messages: [
      {
        from: "client",
        body: "Ma fille est allergique au latex, est-ce qu'il y en a dans vos semelles ?",
        hoursAgo: 5,
      },
    ],
  },
  {
    key: "olivier-snoozed",
    channel: "facebook",
    kind: "dm",
    handle: "Olivier Petit",
    status: "snoozed",
    hoursAgo: 30,
    messages: [
      {
        from: "client",
        body: "Vous feriez une remise pour une commande groupée de 20 pièces ?",
        hoursAgo: 30,
      },
    ],
  },
  {
    key: "ines-hors-outil",
    channel: "instagram",
    kind: "dm",
    handle: "ines.kd",
    status: "answered_elsewhere",
    hoursAgo: 20,
    messages: [
      { from: "client", body: "Vous avez une boutique sur Paris ?", hoursAgo: 20 },
      {
        from: "brand",
        body: "Oui, 12 rue de la Paix, du mardi au samedi de 11 h à 19 h !",
        hoursAgo: 19,
      },
    ],
  },
];

const STORY_MENTIONS = [
  { key: "story-1", handle: "camille.rvl", hoursAgo: 4 },
  { key: "story-2", handle: "atelier.dune", hoursAgo: 11 },
  { key: "story-3", handle: "marc_dubois", hoursAgo: 21 },
];

// --- Amorçage --------------------------------------------------------------

async function main() {
  const reset = process.argv.includes("--reset");
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL absent de .env.local.");
    process.exit(1);
  }

  const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    const { rows: orgs } = await db.query<{ id: string }>(
      "select id from organizations where slug = 'antidotes'",
    );
    const orgId = orgs[0]?.id;
    if (!orgId) throw new Error("Organisation « antidotes » introuvable.");

    const { rows: workspaces } = await db.query<{ id: string }>(
      "select id from workspaces where slug = 'bondet'",
    );

    const clientId = stableId("moderation-client:bondet");

    if (reset) {
      await db.query("delete from moderation_clients where id = $1", [clientId]);
      console.log("Données de démonstration effacées.");
    }

    await db.query(
      `insert into moderation_clients
         (id, org_id, workspace_id, slug, name, locale_default, locales_active,
          tone_settings, auto_send_settings)
       values ($1, $2, $3, 'bondet', 'Bondet', 'fr', array['fr','en'],
               $4::jsonb, $5::jsonb)
       on conflict (id) do update set name = excluded.name`,
      [
        clientId,
        orgId,
        workspaces[0]?.id ?? null,
        JSON.stringify({
          address: "vous",
          signature: null,
          emojis_allowed: false,
          target_length: "short",
        }),
        JSON.stringify({
          enabled: false,
          min_confidence: 0.92,
          hourly_cap: 15,
          emergency_stop: false,
          eligible_channels: [],
          eligible_categories: [],
        }),
      ],
    );

    // --- Connexions ---
    for (const channel of ["instagram", "facebook", "whatsapp"] as const) {
      await db.query(
        `insert into channel_connections
           (id, client_id, channel, external_account_id, display_name,
            ingestion_mode, status)
         values ($1, $2, $3, $4, $5, 'webhook', 'pending')
         on conflict (client_id, channel, external_account_id) do nothing`,
        [
          stableId(`conn:${channel}`),
          clientId,
          channel,
          `demo_${channel}_account`,
          `Bondet · ${channel}`,
        ],
      );
    }

    // --- Catégories ---
    const categoryIds = new Map<string, string>();
    for (const [index, name] of CATEGORIES.entries()) {
      const id = stableId(`cat:${name}`);
      categoryIds.set(name, id);
      await db.query(
        `insert into faq_categories (id, client_id, name, position)
         values ($1, $2, $3, $4)
         on conflict (client_id, name) do nothing`,
        [id, clientId, name, index],
      );
    }

    // --- Entrées FAQ, avec embeddings ---
    const faqIds = new Map<string, string>();
    for (const entry of FAQ) {
      const id = stableId(`faq:${entry.key}`);
      faqIds.set(entry.key, id);

      const embedding = await provider.embed(
        faqEmbeddingText({
          question_canonical: entry.question,
          variants: entry.variants,
        }),
      );

      await db.query(
        `insert into faq_entries
           (id, client_id, question_canonical, variants, answer_fr, answer_en,
            category_id, channels, active, confidence, usage_count,
            direct_validation_count, correction_count, embedding, embedding_source)
         values ($1,$2,$3,$4,$5,$6,$7,$8::moderation_channel[],true,$9,$10,$11,$12,$13::vector,$14)
         on conflict (id) do update set
           answer_fr = excluded.answer_fr,
           answer_en = excluded.answer_en,
           variants = excluded.variants,
           embedding = excluded.embedding,
           confidence = excluded.confidence,
           usage_count = excluded.usage_count,
           direct_validation_count = excluded.direct_validation_count,
           correction_count = excluded.correction_count`,
        [
          id,
          clientId,
          entry.question,
          entry.variants,
          entry.fr,
          entry.en,
          categoryIds.get(entry.category) ?? null,
          entry.channels,
          entry.confidence,
          entry.usage,
          entry.validations,
          entry.corrections,
          toPgVector(embedding),
          provider.id,
        ],
      );

      // Une version initiale, pour que l'historique ne soit pas vide.
      await db.query(
        `insert into faq_entry_versions
           (id, faq_entry_id, client_id, version, snapshot, diff, reason)
         values ($1, $2, $3, 1, $4::jsonb, '{}'::jsonb, 'Import initial')
         on conflict (faq_entry_id, version) do nothing`,
        [
          stableId(`faqv:${entry.key}:1`),
          id,
          clientId,
          JSON.stringify({
            question_canonical: entry.question,
            variants: entry.variants,
            answer_fr: entry.fr,
            answer_en: entry.en,
            channels: entry.channels,
            priority: 0,
            active: true,
          }),
        ],
      );
    }

    // --- Conversations ---
    const now = Date.now();
    for (const seed of CONVERSATIONS) {
      const conversationId = stableId(`conv:${seed.key}`);
      const firstInbound = seed.messages.find((m) => m.from === "client")!;
      const lastAt = new Date(now - seed.hoursAgo * 3600_000);
      const triage = triageMessage(firstInbound.body);

      await db.query(
        `insert into conversations
           (id, client_id, connection_id, channel, external_thread_id, kind,
            participant_external_id, participant_handle, status, priority, unread,
            flags, detected_locale, excerpt, message_count, last_message_at,
            response_window_expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::conversation_status,$10::conversation_priority,
                 $11,$12,$13,$14,$15,$16,$17)
         on conflict (id) do update set
           status = excluded.status,
           flags = excluded.flags,
           excerpt = excluded.excerpt,
           last_message_at = excluded.last_message_at`,
        [
          conversationId,
          clientId,
          stableId(`conn:${seed.channel}`),
          seed.channel,
          `thread_${seed.key}`,
          seed.kind,
          `user_${seed.key}`,
          seed.handle,
          seed.status,
          triage.priority,
          seed.status === "to_process",
          triage.flags,
          triage.locale,
          firstInbound.body.slice(0, 160),
          seed.messages.length,
          lastAt.toISOString(),
          seed.kind === "dm"
            ? computeWindowExpiry(
                new Date(now - firstInbound.hoursAgo * 3600_000),
              ).toISOString()
            : null,
        ],
      );

      for (const [index, message] of seed.messages.entries()) {
        await db.query(
          `insert into messages
             (id, conversation_id, client_id, direction, external_message_id,
              author_handle, body, origin, sent_at)
           values ($1,$2,$3,$4::message_direction,$5,$6,$7,$8::message_origin,$9)
           on conflict (conversation_id, external_message_id) do nothing`,
          [
            stableId(`msg:${seed.key}:${index}`),
            conversationId,
            clientId,
            message.from === "client" ? "inbound" : "outbound",
            `ext_${seed.key}_${index}`,
            message.from === "client" ? seed.handle : "Bondet",
            message.body,
            message.from === "client"
              ? "platform"
              : seed.key === "ines-hors-outil"
                ? "platform" // répondu depuis l'app Instagram, hors outil
                : "antidotes",
            new Date(now - message.hoursAgo * 3600_000).toISOString(),
          ],
        );
      }

      if (seed.draft) {
        await db.query(
          `insert into drafts
             (id, conversation_id, client_id, body, locale, confidence, model,
              prompt_version, status, sources)
           values ($1,$2,$3,$4,$5,$6,'claude-opus-5','moderation-draft-2026-07-30',
                   $7::draft_status,$8::jsonb)
           on conflict (id) do update set
             body = excluded.body, status = excluded.status`,
          [
            stableId(`draft:${seed.key}`),
            conversationId,
            clientId,
            seed.draft.body,
            triage.locale,
            seed.draft.confidence,
            seed.draft.status,
            JSON.stringify(
              seed.draft.sources.map((key) => {
                const entry = FAQ.find((f) => f.key === key)!;
                return {
                  faq_entry_id: faqIds.get(key),
                  question: entry.question,
                  similarity: 0.8 + Math.random() * 0.15,
                };
              }),
            ),
          ],
        );
      }
    }

    // --- Mentions en story ---
    for (const mention of STORY_MENTIONS) {
      await db.query(
        `insert into story_mentions
           (id, client_id, channel, external_id, author_handle, permalink,
            published_at, expires_at, status, reshare_supported)
         values ($1,$2,'instagram',$3,$4,$5,$6,$7,'new',true)
         on conflict (client_id, channel, external_id) do nothing`,
        [
          stableId(`story:${mention.key}`),
          clientId,
          mention.key,
          mention.handle,
          `https://instagram.com/stories/${mention.handle}/`,
          new Date(now - mention.hoursAgo * 3600_000).toISOString(),
          new Date(now + (24 - mention.hoursAgo) * 3600_000).toISOString(),
        ],
      );
    }

    // --- Journal d'audit ---
    await db.query(
      `insert into moderation_audit_log (client_id, action, after)
       values ($1, 'demo.seed', $2::jsonb)`,
      [
        clientId,
        JSON.stringify({
          faq_entries: FAQ.length,
          conversations: CONVERSATIONS.length,
          story_mentions: STORY_MENTIONS.length,
        }),
      ],
    );

    const counts = await db.query<{ label: string; total: string }>(
      `select 'FAQ' as label, count(*)::text as total from faq_entries where client_id = $1
       union all select 'Conversations', count(*)::text from conversations where client_id = $1
       union all select 'Messages', count(*)::text from messages where client_id = $1
       union all select 'Brouillons', count(*)::text from drafts where client_id = $1
       union all select 'Mentions', count(*)::text from story_mentions where client_id = $1`,
      [clientId],
    );
    for (const row of counts.rows) console.log(`${row.label.padEnd(14)} ${row.total}`);
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
