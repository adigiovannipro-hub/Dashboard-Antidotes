# Plan d'implémentation — Module Modération

## Contexte

Le module remplace la Boîte de réception Meta Business Suite par un outil interne
multi-canal et multi-clients : réponse générée depuis une base FAQ propre à
chaque client, validation humaine avant tout envoi, et enrichissement de la FAQ
à chaque refus.

Il est **interne**. Aucune route, aucun lien, aucun compteur n'est exposé dans un
espace client. La visibilité est restreinte aux rôles `owner` et `operator`.

**Périmètre V1** : un seul client actif (Bondet), mais `client_id` sur toutes les
tables et zéro code spécifique à Bondet en dur, pour brancher I-WAY et les
suivants sans refonte.

## Décision : aucun accès réseau aux plateformes en preview

Sur instruction explicite, **aucune connexion réelle** n'est établie avec Meta,
TikTok, Instagram, Facebook, WhatsApp ou LinkedIn à ce stade. Ce qui est
construit malgré tout, parce que c'est l'architecture et non le branchement :

- l'interface `ChannelConnector` commune aux sept canaux ;
- les routes webhook avec vérification de signature HMAC et déduplication ;
- la file de reprise des webhooks en échec, avec backoff exponentiel ;
- le chiffrement AES-256-GCM des tokens et leur rotation ;
- le calcul de la fenêtre de réponse Meta (24 h, extension `human_agent` à 7 j) ;
- le budget de rate limit par canal.

Ces éléments tournent sur des données de démonstration réalistes. Le branchement
réel consiste à renseigner les variables d'environnement et à activer la source.

## Modèle de données

```
-- Clients et accès (le module a ses propres rôles, distincts de ceux des espaces)
moderation_clients        id, workspace_id?, slug, name, locale_default,
                          tone_settings jsonb, auto_send_settings jsonb,
                          retention_days?, archived_at
moderation_members        user_id, client_id, role: operator|viewer,
                          requires_approval bool
                          -- `owner` de l'organisation = accès à tous les clients

-- Canaux et connexions
channel_connections       id, client_id, channel: instagram|facebook|whatsapp|
                          tiktok|linkedin|youtube|google_reviews,
                          external_account_id, display_name,
                          credentials_encrypted, token_expires_at,
                          ingestion_mode: webhook|polling, poll_interval_seconds,
                          status, last_polled_at, last_error
webhook_deliveries        id, client_id?, channel, external_event_id,
                          signature_valid, payload jsonb, status: pending|
                          processed|failed|dead, attempts, next_attempt_at, error
                          -- file de reprise ; unique(channel, external_event_id)

-- Conversations et messages
conversations             id, client_id, channel, external_thread_id,
                          kind: dm|comment|story_mention|review,
                          participant_external_id, participant_handle,
                          participant_avatar_url,
                          status: to_process|awaiting_validation|validated|sent|
                                  ignored|snoozed|send_failed|answered_elsewhere,
                          priority: normal|high, unread bool,
                          flags text[],            -- spam, insult, dispute, refund, sensitive
                          detected_locale, last_message_at, first_response_due_at,
                          response_window_expires_at, human_agent_tag_used bool,
                          locked_by, locked_at, lock_expires_at,
                          deleted_at
messages                  id, conversation_id, client_id, direction: inbound|outbound,
                          external_message_id, author_external_id, body,
                          attachments jsonb, sent_at, delivered_at,
                          origin: platform|antidotes|auto_send,
                          -- `platform` = réponse envoyée hors outil, détectée à l'ingestion
                          unique(conversation_id, external_message_id)

-- Brouillons
drafts                    id, conversation_id, client_id, body, locale,
                          confidence numeric, model, prompt_version,
                          status: proposed|validated|refused|sent|expired|
                                  no_answer_available,
                          sources jsonb,   -- [{faq_entry_id, similarity, title}]
                          auto_sent bool, auto_send_rule jsonb,
                          reviewed_by, reviewed_at, sent_at, send_error,
                          bad_auto_reply bool

-- FAQ et apprentissage
faq_entries               id, client_id, question_canonical, variants text[],
                          answer_fr, answer_en, category, channels text[],
                          priority int, active bool,
                          confidence numeric,      -- abaissée par les corrections
                          usage_count, direct_validation_count, correction_count,
                          embedding vector(384), embedding_source,
                          monday_item_id, created_by, updated_at, deleted_at
faq_entry_versions        id, faq_entry_id, version int, snapshot jsonb,
                          diff jsonb, author_id, reason, created_at
                          -- immuable ; rollback = nouvelle version depuis snapshot
faq_categories            id, client_id, name, position

-- Mentions en story
story_mentions            id, client_id, channel, external_id, author_handle,
                          media_url, thumbnail_url, permalink, published_at,
                          expires_at, status: new|reshared|replied|ignored|archived,
                          reshare_supported bool, handled_by, handled_at

-- Import Monday (mapping par configuration, jamais en dur)
monday_imports            id, client_id, board_id, column_mapping jsonb,
                          direction: pull|push, status, preview jsonb,
                          rows_created, rows_updated, error, created_at
                          -- push désactivé par défaut

-- Journal d'audit immuable
moderation_audit_log      id bigserial, actor_id, client_id, channel,
                          conversation_id, faq_entry_id,
                          action, before jsonb, after jsonb, created_at
                          -- aucun UPDATE, aucun DELETE autorisé (trigger)
```

