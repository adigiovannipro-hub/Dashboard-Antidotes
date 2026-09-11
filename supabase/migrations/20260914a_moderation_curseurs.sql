-- ===========================================================================
-- Les curseurs de publication du relevé d'Inbox
--
-- Le relevé redemandait les commentaires de **toutes** les publications des
-- soixante derniers jours, à chaque passage. Ouvrir l'inbox déclenchait donc
-- le rattrapage entier du compte : des minutes d'attente pour, au mieux, trois
-- commentaires nouveaux.
--
-- Raccourcir la fenêtre des publications ne réglait rien : un commentaire
-- arrive aujourd'hui sous un reel d'il y a six semaines, et une fenêtre d'un
-- jour ne l'aurait jamais vu. Ce qu'il faut raccourcir, ce n'est pas la liste
-- des publications — Meta la rend en un ou deux appels — c'est ce qu'on
-- **descend** ensuite.
--
-- Meta rend `comments_count` gratuitement dans ce listing, sur les médias
-- Instagram comme sur les posts de Page. Ce compteur, mémorisé ici, dit quelles
-- publications ont bougé depuis le dernier passage : le relevé du jour ne
-- descend que celles-là. Le relevé complet de la nuit, lui, redescend tout et
-- se contente de remettre les curseurs à jour — c'est la passe de réparation,
-- celle qui rattrape un compteur menteur ou un appel refusé.
--
-- Le tenant est `client_id`, comme les treize autres tables du module : les
-- helpers `app.moderation_client_ids()` et `app.moderation_writable_client_ids()`
-- s'appliquent tels quels. Schéma et RLS en deux fichiers, comme 0004/0005.
-- ===========================================================================

create table if not exists moderation_post_cursors (
  client_id uuid not null references moderation_clients (id) on delete cascade,
  channel moderation_channel not null,

  /* L'identifiant de la publication chez la plateforme — un média Instagram,
     un post de Page, une vidéo YouTube demain. */
  post_external_id text not null,

  /* Le compteur tel que le listing l'a rendu au dernier passage **réussi**.
     Écrit après la descente des commentaires, jamais avant : un appel refusé
     doit être retenté au passage suivant, pas classé comme vu. */
  comments_count integer not null default 0,

  last_seen_at timestamptz not null default now(),

  primary key (client_id, channel, post_external_id)
);

-- La lecture du relevé est toujours « tous les curseurs de ce canal chez ce
-- client » : la clé primaire la sert déjà, préfixe à gauche.
