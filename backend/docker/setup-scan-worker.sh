#!/bin/sh
set -eu

# Idempotent provisioning for the local Docker stack, including existing volumes.
# SQL literals are quoted by PostgreSQL, never interpolated into shell commands.
psql -v ON_ERROR_STOP=1 --set=worker_password="$AUDITORX_DB_WORKER_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE auditorx_worker LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditorx_worker') \gexec
SELECT format('ALTER ROLE auditorx_worker WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'worker_password') \gexec
GRANT auditorx_scan_worker TO auditorx_worker;
SQL
