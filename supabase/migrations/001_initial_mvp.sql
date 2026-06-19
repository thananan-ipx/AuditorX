-- AuditorX MVP schema.
-- Run this in Supabase SQL editor or through the Supabase CLI before testing
-- waitlist capture and GitHub Action based PR reviews.

create extension if not exists pgcrypto;

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  pull_number int not null,
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

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  github_org text,
  created_at timestamptz default now()
);

create index if not exists reviews_repo_pr_created_at_idx
  on reviews(repo_full_name, pull_number, created_at desc);

create index if not exists waitlist_email_idx
  on waitlist(email);
