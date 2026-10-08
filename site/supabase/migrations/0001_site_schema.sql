-- Le site antidotes.agency : leads du lead magnet, réponses du questionnaire,
-- rendez-vous, et une boîte d'envoi pour les courriels.
--
-- Aucune table n'est lisible ni modifiable par l'API REST : la RLS est
-- activée sans politique, et toute écriture passe par des fonctions
-- `security definer` qui exigent la clé du site. Le serveur Next.js est le
-- seul appelant.

create extension if not exists pgcrypto;

create type public.lead_locale as enum ('fr', 'en');
create type public.lead_temperature as enum ('chaud', 'tiede', 'froid');
create type public.booking_status as enum ('confirmed', 'cancelled');
create type public.outbox_status as enum ('pending', 'sent', 'failed');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale public.lead_locale not null default 'fr',
  consent_at timestamptz not null default now(),
  consent_text text not null,
  utm jsonb not null default '{}'::jsonb,
  user_agent text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_email_idx on public.leads (lower(email));

create table public.lead_answers (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  -- La note sur 10 : calculée par le site, jamais affichée au prospect.
  score numeric(4, 1),
  temperature public.lead_temperature,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prospect_timezone text not null,
  prospect_name text,
  prospect_company text,
  prospect_phone text,
  notes text,
  locale public.lead_locale not null default 'fr',
  status public.booking_status not null default 'confirmed',
  calendar_event_id text,
  meet_url text,
  cancel_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at)
);
-- Le verrou anti-doublon : un créneau confirmé ne se prend qu'une fois.
create unique index bookings_slot_idx on public.bookings (starts_at) where status = 'confirmed';
create index bookings_lead_idx on public.bookings (lead_id);
create unique index bookings_cancel_token_idx on public.bookings (cancel_token);

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_pending_idx on public.outbox (created_at) where status = 'pending';

