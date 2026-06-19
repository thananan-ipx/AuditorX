-- Migrates an existing AuditorX MVP database from the older GitHub App schema
-- to the simpler GitHub Action schema.
--
-- This keeps existing waitlist rows and review rows where possible, adds the
-- columns used by /api/reviews, and removes old GitHub App tables.

create extension if not exists pgcrypto;

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  github_org text,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text,
  pull_number int,
  pull_title text,
  pull_url text,
  score int,
  risk_level text,
  summary text,
  findings jsonb,
  positive_notes jsonb,
  raw_ai_response jsonb,
  github_comment_id bigint,
  created_at timestamptz default now()
);

alter table reviews
  add column if not exists repo_full_name text,
  add column if not exists pull_number int,
  add column if not exists pull_title text,
  add column if not exists pull_url text;

-- Best-effort backfill for review rows created with the older normalized schema.
do $$
begin
  if to_regclass('public.pull_requests') is not null
    and to_regclass('public.repositories') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reviews'
        and column_name = 'pull_request_id'
    )
  then
    update reviews
    set
      repo_full_name = coalesce(reviews.repo_full_name, repositories.full_name),
      pull_number = coalesce(reviews.pull_number, pull_requests.number),
      pull_title = coalesce(reviews.pull_title, pull_requests.title),
      pull_url = coalesce(reviews.pull_url, pull_requests.url)
    from pull_requests
    join repositories on repositories.id = pull_requests.repository_id
    where reviews.pull_request_id = pull_requests.id;
  end if;
end $$;

-- Local/dev cleanup: remove old GitHub App tables that are no longer used.
drop table if exists pull_requests cascade;
drop table if exists repositories cascade;
drop table if exists installations cascade;

alter table reviews
  drop column if exists pull_request_id;

-- For dev rows that could not be backfilled, keep the table insertable by
-- assigning clear placeholders before setting required constraints.
update reviews
set repo_full_name = 'unknown/unknown'
where repo_full_name is null;

update reviews
set pull_number = 0
where pull_number is null;

alter table reviews
  alter column repo_full_name set not null,
  alter column pull_number set not null;

drop index if exists reviews_pull_request_id_created_at_idx;
create index if not exists reviews_repo_pr_created_at_idx
  on reviews(repo_full_name, pull_number, created_at desc);

create index if not exists waitlist_email_idx
  on waitlist(email);
