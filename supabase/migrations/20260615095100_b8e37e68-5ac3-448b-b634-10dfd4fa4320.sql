
-- decision_profiles
CREATE TABLE public.decision_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  area text,
  starting_point text,
  highest_qualification text,
  need_to_earn text,
  weekly_hours text,
  budget_band text,
  commute_flexibility text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_profiles TO authenticated;
GRANT ALL ON public.decision_profiles TO service_role;

ALTER TABLE public.decision_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own decision_profile" ON public.decision_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own decision_profile" ON public.decision_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own decision_profile" ON public.decision_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own decision_profile" ON public.decision_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_decision_profiles_updated_at
  BEFORE UPDATE ON public.decision_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- saved_decisions
CREATE TABLE public.saved_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  role_slug text NOT NULL,
  role_name text NOT NULL,
  overall_verdict text,
  best_route_title text,
  backup_route_title text,
  route_to_avoid_title text,
  local_realism_rating text,
  first_move text,
  input_snapshot jsonb,
  result_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_decisions_user_created_idx
  ON public.saved_decisions (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_decisions TO authenticated;
GRANT ALL ON public.saved_decisions TO service_role;

ALTER TABLE public.saved_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved_decisions" ON public.saved_decisions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own saved_decisions" ON public.saved_decisions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own saved_decisions" ON public.saved_decisions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own saved_decisions" ON public.saved_decisions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_decisions_updated_at
  BEFORE UPDATE ON public.saved_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
