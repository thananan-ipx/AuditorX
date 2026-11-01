-- +goose Up
-- Existing UUIDs and repository ownership remain intact. Legacy identities have
-- no password and cannot sign in until an explicit account migration is done.
ALTER TABLE auth.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN email text UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  ADD COLUMN password_hash text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT users_credentials_pair CHECK ((email IS NULL) = (password_hash IS NULL));

CREATE TABLE auth.sessions (
  token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_expiry ON auth.sessions(user_id, expires_at);
CREATE INDEX sessions_expiry ON auth.sessions(expires_at);
REVOKE ALL ON auth.users, auth.sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON auth.users FROM auditorx_api;
GRANT SELECT (id, email, password_hash), INSERT (email, password_hash) ON auth.users TO auditorx_api;
GRANT SELECT, INSERT, DELETE ON auth.sessions TO auditorx_api;

-- +goose Down
DROP TABLE auth.sessions;
REVOKE ALL ON auth.users FROM auditorx_api;
ALTER TABLE auth.users
  DROP CONSTRAINT users_credentials_pair,
  DROP COLUMN email,
  DROP COLUMN password_hash,
  DROP COLUMN created_at,
  ALTER COLUMN id DROP DEFAULT;
GRANT INSERT ON auth.users TO auditorx_api;
