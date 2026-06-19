-- Adds simple membership, repository projects, and project-linked reports.
-- Run after 001/002 in existing MVP databases.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  repo_full_name text not null,
  api_token_hash text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(owner_user_id, repo_full_name)
);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

alter table reviews
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists projects_owner_user_id_idx
  on projects(owner_user_id);

create index if not exists projects_repo_full_name_idx
  on projects(repo_full_name);

create index if not exists project_members_user_id_idx
  on project_members(user_id);

create index if not exists reviews_project_id_created_at_idx
  on reviews(project_id, created_at desc);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table reviews enable row level security;

drop policy if exists "Profiles are visible to their owner" on profiles;
create policy "Profiles are visible to their owner"
  on profiles for select
  using (id = auth.uid());

drop policy if exists "Users can upsert their own profile" on profiles;
create policy "Users can upsert their own profile"
  on profiles for insert
  with check (id = auth.uid());

drop policy if exists "Project owners can read projects" on projects;
create policy "Project owners can read projects"
  on projects for select
  using (owner_user_id = auth.uid());

drop policy if exists "Users can create owned projects" on projects;
create policy "Users can create owned projects"
  on projects for insert
  with check (owner_user_id = auth.uid());

drop policy if exists "Project owners can update projects" on projects;
create policy "Project owners can update projects"
  on projects for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Project members can read memberships" on project_members;
create policy "Project members can read memberships"
  on project_members for select
  using (user_id = auth.uid());

drop policy if exists "Project owners can create memberships" on project_members;
create policy "Project owners can create memberships"
  on project_members for insert
  with check (
    exists (
      select 1
      from projects
      where projects.id = project_members.project_id
        and projects.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Project members can read reviews" on reviews;
create policy "Project members can read reviews"
  on reviews for select
  using (
    project_id is null
    or exists (
      select 1
      from projects
      where projects.id = reviews.project_id
        and projects.owner_user_id = auth.uid()
    )
  );
