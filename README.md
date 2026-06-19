# AuditorX

AuditorX is an MVP technical debt reviewer for pull requests. The current MVP
uses a GitHub Action: the workflow sends a PR diff to `/api/reviews`, AuditorX
returns a markdown review, and the workflow posts that review as a PR comment.

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill in Supabase values.

Use mock AI mode while testing without API cost:

```bash
AI_REVIEW_MODE=mock
```

Set `AUDITORX_API_TOKEN` to a shared secret. The GitHub Action sends it as a
Bearer token when calling `/api/reviews`.

## GitHub Action

Create an account at `/login`, add a repository project, then copy the project
workflow from `/app/projects/[id]/setup`.

For a generic template, copy `examples/auditorx-review.yml` into a test
repository at:

```text
.github/workflows/auditorx-review.yml
```

Then add a repository secret named `AUDITORX_API_TOKEN` with the same value used
by the project setup page.

For project reports, also add:

```text
AUDITORX_PROJECT_ID
```

## Supabase

Run these migrations before testing waitlist, projects, or review persistence:

```text
supabase/migrations/001_initial_mvp.sql
supabase/migrations/002_action_first_cleanup.sql
supabase/migrations/003_membership_projects.sql
```
