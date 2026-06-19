# AuditorX Supabase MVP

Run `supabase/migrations/001_initial_mvp.sql` before testing the MVP.

If you already ran the older GitHub App schema, run
`supabase/migrations/002_action_first_cleanup.sql` once to migrate the database
to the GitHub Action version.

Run `supabase/migrations/003_membership_projects.sql` to add Supabase Auth
users, projects, project API tokens, and project-scoped reports.

Tables:

- `reviews`: GitHub Action submitted PR review summaries. Full diffs are not stored.
- `projects`: repositories owned by signed-in users.
- `project_members`: lightweight future team membership table.
- `profiles`: user profile records keyed by Supabase Auth users.
- `waitlist`: early access leads from the landing page.

Security notes:

- `SUPABASE_SERVICE_ROLE_KEY` is used only by server-only helpers under `lib/supabase`.
- Browser code should only ever receive `SUPABASE_ANON_KEY`.
- Add RLS policies before exposing any dashboard or admin views in production.
