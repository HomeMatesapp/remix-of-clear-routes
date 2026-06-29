
-- Service-level enum + column on roles
DO $$ BEGIN
  CREATE TYPE public.role_service_level AS ENUM ('info_only', 'reality_check', 'full_support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS service_level public.role_service_level NOT NULL DEFAULT 'info_only';

CREATE INDEX IF NOT EXISTS roles_service_level_idx ON public.roles (service_level);

-- Promote the 5 Release 1 careers to reality_check
UPDATE public.roles
   SET service_level = 'reality_check'
 WHERE role_slug IN (
   'registered-nurse',
   'data-analyst',
   'software-engineer',
   'electrician',
   'primary-school-teacher'
 );

-- Role review requests table (users asking us to fully review a role)
CREATE TABLE IF NOT EXISTS public.role_review_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  role_slug TEXT NOT NULL,
  requester_user_id UUID,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT role_review_requests_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS role_review_requests_slug_idx
  ON public.role_review_requests (role_slug, created_at DESC);

-- Lock down: edge-function (service_role) mediated only. No anon/auth grants.
REVOKE ALL ON public.role_review_requests FROM PUBLIC;
REVOKE ALL ON public.role_review_requests FROM anon;
REVOKE ALL ON public.role_review_requests FROM authenticated;
GRANT ALL ON public.role_review_requests TO service_role;

ALTER TABLE public.role_review_requests ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role bypasses RLS, so anon/auth cannot read or write directly.
