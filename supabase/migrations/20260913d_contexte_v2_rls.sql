-- ===========================================================================
-- Contexte client v2 — Row Level Security
--
-- Même périmètre que `client_context` en 0033 : le pilotage de la génération
-- est owner-only de bout en bout. Un client — même membre de l'espace, même
-- authentifié — ne lit ni n'écrit rien ici. Le lien de navigation est masqué
-- et la page rend 404, mais c'est la base qui fait foi : un appel REST direct
-- avec un jeton client ne rend aucune ligne.
--
-- Les trois colonnes ajoutées à `client_context` par 20260913c n'ont besoin
-- d'aucune politique : `client_context_owner` est un `for all` sur la table,
-- et la RLS filtre des lignes, pas des colonnes.
-- ===========================================================================

alter table client_generation_settings enable row level security;

-- Une seule politique `all` : lecture et écriture ont exactement le même
-- périmètre, les séparer ne documenterait rien.
create policy client_generation_settings_owner on client_generation_settings
  for all to authenticated
  using (app.owns_workspace(workspace_id))
  with check (app.owns_workspace(workspace_id));

/* Le rôle `anon` ne doit rien pouvoir lire, y compris par accident : le
   `revoke all` de 0002 ne couvre que les tables existant à cet instant. */
revoke all on client_generation_settings from anon;
