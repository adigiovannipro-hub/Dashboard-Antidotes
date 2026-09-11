-- ===========================================================================
-- La FAQ devient une page à elle, et gagne un fil de discussion
--
-- Deux choses, tirées du retour d'écran du 11/09 :
--
--   1. **La couleur d'un thème se choisit.** Elle était jusqu'ici un hachage
--      du nom, stable mais subie : deux thèmes voisins tombaient sur la même
--      famille, et « Livraison » ne pouvait pas prendre le vert qu'on lui
--      associe depuis Monday. La colonne est nullable — sans valeur, l'écran
--      retombe sur le hachage, donc aucune FAQ existante ne change d'aspect.
--
--   2. **Un fil de discussion par élément de langage.** L'agence informe le
--      client et lui demande l'autorisation d'employer une formule ; le
--      client répond au même endroit. Le fil reprend le modèle des retours du
--      planning : `mentions` porte les adresses prévenues par e-mail à
--      l'écriture, par la boîte Gmail des Reçus — aucune seconde boîte.
--
-- `client_id` est dénormalisé alors que `entry_id` le porte déjà : c'est ce
-- qui permet à la politique de trancher sans jointure, comme partout ailleurs
-- dans le dépôt.
-- ===========================================================================

alter table faq_categories add column if not exists color text;

create table if not exists faq_comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references moderation_clients (id) on delete cascade,
  entry_id uuid not null references faq_entries (id) on delete cascade,
  /* L'auteur peut disparaître sans emporter le fil : un message reste lisible
     quand le compte qui l'a écrit n'existe plus, d'où le nom recopié. */
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

/* Le fil d'une entrée, dans l'ordre : c'est la seule lecture qu'en fait
   l'écran. */
create index if not exists faq_comments_entry_idx
  on faq_comments (entry_id, created_at);

notify pgrst, 'reload schema';
