-- La clé du site vit dans une table plutôt que dans un réglage de session :
-- un `alter database ... set` ne vaut que pour les connexions ouvertes
-- ensuite, et le pool de PostgREST garde les siennes.
create table public.site_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.site_secrets enable row level security;
revoke all on public.site_secrets from anon, authenticated;

create or replace function public.site_guard(p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected text;
begin
  select value into expected from public.site_secrets where name = 'site_key';
  if expected is null or expected = '' or p_key is null or p_key <> expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.site_guard(text) from public, anon, authenticated;
notify pgrst, 'reload schema';
