-- ===========================================================================
-- Les réponses enregistrées de l'Inbox
--
-- Une bibliothèque par client de modération : les formules qu'on retape dix
-- fois par semaine — le mot d'accueil d'un message privé, le lien vers le
-- suivi de commande, la phrase qui redirige vers le SAV.
--
-- Pourquoi une table plutôt que la FAQ : une entrée de FAQ répond à une
-- **question** et alimente la recherche sémantique et l'apprentissage. Une
-- réponse enregistrée est un bout de texte qu'on colle, sans question en face.
-- Les mélanger polluerait la FAQ d'entrées sans question, donc invisibles de
-- la recherche et nuisibles à la boucle de correction.
--
-- Le tenant est `client_id`, comme les treize autres tables du module : les
-- helpers `app.moderation_client_ids()` et `app.moderation_writable_client_ids()`
-- s'appliquent tels quels. Schéma et RLS en deux fichiers, comme 0004/0005.
-- ===========================================================================

create table if not exists saved_replies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,

  /* Le nom qu'on cherche dans la liste. Court par nature : c'est lui qu'on
     lit, pas le corps. */
  title text not null,
  body text not null,

  /* Étiquettes libres — « SAV », « livraison », « accueil ». Elles servent la
     recherche, pas le classement : une réponse en porte souvent deux. */
  tags text[] not null default '{}',

  /* La portée : à quel type de fil la réponse sert. Vide = partout. Un mot
     d'accueil de message privé n'a rien à faire sous un commentaire public,
     et l'y proposer fait perdre le temps qu'on croyait gagner. */
  scope conversation_kind[] not null default '{}',

  /* Combien de fois elle a servi : la liste met les plus utilisées en tête,
     sans qu'on ait à les ranger à la main. */
  usage_count integer not null default 0,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* Deux réponses du même nom chez le même client ne se distinguent pas dans
     une liste : la contrainte évite le doublon créé par mégarde depuis le
     composeur. */
  unique (client_id, title)
);

create index if not exists saved_replies_client_idx
  on saved_replies (client_id, usage_count desc);