create table public.rate_limits (
  bucket text primary key,
  hits integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.lead_answers enable row level security;
alter table public.bookings enable row level security;
alter table public.outbox enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.leads, public.lead_answers, public.bookings, public.outbox, public.rate_limits
  from anon, authenticated;

-- --- Fonctions -------------------------------------------------------------

create or replace function public.site_guard(p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected text := current_setting('app.site_key', true);
begin
  if expected is null or expected = '' or p_key is null or p_key <> expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.site_ping(p_key text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return 'ok';
end;
$$;

create or replace function public.rate_check(
  p_key text,
  p_bucket text,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_hits integer;
begin
  perform public.site_guard(p_key);
  insert into public.rate_limits (bucket, hits, window_started_at)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
      when public.rate_limits.window_started_at < now() - p_window then 1
      else public.rate_limits.hits + 1
    end,
    window_started_at = case
      when public.rate_limits.window_started_at < now() - p_window then now()
      else public.rate_limits.window_started_at
    end
  returning hits into row_hits;
  return row_hits <= p_limit;
end;
$$;

create or replace function public.create_lead(
  p_key text,
  p_email text,
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
      set locale = p_locale, timezone = coalesce(p_timezone, timezone), updated_at = now()
      where id = existing;
    return query select existing, false;
    return;
  end if;
  insert into public.leads (email, locale, consent_text, utm, user_agent, timezone)
  values (lower(p_email), p_locale, p_consent_text, coalesce(p_utm, '{}'::jsonb), p_user_agent, p_timezone)
  returning id into new_id;
  insert into public.outbox (kind, payload)
  values ('lead_created', jsonb_build_object('lead_id', new_id, 'email', lower(p_email), 'locale', p_locale, 'utm', coalesce(p_utm, '{}'::jsonb), 'timezone', p_timezone));
  return query select new_id, true;
end;
$$;

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
begin
  perform public.site_guard(p_key);
  select email, locale into lead_email, lead_locale from public.leads where id = p_lead_id;
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
    values ('questionnaire_completed', jsonb_build_object('lead_id', p_lead_id, 'email', lead_email, 'locale', lead_locale, 'answers', p_answers, 'score', p_score, 'temperature', p_temperature));
  end if;
end;
$$;

create or replace function public.booked_ranges(p_key text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return query
    select b.starts_at, b.ends_at from public.bookings b
    where b.status = 'confirmed' and b.ends_at > p_from and b.starts_at < p_to
    order by b.starts_at;
end;
$$;

create or replace function public.book_slot(
  p_key text,
  p_lead_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_name text,
  p_company text,
  p_phone text,
  p_notes text,
  p_locale public.lead_locale
)
returns table (booking_id uuid, cancel_token text, email text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_email text;
  new_id uuid;
  new_token text;
  answers_payload jsonb;
  temp public.lead_temperature;
  sc numeric;
begin
  perform public.site_guard(p_key);
  select l.email into lead_email from public.leads l where l.id = p_lead_id;
  if lead_email is null then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if p_starts_at < now() + interval '1 hour' then
    raise exception 'slot_in_past' using errcode = 'P0001';
  end if;
  begin
    insert into public.bookings (lead_id, starts_at, ends_at, prospect_timezone, prospect_name, prospect_company, prospect_phone, notes, locale)
    values (p_lead_id, p_starts_at, p_ends_at, p_timezone, p_name, p_company, p_phone, p_notes, p_locale)
    returning id, bookings.cancel_token into new_id, new_token;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = '23505';
  end;
  select a.answers, a.temperature, a.score into answers_payload, temp, sc from public.lead_answers a where a.lead_id = p_lead_id;
  insert into public.outbox (kind, payload)
  values ('booking_created', jsonb_build_object(
    'booking_id', new_id, 'lead_id', p_lead_id, 'email', lead_email, 'locale', p_locale,
    'starts_at', p_starts_at, 'ends_at', p_ends_at, 'timezone', p_timezone,
    'name', p_name, 'company', p_company, 'phone', p_phone, 'notes', p_notes,
    'cancel_token', new_token, 'answers', answers_payload, 'temperature', temp, 'score', sc));
  return query select new_id, new_token, lead_email;
end;
$$;

create or replace function public.set_booking_calendar(
  p_key text,
  p_booking_id uuid,
  p_cancel_token text,
  p_event_id text,
  p_meet_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  update public.bookings
    set calendar_event_id = coalesce(p_event_id, calendar_event_id),
        meet_url = coalesce(p_meet_url, meet_url)
    where id = p_booking_id and cancel_token = p_cancel_token;
end;
$$;

create or replace function public.get_booking(p_key text, p_cancel_token text)
returns table (
  booking_id uuid, email text, starts_at timestamptz, ends_at timestamptz,
  prospect_timezone text, prospect_name text, status public.booking_status,
  calendar_event_id text, meet_url text, locale public.lead_locale
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return query
    select b.id, l.email, b.starts_at, b.ends_at, b.prospect_timezone, b.prospect_name, b.status,
           b.calendar_event_id, b.meet_url, b.locale
    from public.bookings b join public.leads l on l.id = b.lead_id
    where b.cancel_token = p_cancel_token;
end;
$$;

create or replace function public.cancel_booking(p_key text, p_cancel_token text)
returns table (booking_id uuid, email text, starts_at timestamptz, calendar_event_id text, locale public.lead_locale, prospect_name text, prospect_timezone text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b record;
begin
  perform public.site_guard(p_key);
  update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where cancel_token = p_cancel_token and status = 'confirmed'
    returning id, lead_id, bookings.starts_at, bookings.calendar_event_id, bookings.locale, bookings.prospect_name, bookings.prospect_timezone into b;
  if b.id is null then
    return;
  end if;
  insert into public.outbox (kind, payload)
  select 'booking_cancelled', jsonb_build_object('booking_id', b.id, 'email', l.email, 'starts_at', b.starts_at, 'timezone', b.prospect_timezone, 'name', b.prospect_name, 'locale', b.locale)
  from public.leads l where l.id = b.lead_id;
  return query select b.id, l.email, b.starts_at, b.calendar_event_id, b.locale, b.prospect_name, b.prospect_timezone from public.leads l where l.id = b.lead_id;
end;
$$;

create or replace function public.enqueue(p_key text, p_kind text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  perform public.site_guard(p_key);
  insert into public.outbox (kind, payload) values (p_kind, p_payload) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.outbox_take(p_key text, p_limit integer)
returns setof public.outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return query
    update public.outbox o
      set attempts = o.attempts + 1
      where o.id in (
        select id from public.outbox
        where status = 'pending' and attempts < 8
        order by created_at
        limit greatest(1, least(p_limit, 50))
        for update skip locked
      )
      returning o.*;
end;
$$;

create or replace function public.outbox_settle(p_key text, p_id uuid, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  update public.outbox
    set status = case when p_ok then 'sent'::public.outbox_status
                      when attempts >= 8 then 'failed'::public.outbox_status
                      else 'pending'::public.outbox_status end,
        sent_at = case when p_ok then now() else sent_at end,
        last_error = case when p_ok then null else p_error end
    where id = p_id;
end;
$$;

create or replace function public.upcoming_bookings(p_key text, p_from timestamptz, p_to timestamptz)
returns table (
  booking_id uuid, email text, starts_at timestamptz, ends_at timestamptz,
  prospect_timezone text, prospect_name text, meet_url text, locale public.lead_locale, cancel_token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.site_guard(p_key);
  return query
    select b.id, l.email, b.starts_at, b.ends_at, b.prospect_timezone, b.prospect_name, b.meet_url, b.locale, b.cancel_token
    from public.bookings b join public.leads l on l.id = b.lead_id
    where b.status = 'confirmed' and b.starts_at >= p_from and b.starts_at < p_to
    order by b.starts_at;
end;
$$;

revoke all on function public.site_guard(text) from public, anon, authenticated;
grant execute on function
  public.site_ping(text),
  public.rate_check(text, text, integer, interval),
  public.create_lead(text, text, public.lead_locale, text, jsonb, text, text),
  public.save_answers(text, uuid, jsonb, numeric, public.lead_temperature, boolean),
  public.booked_ranges(text, timestamptz, timestamptz),
  public.book_slot(text, uuid, timestamptz, timestamptz, text, text, text, text, text, public.lead_locale),
  public.set_booking_calendar(text, uuid, text, text, text),
  public.get_booking(text, text),
  public.cancel_booking(text, text),
  public.enqueue(text, text, jsonb),
  public.outbox_take(text, integer),
  public.outbox_settle(text, uuid, boolean, text),
  public.upcoming_bookings(text, timestamptz, timestamptz)
to anon;

notify pgrst, 'reload schema';
