-- ===========================================================================
-- Pôle « Antidotes », phase 3 — les séquences : schéma
--
-- Les tables existent depuis 20260907a (séquences, étapes, inscriptions,
-- désinscription définitive par trigger). Cette migration leur donne ce que
-- l'envoi réel demande, sans nouvelle table :
--
--   • `settings` sur la séquence — le lien de case study, le plafond
--     quotidien, la fenêtre d'envoi, la signature, le message LinkedIn ;
--     un jsonb parce que ce sont des réglages à forme complète par défaut
--     (`resolveSequenceSettings`), pas des colonnes qu'une requête filtre.
--   • sur l'inscription : le **canal** figé à l'inscription (email ou piste
--     LinkedIn — le statut d'adresse peut changer ensuite, l'inscription non),
--     la personnalisation (l'observation tirée du site ou des pubs), le fil
--     Gmail et le dernier Message-ID pour que les relances répondent dans le
--     même fil, la raison d'une pause, la dernière erreur, les dates.
--   • un **jeton de désinscription** par contact : le lien de chaque email
--     le porte, la page publique le résout. Généré en base plutôt qu'en
--     code, pour que tout contact — importé, saisi, sourcé — en ait un.
--
-- Deux valeurs d'enum s'ajoutent au journal (`bounce`, `opt_out`) et une
-- source de tâche à « Mon travail » (`antidotes`) : la piste LinkedIn d'un
-- contact `risky` est une tâche manuelle, et c'est là qu'on la fait.
-- `add value` passe dans la transaction du runner tant que la valeur n'est
-- pas utilisée dans le même fichier — elle ne l'est pas.
-- ===========================================================================

-- --- Séquences : réglages --------------------------------------------------

alter table antidotes_sequences
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- --- Inscriptions : ce que l'envoi réel demande ----------------------------

alter table antidotes_sequence_enrollments
  add column if not exists channel antidotes_outreach_channel not null default 'email',
  add column if not exists personalization jsonb not null default '{}'::jsonb,
  add column if not exists thread_id text,
  add column if not exists last_message_id text,
  add column if not exists last_sent_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists stopped_at timestamptz,
  add column if not exists paused_reason text,
  add column if not exists last_error text;

-- Le relevé des réponses parcourt les inscriptions qui ont un fil.
create index if not exists antidotes_sequence_enrollments_thread_idx
  on antidotes_sequence_enrollments (thread_id)
  where thread_id is not null;

-- --- Contacts : le jeton de désinscription ----------------------------------

/* 32 hexadécimaux tirés d'un UUID v4 : 122 bits d'aléa, sans extension.
   Le défaut est évalué ligne par ligne à l'ajout de la colonne, donc les
   contacts existants reçoivent chacun le leur. */
alter table antidotes_contacts
  add column if not exists unsubscribe_token text not null
    default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists antidotes_contacts_unsubscribe_token_idx
  on antidotes_contacts (unsubscribe_token);

-- --- Journal : rebond et désinscription -------------------------------------

alter type antidotes_interaction_type add value if not exists 'bounce';
alter type antidotes_interaction_type add value if not exists 'opt_out';

-- --- Mon travail : la piste LinkedIn est une tâche --------------------------

alter type work_task_source add value if not exists 'antidotes';
