-- ===========================================================================
-- L'horloge de la publication de 16h00.
--
-- Ni un cron Vercel (le plan Hobby ne garantit que l'heure, pas la minute, et
-- ses deux créneaux sont pris) ni un `schedule` GitHub (quatre à sept heures
-- de retard, mesurées) ne tiennent la minute. `pg_cron` si : il tourne dans
-- la base, à la seconde, et `pg_net` appelle la route qui publie.
--
-- `pg_cron` compte en UTC. 16h de Paris vaut 14h UTC l'été et 15h l'hiver :
-- deux tâches, et la route ne travaille que lorsqu'il est 16h à Paris —
-- l'autre appel répond « pas ma saison » et ne fait rien.
--
-- Le jeton n'est pas ici : il vit dans le coffre de Supabase (`vault`, secret
-- `publication_cron_secret`), et la même valeur dans
-- `PUBLICATION_CRON_SECRET` côté Vercel. Sans lui, l'appel part sans
-- autorisation et la route répond 401 — rien ne publie à tort.
--
-- Gardée : un Postgres sans `pg_cron` ni `pg_net` (le jetable des rejeux) ne
-- pose rien et le dit. `cron.schedule` remplace une tâche du même nom : la
-- migration se rejoue sans doublon.
-- ===========================================================================

do $migration$
declare
  commande text := $cmd$
    select net.http_post(
      url := 'https://app.antidotes.agency/api/cron/publier',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'publication_cron_secret'),
          ''
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $cmd$;
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron ou pg_net indisponible : horloge de publication non posée.';
    return;
  end if;

  execute 'create extension if not exists pg_cron with schema pg_catalog';
  execute 'create extension if not exists pg_net with schema extensions';

  execute format('select cron.schedule(%L, %L, %L)', 'publication-16h-ete', '0 14 * * *', commande);
  execute format('select cron.schedule(%L, %L, %L)', 'publication-16h-hiver', '0 15 * * *', commande);
end
$migration$;
