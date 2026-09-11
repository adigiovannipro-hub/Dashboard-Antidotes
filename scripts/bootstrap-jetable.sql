-- Le socle d'un Postgres jetable, façon Supabase — à jouer AVANT `pnpm db:migrate`
-- sur une base neuve, et seulement là.
--
--   createdb rejeu && psql -d rejeu -f scripts/bootstrap-jetable.sql
--   SUPABASE_DB_URL="postgres://…/rejeu?sslmode=disable" pnpm db:migrate
--
-- Il existe parce que le rejeu obligatoire avant de pousser une migration est
-- le seul filet qui reste (les migrations partent seules au push sur `main`),
-- et que ce socle a été réécrit de mémoire au moins trois fois. Ce qu'il faut
-- imiter, et qui n'est pas évident :
--
--   * les trois rôles PostgREST, dont `service_role` en `bypassrls` ;
--   * `auth.uid()` et `auth.jwt()`, sur lesquels reposent toutes les politiques ;
--   * les **privilèges par défaut** de Supabase : sans eux, toute table créée
--     après 0002 rend des « permission denied » trompeurs en simulation RLS —
--     c'est précisément parce que Supabase accorde tout par défaut que chaque
--     migration RLS d'ici termine par son `revoke … from anon` nominatif ;
--   * `storage.buckets.file_size_limit` et `storage.objects.path_tokens`, sans
--     lesquels 0007 échoue.
create extension if not exists "pgcrypto";
create extension if not exists vector;

do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  metadata jsonb
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/') $$;

grant usage on schema public, storage to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Colonnes de `storage` que les migrations du dépôt attendent. Supabase les
-- pose, un schéma imité de mémoire les oublie — et 0007 s'arrête dessus.
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];
alter table storage.buckets add column if not exists owner uuid;
alter table storage.objects add column if not exists path_tokens text[];
