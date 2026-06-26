-- Grant service_role access (edge functions need it; anon/authenticated remain locked)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reality_check_rate TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reality_check_explanation_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reality_check_feedback TO service_role;

-- Add cache expiry column + index for scheduled cleanup
ALTER TABLE public.reality_check_explanation_cache
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS reality_check_cache_expires_at_idx
  ON public.reality_check_explanation_cache (expires_at);