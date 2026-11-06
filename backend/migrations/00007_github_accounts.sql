-- +goose Up
-- GitHub-only accounts have a verified email but no local password.
ALTER TABLE auth.users DROP CONSTRAINT users_credentials_pair;
ALTER TABLE auth.users ADD CONSTRAINT users_password_requires_email CHECK (password_hash IS NULL OR email IS NOT NULL);

CREATE TABLE auth.github_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id bigint NOT NULL UNIQUE CHECK (github_id > 0),
  login text NOT NULL,
  token_ciphertext bytea NOT NULL,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth.github_oauth_states (
  state_hash bytea PRIMARY KEY,
  browser_hash bytea NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  verifier text NOT NULL,
  next_path text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE TABLE auth.github_repositories (
  repository_id uuid PRIMARY KEY REFERENCES public.repositories(id) ON DELETE CASCADE,
  github_id bigint NOT NULL CHECK (github_id > 0),
  installation_id bigint NOT NULL CHECK (installation_id > 0)
);
REVOKE ALL ON auth.github_accounts, auth.github_oauth_states, auth.github_repositories FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.github_accounts TO auditorx_api;
GRANT SELECT, INSERT, DELETE ON auth.github_oauth_states TO auditorx_api;
GRANT SELECT, INSERT ON auth.github_repositories TO auditorx_api;

-- Workers can retrieve a credential only for the requester of a currently leased
-- job with current write membership. No general SELECT on account tokens is granted.
-- +goose StatementBegin
CREATE FUNCTION public.github_scan_credential(job_id uuid, job_lease uuid)
RETURNS TABLE(github_id bigint, installation_id bigint, account_id bigint, token_ciphertext bytea, token_expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(g.github_id,0), coalesce(g.installation_id,0), a.github_id, a.token_ciphertext, a.token_expires_at
  FROM public.scan_jobs j
  LEFT JOIN auth.github_repositories g ON g.repository_id = j.repository_id
  LEFT JOIN auth.github_accounts a ON a.user_id = j.requested_by AND g.repository_id IS NOT NULL
  WHERE j.id = job_id AND j.lease_token = job_lease AND j.status = 'running'
    AND j.lease_expires_at > now() AND j.source_kind = 'github'
    AND EXISTS (SELECT 1 FROM public.repository_members m
      WHERE m.repository_id = j.repository_id AND m.user_id = j.requested_by
      AND m.access_level IN ('owner', 'editor'))
$$;
-- +goose StatementEnd
REVOKE ALL ON FUNCTION public.github_scan_credential(uuid,uuid) FROM PUBLIC, anon, authenticated, auditorx_api;
GRANT EXECUTE ON FUNCTION public.github_scan_credential(uuid,uuid) TO auditorx_scan_worker;

-- +goose Down
-- Refuse rollback while GitHub-only accounts exist; silently dropping their
-- credentials would leave valid sessions attached to unusable accounts.
ALTER TABLE auth.users ADD CONSTRAINT users_credentials_pair CHECK ((email IS NULL) = (password_hash IS NULL));
ALTER TABLE auth.users DROP CONSTRAINT users_password_requires_email;
DROP FUNCTION public.github_scan_credential(uuid,uuid);
DROP TABLE auth.github_repositories, auth.github_oauth_states, auth.github_accounts;
