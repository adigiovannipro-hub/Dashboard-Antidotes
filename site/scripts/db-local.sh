#!/usr/bin/env bash
# Un Postgres jetable qui rejoue le socle et les migrations du site, puis pose
# la clé du site. Sert au simulateur d'API REST (scripts/rpc-shim.mjs) pour
# les tests locaux — le bac à sable ne joint pas Supabase.
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=${PGDATA_LOCAL:-/tmp/antidotes-site-pg}
PORT=${PGPORT_LOCAL:-5544}
KEY=${SITE_DB_KEY:-cle-locale-de-test}
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$DIR" ]; then
  "$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust -E UTF8 >/dev/null
fi
if ! "$PGBIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$DIR/log" start >/dev/null
  sleep 1
fi
export PGPASSWORD=
psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -c "drop database if exists site;" -c "create database site;" postgres
psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -d site -f "$HERE/bootstrap-local.sql"
for f in "$HERE"/../supabase/migrations/*.sql; do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -d site -f "$f"
done
psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -d site -c "insert into public.site_secrets (name, value) values ('site_key', '$KEY') on conflict (name) do update set value = excluded.value;"
echo "postgres local prêt : postgres://postgres@127.0.0.1:$PORT/site (clé du site : $KEY)"
