-- ===========================================================================
-- 20261007b — Le planning se met à jour sans recharger
--
-- Un wording écrit par Claude via le connecteur MCP, un sujet créé, un statut
-- changé par un client : le tableau ouvert ailleurs le voyait au prochain
-- rechargement seulement. Les tables du tableau rejoignent la publication
-- Realtime de Supabase ; l'écran s'abonne aux changements de son tableau et
-- se relit. Realtime applique la RLS de la session : un client ne reçoit que
-- les lignes qu'il peut déjà lire.
--
-- Gardé par l'existence de la publication : un Postgres jetable n'en a pas,
-- et une ligne déjà publiée n'est pas ajoutée deux fois.
-- ===========================================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['planning_subjects', 'planning_lanes', 'planning_months', 'planning_comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
