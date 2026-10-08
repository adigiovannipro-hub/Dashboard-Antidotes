-- Le prénom du lead, pour s'adresser à lui dans les courriels ; et un garde
-- contre un rappel J-1 envoyé deux fois (le cron peut repasser).
alter table public.leads add column first_name text;

create unique index outbox_reminder_once_idx on public.outbox (kind, (payload->>'booking_id'))
  where kind = 'booking_reminder';

-- L'ancienne signature reste en surcharge : la supprimer bloquait sur un
-- verrou tenu par le pool de PostgREST ; l'API choisit la bonne par ses
-- paramètres nommés.
create or replace function public.create_lead(
  p_key text,
  p_email text,
  p_first_name text,
  p_locale public.lead_locale,
  p_consent_text text,
  p_utm jsonb,
  p_user_agent text,
  p_timezone text
)
returns table (lead_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing uuid;
  new_id uuid;
begin
  perform public.site_guard(p_key);
  select id into existing from public.leads where lower(email) = lower(p_email);
  if existing is not null then
    update public.leads
      set locale = p_locale,
          first_name = coalesce(nullif(p_first_name, ''), first_name),
          timezone = coalesce(p_timezone, timezone),
          updated_at = now()
      where id = existing;
    return query select existing, false;
    return;
  end if;
  insert into public.leads (email, first_name, locale, consent_text, utm, user_agent, timezone)
  values (lower(p_email), nullif(p_first_name, ''), p_locale, p_consent_text, coalesce(p_utm, '{}'::jsonb), p_user_agent, p_timezone)
  returning id into new_id;
  insert into public.outbox (kind, payload)
  values ('lead_created', jsonb_build_object('lead_id', new_id, 'email', lower(p_email), 'first_name', p_first_name, 'locale', p_locale, 'utm', coalesce(p_utm, '{}'::jsonb), 'timezone', p_timezone));
  return query select new_id, true;
end;
$$;
grant execute on function public.create_lead(text, text, text, public.lead_locale, text, jsonb, text, text) to anon;

create or replace function public.save_answers(
  p_key text,
  p_lead_id uuid,
  p_answers jsonb,
  p_score numeric,
  p_temperature public.lead_temperature,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was_completed timestamptz;
  lead_email text;
  lead_locale public.lead_locale;
  lead_first_name text;
begin
  perform public.site_guard(p_key);
  select email, locale, first_name into lead_email, lead_locale, lead_first_name from public.leads where id = p_lead_id;
  if lead_email is null then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  select completed_at into was_completed from public.lead_answers where lead_id = p_lead_id;
  insert into public.lead_answers (lead_id, answers, score, temperature, completed_at)
  values (p_lead_id, p_answers, p_score, p_temperature, case when p_completed then now() else null end)
  on conflict (lead_id) do update
    set answers = excluded.answers,
        score = excluded.score,
        temperature = excluded.temperature,
        completed_at = coalesce(public.lead_answers.completed_at, excluded.completed_at),
        updated_at = now();
  if p_completed and was_completed is null then
    insert into public.outbox (kind, payload)
    values ('questionnaire_completed', jsonb_build_object('lead_id', p_lead_id, 'email', lead_email, 'first_name', lead_first_name, 'locale', lead_locale, 'answers', p_answers, 'score', p_score, 'temperature', p_temperature));
  end if;
end;
$$;

create or replace function public.lead_profile(p_key text, p_lead_id uuid)
returns table (email text, first_name text, locale public.lead_locale, answers jsonb, score numeric, temperature public.lead_temperature, completed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return query
    select l.email, l.first_name, l.locale, a.answers, a.score, a.temperature, a.completed_at
    from public.leads l left join public.lead_answers a on a.lead_id = l.id
    where l.id = p_lead_id;
end;
$$;
grant execute on function public.lead_profile(text, uuid) to anon;

notify pgrst, 'reload schema';
