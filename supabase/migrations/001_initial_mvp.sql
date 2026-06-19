-- AuditorX MVP schema.
-- Run this in Supabase SQL editor or through the Supabase CLI before testing
-- waitlist capture, GitHub installation persistence, PR records, and reviews.

create extension if not exists pgcrypto;

create table if not exists installations (
  id uuid primary key default gen_random_uuid(),
  github_installation_id bigint not null unique,
  account_login text,
  account_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references installations(id),
  github_repo_id bigint not null unique,
  owner text not null,
  name text not null,
  full_name text not null,
  private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id),
  github_pr_id bigint not null,
  number int not null,
  title text,
  url text,
  state text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(repository_id, number)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  pull_request_id uuid references pull_requests(id),
  score int,
  risk_level text,
  summary text,
  findings jsonb,
  positive_notes jsonb,
  raw_ai_response jsonb,
  github_comment_id bigint,
  created_at timestamptz default now()
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  github_org text,
  created_at timestamptz default now()
);

create index if not exists repositories_installation_id_idx
  on repositories(installation_id);

create index if not exists pull_requests_repository_id_idx
  on pull_requests(repository_id);

create index if not exists reviews_pull_request_id_created_at_idx
  on reviews(pull_request_id, created_at desc);

create index if not exists waitlist_email_idx
  on waitlist(email);
