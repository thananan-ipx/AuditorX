#!/bin/sh
set -eu

# Local Docker database only. The API login cannot own tables or bypass RLS.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$AUDITORX_DB_APP_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE auditorx_api LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L',
  :'app_password'
) \gexec
SQL
