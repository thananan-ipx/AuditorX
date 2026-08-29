-- No auth.users mutations: ownership references Supabase Auth's existing identity.
-- Review/apply to a test environment first; the application never auto-migrates.
CREATE TABLE public.repositories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    owner_name text NOT NULL CHECK (length(owner_name) BETWEEN 1 AND 39),
    repository_url text NOT NULL CHECK (
        repository_url = 'https://github.com/' || owner_name || '/' || name
        AND repository_url = lower(repository_url)
    ),
    default_branch text NOT NULL DEFAULT 'main' CHECK (length(default_branch) BETWEEN 1 AND 255),
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT repositories_creator_url_key UNIQUE (created_by, repository_url),
    CONSTRAINT repositories_id_creator_key UNIQUE (id, created_by)
);

CREATE TABLE public.repository_members (
    repository_id uuid NOT NULL,
    -- Composite FK proves ownership without a recursive RLS lookup or SECURITY DEFINER.
    repository_owner_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level text NOT NULL CHECK (access_level IN ('owner', 'editor', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (repository_id, user_id),
    FOREIGN KEY (repository_id, repository_owner_id)
        REFERENCES public.repositories(id, created_by) ON DELETE CASCADE
);

CREATE INDEX repository_members_user_repository_idx ON public.repository_members(user_id, repository_id);

ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.repository_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_members FORCE ROW LEVEL SECURITY;

-- Explicit grants work on projects both before and after the Data API default-grant change.
REVOKE ALL ON public.repositories, public.repository_members FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.repositories, public.repository_members TO authenticated;

-- Creator visibility permits INSERT ... RETURNING before the owner membership is inserted.
-- Membership reads are non-recursive: members can only read their own membership row.
CREATE POLICY repositories_read ON public.repositories FOR SELECT TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR id IN (SELECT repository_id FROM public.repository_members WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY repositories_create ON public.repositories FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY repository_members_read ON public.repository_members FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Self-enrollment is limited to the repository's actual creator, never another user's repo.
-- Invites, role changes and transfers are deliberately not exposed in this slice.
CREATE POLICY repository_members_create_owner ON public.repository_members FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid()) AND access_level = 'owner'
    AND repository_owner_id = (SELECT auth.uid())
);
