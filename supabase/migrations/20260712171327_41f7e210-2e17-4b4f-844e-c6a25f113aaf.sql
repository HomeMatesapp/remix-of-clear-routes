
-- PR 2 final gate: broaden active-version invariant to cover review_due within
-- grace, expose binding metadata regardless of servability, and add a
-- discriminator column for legacy vs generic-pack V1 saved decisions.

-- 1. Replace the one-published trigger with one that also treats review_due
--    within grace as "actively serving". Prevents two concurrently servable
--    packs for the same role via published+review_due combinations.
DROP TRIGGER IF EXISTS career_pack_publications_one_published_trg ON public.career_pack_publications;
DROP FUNCTION IF EXISTS public.career_pack_publications_one_published();

CREATE OR REPLACE FUNCTION public.career_pack_publications_one_active()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_grace_days int;
  v_conflicts int;
BEGIN
  IF NEW.status NOT IN ('published', 'review_due') THEN
    RETURN NEW;
  END IF;
  SELECT role_id INTO v_role_id FROM public.career_packs WHERE id = NEW.pack_id;
  SELECT review_due_grace_days INTO v_grace_days FROM public.career_pack_config;
  -- Count other packs on the same role that are also actively serving:
  --   - status = 'published', OR
  --   - status = 'review_due' AND review_due_at + grace >= now()
  -- If NEW is review_due, require review_due_at to be present and within grace
  -- as a serving row; if it's already outside grace we treat it as
  -- non-serving and skip the invariant.
  IF NEW.status = 'review_due'
     AND (NEW.review_due_at IS NULL
          OR NEW.review_due_at + make_interval(days => v_grace_days) < now()) THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_conflicts
    FROM public.career_pack_publications p
    JOIN public.career_packs cp ON cp.id = p.pack_id
   WHERE cp.role_id = v_role_id
     AND p.pack_id <> NEW.pack_id
     AND (
       p.status = 'published'
       OR (p.status = 'review_due'
           AND p.review_due_at IS NOT NULL
           AND p.review_due_at + make_interval(days => v_grace_days) >= now())
     );
  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'another actively-serving publication for role % already exists', v_role_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.career_pack_publications_one_active() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER career_pack_publications_one_active_trg
  BEFORE INSERT OR UPDATE ON public.career_pack_publications
  FOR EACH ROW EXECUTE FUNCTION public.career_pack_publications_one_active();

-- 2. Handler-facing resolver: returns binding pack whether or not it is
--    servable, plus a computed is_servable flag and geographic_scope pulled
--    from the pack content. The reality-check handler uses this to
--    distinguish "no binding → legacy fallthrough" from "binding exists but
--    not serving → controlled pack_unavailable".
CREATE OR REPLACE FUNCTION public.resolve_role_pack_binding(
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
  status public.career_pack_status,
  role_slug text,
  review_due_at timestamptz,
  is_servable boolean,
  geographic_scope jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_resolved_role uuid;
BEGIN
  IF _role_id IS NOT NULL AND _slug IS NOT NULL THEN
    SELECT r.id INTO v_resolved_role FROM public.roles r
      WHERE r.id = _role_id AND r.role_slug = _slug;
    IF v_resolved_role IS NULL THEN RETURN; END IF;
  ELSIF _role_id IS NOT NULL THEN
    v_resolved_role := _role_id;
  ELSIF _slug IS NOT NULL THEN
    SELECT r.id INTO v_resolved_role FROM public.roles r WHERE r.role_slug = _slug;
    IF v_resolved_role IS NULL THEN RETURN; END IF;
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cp.id, cp.role_id, cp.slug, cp.pack_version, cp.content_hash, cp.content,
           pub.status, r.role_slug, pub.review_due_at,
           public.career_pack_is_servable(cp.id),
           COALESCE(cp.content -> 'geographicScope', 'null'::jsonb)
    FROM public.role_pack_bindings b
    JOIN public.career_packs cp ON cp.id = b.pack_id
    JOIN public.career_pack_publications pub ON pub.pack_id = cp.id
    JOIN public.roles r ON r.id = cp.role_id
    WHERE b.role_id = v_resolved_role
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_role_pack_binding(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_role_pack_binding(uuid, text) TO service_role;

-- 3. Saved-decisions: add an explicit evaluation-source discriminator and
--    replace the all-or-nothing constraint so it only enforces the generic-
--    pack V1 consistency rule for source = 'generic_pack_v1'. Legacy engines
--    continue to write with source = 'legacy_engine' and all pack_* columns
--    NULL — their V1 adapter output remains a rendering-only concern.
ALTER TABLE public.saved_decisions
  ADD COLUMN IF NOT EXISTS evaluation_source text NOT NULL DEFAULT 'legacy_engine';

ALTER TABLE public.saved_decisions
  DROP CONSTRAINT IF EXISTS saved_decisions_v1_all_or_nothing;

ALTER TABLE public.saved_decisions
  ADD CONSTRAINT saved_decisions_evaluation_source_chk CHECK (
    evaluation_source IN ('legacy_engine', 'generic_pack_v1')
  );

ALTER TABLE public.saved_decisions
  ADD CONSTRAINT saved_decisions_source_shape_chk CHECK (
    (evaluation_source = 'legacy_engine'
      AND pack_id IS NULL AND pack_version IS NULL AND pack_content_hash IS NULL
      AND evaluator_schema_version IS NULL AND result_v1 IS NULL)
    OR
    (evaluation_source = 'generic_pack_v1'
      AND pack_id IS NOT NULL AND pack_version IS NOT NULL AND pack_content_hash IS NOT NULL
      AND evaluator_schema_version IS NOT NULL AND result_v1 IS NOT NULL)
  );