**Index qui portent le produit** : `conversations (client_id, status, last_message_at)`
pour l'inbox et les compteurs ; `conversations (client_id, channel, status)` pour
les pastilles par canal ; index IVFFlat sur `faq_entries.embedding` pour la
recherche vectorielle ; `webhook_deliveries (status, next_attempt_at)` pour la
file de reprise.

## Recherche sémantique — pourquoi un modèle local

L'API Claude ne produit pas d'embeddings. Les fournisseurs payants (Voyage,
OpenAI) sont exclus par la contrainte de coût nul et ajouteraient une dépendance
à un tiers. La solution retenue : **pgvector pour le stockage et la recherche**,
et un modèle d'embedding **exécuté localement** (`all-MiniLM-L6-v2`, 384
dimensions, ~25 Mo, ONNX). Aucun appel réseau, aucun coût, résultats
déterministes.

L'accès passe par une interface `EmbeddingProvider` avec deux implémentations :
le modèle local pour la production, et un fournisseur déterministe par hachage
pour les tests et l'amorçage des données de démonstration — les tests ne doivent
pas dépendre du téléchargement d'un modèle.

## Génération de brouillon

Claude Opus 5 (`claude-opus-5`), pensée adaptative, sortie contrainte par schéma
(`output_config.format`) pour obtenir un objet exploitable plutôt qu'un texte à
parser :

```
{ answer, language, confidence, used_faq_entry_ids[], refusal_reason? }
```

Le prompt ne contient **que** les entrées FAQ retrouvées, et interdit
explicitement toute information non documentée. Si aucune entrée ne dépasse le
seuil de similarité, aucun appel n'est fait : la conversation passe en
`no_answer_available` et attend un traitement manuel. La FAQ est placée avant la
question dans le prompt, derrière un point de cache, pour que le préfixe se
mette en cache d'un message à l'autre.

## Étapes

1. **Migrations** — pgvector, les 14 tables, RLS sur toutes, trigger
   d'immuabilité du journal d'audit, purge par client et suppression d'une
   conversation.
2. **Domaine et tests** — dictionnaire des statuts, détection de langue,
   détection de signalements (spam, insulte, litige, remboursement, sensible),
   fenêtre de réponse Meta, verrou optimiste, garde-fous d'auto-envoi,
   permissions. Tout testé.
3. **FAQ sémantique** — `EmbeddingProvider`, indexation, recherche, seuils.
4. **Génération Claude** — prompt contraint, sources citées, score de confiance.
5. **Boucle d'apprentissage** — box de correction, création ou enrichissement,
   recalcul des embeddings, versionnage avec diff et rollback.
6. **Inbox** — trois colonnes, compteurs temps réel, raccourcis clavier.
7. **Écran FAQ** — CRUD, statistiques par entrée, réglages de ton, CSV.
8. **Mentions, journal d'audit, auto-envoi** — onglets dédiés.
9. **Import Monday** — mapping par configuration, prévisualisation.
10. **Connecteurs** — interface commune, webhooks, file de reprise, chiffrement.

## Vérification

Les cinq domaines de test exigés : matching FAQ (précision du seuil, ordre de
similarité, absence de correspondance), boucle d'apprentissage (création vs
enrichissement, recalcul d'embedding, rollback), verrous de concurrence (deux
opérateurs, expiration, reprise de main), garde-fous d'auto-envoi (seuil,
exclusions, plafond horaire, arrêt d'urgence), permissions (un opérateur client
ne voit pas les autres clients, RLS testée en base).
