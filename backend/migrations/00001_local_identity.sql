-- +goose Up
-- Standalone PostgreSQL compatibility for the existing identity and RLS contract.
-- This stores verified external IDs only, not passwords or authentication sessions.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

-- +goose StatementBegin
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- +goose StatementEnd

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT authenticated TO auditorx_api;
GRANT USAGE ON SCHEMA auth TO auditorx_api;
GRANT INSERT ON auth.users TO auditorx_api;

-- +goose Down
DROP FUNCTION auth.uid();
DROP TABLE auth.users;
DROP SCHEMA auth;
REVOKE USAGE ON SCHEMA public FROM authenticated;
REVOKE authenticated FROM auditorx_api;
DROP ROLE authenticated;
DROP ROLE anon;
