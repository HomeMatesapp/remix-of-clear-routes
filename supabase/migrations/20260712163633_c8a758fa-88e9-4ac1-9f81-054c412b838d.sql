
-- ============================================================
-- PR 2 — Career-pack storage, publication lifecycle, bindings
-- ============================================================

-- ---------- 1. Enum types ----------
DO $$ BEGIN
  CREATE TYPE public.career_pack_status AS ENUM (
    'draft', 'published', 'review_due', 'suspended', 'superseded', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.career_pack_environment AS ENUM (
    'development', 'staging', 'production'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.career_pack_event_type AS ENUM (
    'imported', 'published', 'marked_review_due', 'suspended',
    'unsuspended', 'superseded', 'archived', 'bound', 'unbound'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. career_pack_identities ----------
CREATE TABLE public.career_pack_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL UNIQUE,
  is_test_identity boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.career_pack_identities TO service_role;
ALTER TABLE public.career_pack_identities ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → fail closed.

-- ---------- 3. career_packs (immutable content) ----------
CREATE TABLE public.career_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  pack_version text NOT NULL,
  schema_version text NOT NULL,
  archetype_id text NOT NULL,
  content_hash text NOT NULL,
  content jsonb NOT NULL,
  owner_identity_id uuid NOT NULL REFERENCES public.career_pack_identities(id) ON DELETE RESTRICT,
  reviewer_identity_id uuid NOT NULL REFERENCES public.career_pack_identities(id) ON DELETE RESTRICT,
  environment public.career_pack_environment NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  imported_by text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_packs_owner_reviewer_distinct
    CHECK (owner_identity_id <> reviewer_identity_id),
  CONSTRAINT career_packs_no_test_in_prod
    CHECK (NOT (is_test AND environment = 'production')),
  CONSTRAINT career_packs_semver
    CHECK (pack_version ~ '^\d+\.\d+\.\d+$'),
  CONSTRAINT career_packs_hash_hex
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (role_id, pack_version),
  UNIQUE (slug, pack_version),
  UNIQUE (content_hash)
);
CREATE INDEX career_packs_role_id_idx ON public.career_packs(role_id);
CREATE INDEX career_packs_slug_idx ON public.career_packs(slug);

GRANT ALL ON public.career_packs TO service_role;
ALTER TABLE public.career_packs ENABLE ROW LEVEL SECURITY;

-- Append-only trigger: no UPDATE, no DELETE on career_packs.
CREATE OR REPLACE FUNCTION public.career_packs_reject_mutations()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'career_packs rows are immutable (op=%)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER career_packs_no_update
  BEFORE UPDATE ON public.career_packs
  FOR EACH ROW EXECUTE FUNCTION public.career_packs_reject_mutations();

CREATE TRIGGER career_packs_no_delete
  BEFORE DELETE ON public.career_packs
  FOR EACH ROW EXECUTE FUNCTION public.career_packs_reject_mutations();

-- ---------- 4. career_pack_publications (mutable lifecycle) ----------
CREATE TABLE public.career_pack_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL UNIQUE REFERENCES public.career_packs(id) ON DELETE RESTRICT,
  status public.career_pack_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  review_due_at timestamptz,
  suspended_at timestamptz,
  superseded_at timestamptz,
  archived_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX career_pack_publications_status_idx
  ON public.career_pack_publications(status);

GRANT ALL ON public.career_pack_publications TO service_role;
ALTER TABLE public.career_pack_publications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER career_pack_publications_touch_updated_at
  BEFORE UPDATE ON public.career_pack_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 5. role_pack_bindings (active binding) ----------
CREATE TABLE public.role_pack_bindings (
  role_id uuid PRIMARY KEY REFERENCES public.roles(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.career_packs(id) ON DELETE RESTRICT,
  bound_at timestamptz NOT NULL DEFAULT now(),
  bound_by text NOT NULL
);
CREATE INDEX role_pack_bindings_pack_id_idx ON public.role_pack_bindings(pack_id);

GRANT ALL ON public.role_pack_bindings TO service_role;
ALTER TABLE public.role_pack_bindings ENABLE ROW LEVEL SECURITY;

-- ---------- 6. career_pack_publication_events (append-only audit) ----------
CREATE TABLE public.career_pack_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.career_packs(id) ON DELETE RESTRICT,
  event_type public.career_pack_event_type NOT NULL,
  from_status public.career_pack_status,
  to_status public.career_pack_status,
  actor text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX career_pack_publication_events_pack_id_idx
  ON public.career_pack_publication_events(pack_id, at);

GRANT ALL ON public.career_pack_publication_events TO service_role;
ALTER TABLE public.career_pack_publication_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.career_pack_events_reject_mutations()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'career_pack_publication_events is append-only (op=%)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER career_pack_events_no_update
  BEFORE UPDATE ON public.career_pack_publication_events
  FOR EACH ROW EXECUTE FUNCTION public.career_pack_events_reject_mutations();

CREATE TRIGGER career_pack_events_no_delete
  BEFORE DELETE ON public.career_pack_publication_events
  FOR EACH ROW EXECUTE FUNCTION public.career_pack_events_reject_mutations();

-- ---------- 7. career_pack_config (single-row settings) ----------
CREATE TABLE public.career_pack_config (
  id boolean PRIMARY KEY DEFAULT true,
  review_due_grace_days integer NOT NULL DEFAULT 30,
  environment public.career_pack_environment NOT NULL DEFAULT 'production',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_pack_config_singleton CHECK (id = true),
  CONSTRAINT career_pack_config_grace_nonnegative CHECK (review_due_grace_days >= 0)
);
INSERT INTO public.career_pack_config (id) VALUES (true);

GRANT SELECT ON public.career_pack_config TO service_role;
GRANT UPDATE ON public.career_pack_config TO service_role;
ALTER TABLE public.career_pack_config ENABLE ROW LEVEL SECURITY;

-- ---------- 8. Servable predicate + binding validation ----------

-- A pack is servable iff its publication status is published, OR review_due
-- and within the configured grace window from review_due_at.
CREATE OR REPLACE FUNCTION public.career_pack_is_servable(_pack_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.career_pack_publications p, public.career_pack_config c
    WHERE p.pack_id = _pack_id
      AND (
        p.status = 'published'
        OR (
          p.status = 'review_due'
          AND p.review_due_at IS NOT NULL
          AND p.review_due_at + make_interval(days => c.review_due_grace_days) >= now()
        )
      )
  );
$$;

-- Trigger on role_pack_bindings: reject binding to non-servable packs.
CREATE OR REPLACE FUNCTION public.role_pack_bindings_check_servable()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.career_pack_is_servable(NEW.pack_id) THEN
    RAISE EXCEPTION 'pack % is not servable and cannot be bound', NEW.pack_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER role_pack_bindings_servable_check
  BEFORE INSERT OR UPDATE ON public.role_pack_bindings
  FOR EACH ROW EXECUTE FUNCTION public.role_pack_bindings_check_servable();

-- ---------- 9. Atomic publish-and-bind procedure ----------
-- Called by the CLI (via service_role) after content import. This is the ONLY
-- supported way to move a draft pack into service and switch the role binding.
CREATE OR REPLACE FUNCTION public.publish_and_bind_career_pack(
  _pack_id uuid,
  _actor text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_prior_pack_id uuid;
  v_prior_status public.career_pack_status;
BEGIN
  SELECT role_id INTO v_role_id FROM public.career_packs WHERE id = _pack_id;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'career pack % does not exist', _pack_id;
  END IF;

  -- Move this pack to published (from draft or review_due).
  UPDATE public.career_pack_publications
    SET status = 'published',
        published_at = COALESCE(published_at, now()),
        suspended_at = NULL,
        superseded_at = NULL,
        archived_at = NULL
    WHERE pack_id = _pack_id;

  INSERT INTO public.career_pack_publication_events(pack_id, event_type, to_status, actor)
    VALUES (_pack_id, 'published', 'published', _actor);

  -- Find any currently bound pack for this role and supersede it.
  SELECT pack_id INTO v_prior_pack_id
    FROM public.role_pack_bindings WHERE role_id = v_role_id;

  IF v_prior_pack_id IS NOT NULL AND v_prior_pack_id <> _pack_id THEN
    SELECT status INTO v_prior_status
      FROM public.career_pack_publications WHERE pack_id = v_prior_pack_id;

    UPDATE public.career_pack_publications
      SET status = 'superseded', superseded_at = now()
      WHERE pack_id = v_prior_pack_id;

    INSERT INTO public.career_pack_publication_events(
      pack_id, event_type, from_status, to_status, actor, metadata)
    VALUES (
      v_prior_pack_id, 'superseded', v_prior_status, 'superseded',
      _actor, jsonb_build_object('superseded_by', _pack_id));
  END IF;

  -- Upsert the binding.
  INSERT INTO public.role_pack_bindings(role_id, pack_id, bound_by)
    VALUES (v_role_id, _pack_id, _actor)
    ON CONFLICT (role_id) DO UPDATE
      SET pack_id = EXCLUDED.pack_id,
          bound_at = now(),
          bound_by = EXCLUDED.bound_by;

  INSERT INTO public.career_pack_publication_events(pack_id, event_type, actor)
    VALUES (_pack_id, 'bound', _actor);
END;
$$;

-- ---------- 10. Server-side resolver ----------
-- Given a canonical role identifier (id OR slug), return the currently
-- servable pack row. Used by the reality-check edge function.
CREATE OR REPLACE FUNCTION public.resolve_active_career_pack(
  _role_id uuid,
  _slug text
)
RETURNS TABLE (
  pack_id uuid,
  role_id uuid,
  slug text,
  pack_version text,
  content_hash text,
  content jsonb,
  status public.career_pack_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.role_id, cp.slug, cp.pack_version, cp.content_hash, cp.content, pub.status
  FROM public.role_pack_bindings b
  JOIN public.career_packs cp ON cp.id = b.pack_id
  JOIN public.career_pack_publications pub ON pub.pack_id = cp.id
  JOIN public.roles r ON r.id = cp.role_id
  WHERE (_role_id IS NOT NULL AND b.role_id = _role_id)
     OR (_role_id IS NULL AND _slug IS NOT NULL AND r.role_slug = _slug)
  LIMIT 1;
$$;

-- ---------- 11. saved_decisions V1 columns ----------
ALTER TABLE public.saved_decisions
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.career_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pack_version text,
  ADD COLUMN IF NOT EXISTS pack_content_hash text,
  ADD COLUMN IF NOT EXISTS evaluator_schema_version text,
  ADD COLUMN IF NOT EXISTS result_v1 jsonb;

CREATE INDEX IF NOT EXISTS saved_decisions_pack_id_idx
  ON public.saved_decisions(pack_id);
