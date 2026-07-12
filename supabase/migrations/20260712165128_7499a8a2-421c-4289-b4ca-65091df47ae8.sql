
-- Drop old signature so we can change return type.
DROP FUNCTION IF EXISTS public.publish_and_bind_career_pack(uuid, text);

CREATE OR REPLACE FUNCTION public.publish_and_bind_career_pack(
  _pack_id uuid,
  _actor text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_prior_pack_id uuid;
  v_prior_status public.career_pack_status;
  v_current_status public.career_pack_status;
  v_changed boolean := false;
BEGIN
  SELECT role_id INTO v_role_id FROM public.career_packs WHERE id = _pack_id;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'career pack % does not exist', _pack_id;
  END IF;

  SELECT status INTO v_current_status
    FROM public.career_pack_publications WHERE pack_id = _pack_id;

  SELECT pack_id INTO v_prior_pack_id
    FROM public.role_pack_bindings WHERE role_id = v_role_id;

  IF v_current_status = 'published' AND v_prior_pack_id IS NOT DISTINCT FROM _pack_id THEN
    RETURN jsonb_build_object('changed', false, 'pack_id', _pack_id, 'role_id', v_role_id);
  END IF;

  IF v_current_status <> 'published' THEN
    UPDATE public.career_pack_publications
      SET status = 'published',
          published_at = COALESCE(published_at, now()),
          suspended_at = NULL,
          superseded_at = NULL,
          archived_at = NULL
      WHERE pack_id = _pack_id;
    INSERT INTO public.career_pack_publication_events(pack_id, event_type, from_status, to_status, actor)
      VALUES (_pack_id, 'published', v_current_status, 'published', _actor);
    v_changed := true;
  END IF;

  IF v_prior_pack_id IS NOT NULL AND v_prior_pack_id <> _pack_id THEN
    SELECT status INTO v_prior_status
      FROM public.career_pack_publications WHERE pack_id = v_prior_pack_id;
    UPDATE public.career_pack_publications
      SET status = 'superseded', superseded_at = now()
      WHERE pack_id = v_prior_pack_id;
    INSERT INTO public.career_pack_publication_events(
      pack_id, event_type, from_status, to_status, actor, metadata)
    VALUES (v_prior_pack_id, 'superseded', v_prior_status, 'superseded',
            _actor, jsonb_build_object('superseded_by', _pack_id));
    v_changed := true;
  END IF;

  IF v_prior_pack_id IS DISTINCT FROM _pack_id THEN
    INSERT INTO public.role_pack_bindings(role_id, pack_id, bound_by)
      VALUES (v_role_id, _pack_id, _actor)
      ON CONFLICT (role_id) DO UPDATE
        SET pack_id = EXCLUDED.pack_id,
            bound_at = now(),
            bound_by = EXCLUDED.bound_by;
    INSERT INTO public.career_pack_publication_events(pack_id, event_type, actor)
      VALUES (_pack_id, 'bound', _actor);
    v_changed := true;
  END IF;

  RETURN jsonb_build_object('changed', v_changed, 'pack_id', _pack_id, 'role_id', v_role_id);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_and_bind_career_pack(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_and_bind_career_pack(uuid, text) TO service_role;

-- Binding integrity: role_pack_bindings.role_id must equal the pack's role_id.
CREATE OR REPLACE FUNCTION public.role_pack_bindings_check_role_matches()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_pack_role uuid;
BEGIN
  SELECT role_id INTO v_pack_role FROM public.career_packs WHERE id = NEW.pack_id;
  IF v_pack_role IS NULL THEN
    RAISE EXCEPTION 'pack % does not exist', NEW.pack_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_pack_role <> NEW.role_id THEN
    RAISE EXCEPTION 'binding role_id % does not match pack role_id %', NEW.role_id, v_pack_role
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.role_pack_bindings_check_role_matches() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS role_pack_bindings_role_match_check ON public.role_pack_bindings;
CREATE TRIGGER role_pack_bindings_role_match_check
  BEFORE INSERT OR UPDATE ON public.role_pack_bindings
  FOR EACH ROW EXECUTE FUNCTION public.role_pack_bindings_check_role_matches();

-- One-active-pack invariant via trigger (subquery-based unique indexes are not allowed).
CREATE OR REPLACE FUNCTION public.career_pack_publications_one_published()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_role_id uuid; v_count int;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT role_id INTO v_role_id FROM public.career_packs WHERE id = NEW.pack_id;
  SELECT COUNT(*) INTO v_count
    FROM public.career_pack_publications p
    JOIN public.career_packs cp ON cp.id = p.pack_id
    WHERE cp.role_id = v_role_id AND p.status = 'published' AND p.pack_id <> NEW.pack_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'another publication for role % is already published', v_role_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.career_pack_publications_one_published() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS career_pack_publications_one_published_trg ON public.career_pack_publications;
CREATE TRIGGER career_pack_publications_one_published_trg
  BEFORE INSERT OR UPDATE ON public.career_pack_publications
  FOR EACH ROW EXECUTE FUNCTION public.career_pack_publications_one_published();

-- Resolver: role/slug consistency + fail-closed servability.
DROP FUNCTION IF EXISTS public.resolve_active_career_pack(uuid, text);
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
  status public.career_pack_status,
  role_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_resolved_role uuid;
BEGIN
  IF _role_id IS NOT NULL AND _slug IS NOT NULL THEN
    SELECT r.id INTO v_resolved_role FROM public.roles r WHERE r.id = _role_id AND r.role_slug = _slug;
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
    SELECT cp.id, cp.role_id, cp.slug, cp.pack_version, cp.content_hash, cp.content, pub.status, r.role_slug
    FROM public.role_pack_bindings b
    JOIN public.career_packs cp ON cp.id = b.pack_id
    JOIN public.career_pack_publications pub ON pub.pack_id = cp.id
    JOIN public.roles r ON r.id = cp.role_id
    WHERE b.role_id = v_resolved_role
      AND public.career_pack_is_servable(cp.id)
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_active_career_pack(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_active_career_pack(uuid, text) TO service_role;

-- saved_decisions consistency: V1 columns are all-or-nothing.
ALTER TABLE public.saved_decisions DROP CONSTRAINT IF EXISTS saved_decisions_v1_all_or_nothing;
ALTER TABLE public.saved_decisions
  ADD CONSTRAINT saved_decisions_v1_all_or_nothing CHECK (
    (pack_id IS NULL AND pack_version IS NULL AND pack_content_hash IS NULL
       AND evaluator_schema_version IS NULL AND result_v1 IS NULL)
    OR
    (pack_id IS NOT NULL AND pack_version IS NOT NULL AND pack_content_hash IS NOT NULL
       AND evaluator_schema_version IS NOT NULL AND result_v1 IS NOT NULL)
  );
