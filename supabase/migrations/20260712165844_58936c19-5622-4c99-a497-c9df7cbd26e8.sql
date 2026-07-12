
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

  -- Fully idempotent no-op.
  IF v_current_status = 'published' AND v_prior_pack_id IS NOT DISTINCT FROM _pack_id THEN
    RETURN jsonb_build_object('changed', false, 'pack_id', _pack_id, 'role_id', v_role_id);
  END IF;

  -- STEP A: supersede any prior different pack FIRST so the one-active-pack
  -- invariant isn't violated when we promote the new one.
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

  -- STEP B: promote the new pack to published.
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

  -- STEP C: upsert binding to point at the new pack.
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
