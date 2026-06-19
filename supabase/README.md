# AuditorX Supabase MVP

Run `supabase/migrations/001_initial_mvp.sql` before testing the MVP.

Tables:

- `installations`: GitHub App installation metadata.
- `repositories`: repositories connected to an installation.
- `pull_requests`: PR records reviewed by AuditorX.
- `reviews`: AI review summaries and GitHub comment ids. Full diffs are not stored.
- `waitlist`: early access leads from the landing page.

Security notes:

- `SUPABASE_SERVICE_ROLE_KEY` is used only by server-only helpers under `lib/supabase`.
- Browser code should only ever receive `SUPABASE_ANON_KEY`.
- Add RLS policies before exposing any dashboard or admin views in production.
