
-- ============================================================================
-- PR 3a: Trusted-save release gate — assessment receipts + tightened RLS.
-- ============================================================================

-- 1. Configurable receipt TTL.
ALTER TABLE public.career_pack_config
  ADD COLUMN IF NOT EXISTS receipt_ttl_minutes int NOT NULL DEFAULT 30;

-- 2. Optional label on saved_decisions.
ALTER TABLE public.saved_decisions
  ADD COLUMN IF NOT EXISTS label text;

-- 3. Assessment receipts table.
CREATE TABLE IF NOT EXISTS public.assessment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash text NOT NULL UNIQUE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  role_slug text NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.career_packs(id) ON DELETE CASCADE,
  pack_version text NOT NULL,
  pack_content_hash text NOT NULL,
  evaluator_schema_version text NOT NULL,
  evaluation_source text NOT NULL DEFAULT 'generic_pack_v1',
  result_v1 jsonb NOT NULL,
  result_canonical_hash text NOT NULL,
  issued_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  saved_decision_id uuid REFERENCES public.saved_decisions(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT assessment_receipts_source_chk
    CHECK (evaluation_source = 'generic_pack_v1'),
  CONSTRAINT assessment_receipts_claim_chk CHECK (
    (claimed_user_id IS NULL AND claimed_at IS NULL AND saved_decision_id IS NULL)
    OR (claimed_user_id IS NOT NULL AND claimed_at IS NOT NULL AND saved_decision_id IS NOT NULL)
  ),
  CONSTRAINT assessment_receipts_issued_matches_claim_chk CHECK (
    issued_user_id IS NULL
    OR claimed_user_id IS NULL
    OR issued_user_id = claimed_user_id
  )
);

CREATE INDEX IF NOT EXISTS assessment_receipts_expires_idx
  ON public.assessment_receipts (expires_at);
CREATE INDEX IF NOT EXISTS assessment_receipts_claimed_user_idx
  ON public.assessment_receipts (claimed_user_id) WHERE claimed_user_id IS NOT NULL;

-- Service-role only. NO grants to anon or authenticated by design.
GRANT ALL ON public.assessment_receipts TO service_role;

ALTER TABLE public.assessment_receipts ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies for anon/authenticated: table is server-only.

-- 4. Tighten saved_decisions policies:
--    Users may only directly manipulate legacy_engine rows. generic_pack_v1
--    rows are created exclusively by the server via the claim RPC below,
--    which runs SECURITY DEFINER and bypasses RLS.
DROP POLICY IF EXISTS "Users insert own saved_decisions" ON public.saved_decisions;
DROP POLICY IF EXISTS "Users update own saved_decisions" ON public.saved_decisions;

CREATE POLICY "Users insert own legacy saved_decisions" ON public.saved_decisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND evaluation_source = 'legacy_engine');

CREATE POLICY "Users update own legacy saved_decisions" ON public.saved_decisions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND evaluation_source = 'legacy_engine')
  WITH CHECK (auth.uid() = user_id AND evaluation_source = 'legacy_engine');

-- 5. Atomic claim + save RPC.
CREATE OR REPLACE FUNCTION public.claim_receipt_and_save_decision(
  _receipt_hash text,
  _user_id uuid,
  _label text DEFAULT NULL
) RETURNS TABLE (saved_decision_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_receipts%ROWTYPE;
  v_saved_id uuid;
  v_role_slug text;
  v_role_name text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'user_id_required'::text; RETURN;
  END IF;
  IF _receipt_hash IS NULL OR length(_receipt_hash) = 0 THEN
    RETURN QUERY SELECT NULL::uuid, 'unknown_receipt'::text; RETURN;
  END IF;

  SELECT * INTO r FROM public.assessment_receipts
    WHERE receipt_hash = _receipt_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'unknown_receipt'::text; RETURN;
  END IF;

  IF r.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'revoked_receipt'::text; RETURN;
  END IF;

  -- Already claimed?
  IF r.saved_decision_id IS NOT NULL THEN
    IF r.claimed_user_id = _user_id THEN
      RETURN QUERY SELECT r.saved_decision_id, 'already_claimed'::text; RETURN;
    ELSE
      RETURN QUERY SELECT NULL::uuid, 'claimed_by_other'::text; RETURN;
    END IF;
  END IF;

  IF r.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, 'expired_receipt'::text; RETURN;
  END IF;

  IF r.issued_user_id IS NOT NULL AND r.issued_user_id <> _user_id THEN
    RETURN QUERY SELECT NULL::uuid, 'issued_to_other_user'::text; RETURN;
  END IF;

  SELECT role_slug, role_name INTO v_role_slug, v_role_name
    FROM public.roles WHERE id = r.role_id;
  IF v_role_slug IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'role_not_found'::text; RETURN;
  END IF;

  INSERT INTO public.saved_decisions (
    user_id, role_id, role_slug, role_name,
    evaluation_source, pack_id, pack_version, pack_content_hash,
    evaluator_schema_version, result_v1, label
  ) VALUES (
    _user_id, r.role_id, v_role_slug, v_role_name,
    'generic_pack_v1', r.pack_id, r.pack_version, r.pack_content_hash,
    r.evaluator_schema_version, r.result_v1, NULLIF(_label, '')
  ) RETURNING id INTO v_saved_id;

  UPDATE public.assessment_receipts
    SET claimed_user_id = _user_id,
        claimed_at = now(),
        saved_decision_id = v_saved_id
    WHERE receipt_hash = _receipt_hash;

  RETURN QUERY SELECT v_saved_id, 'created'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_receipt_and_save_decision(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_receipt_and_save_decision(text, uuid, text) TO service_role;

-- 6. Cleanup function.
CREATE OR REPLACE FUNCTION public.cleanup_expired_assessment_receipts(_retain_claimed_days int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.assessment_receipts
    WHERE (saved_decision_id IS NULL AND expires_at < now())
       OR (saved_decision_id IS NOT NULL AND claimed_at < now() - make_interval(days => _retain_claimed_days))
       OR (revoked_at IS NOT NULL AND revoked_at < now() - make_interval(days => _retain_claimed_days));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_assessment_receipts(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_assessment_receipts(int) TO service_role;
