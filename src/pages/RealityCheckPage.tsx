import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, Pencil, Sparkles, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/posthog";
import { deslugifyRole } from "@/lib/role";
import {
  BUDGETS,
  COMMUTE_FLEX,
  ENGLISH_COMFORT,
  ENGLISH_MATHS,
  INCOME_NEEDS,
  QUALIFICATION_LEVELS,
  SCIENCE_SUBJECTS,
  STARTING_POINTS,
  WEEKLY_HOURS,
  type RealityCheckAnswers,
  type RealityCheckResult,
  type RoleContext,
} from "@/lib/reality-check/types";
import {
  answersToProfile,
  hasAnyProfileField,
  profileToAnswers,
  type DecisionProfileFields,
} from "@/lib/reality-check/profile-mapping";
import {
  BACKGROUND_REQUIRED_FOR,
  ChipGroup,
  Field,
  REGIONS,
  ResultView,
  answerChips,
  emptyAnswers,
  isStemOrHealthcareRole,
  loadSessionResult,
  saveSessionResult,
  clearSessionResult,
} from "@/components/role/reality-check-shared";
import { isSupportedRegion } from "@/lib/reality-check/regions";

type Role = RoleContext & {
  id: string;
  role_slug: string;
  role_name: string;
  reality_rating?: string | null;
};

// ── Progressive disclosure helpers ────────────────────────────────────────────

const isFilled = (v: unknown) =>
  typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined;

const STEPS = ["Starting point", "Qualifications", "Practical constraints", "Result"] as const;

const StepIndicator = ({ current }: { current: 0 | 1 | 2 | 3 }) => (
  <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 mb-4">
    {STEPS.map((label, i) => {
      const active = i === current;
      const done = i < current;
      return (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold ${
              done
                ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/40"
                : active
                ? "bg-amber-300 text-gray-900"
                : "bg-gray-700 text-gray-400 border border-gray-600"
            }`}
          >
            {i + 1}
          </span>
          <span className={active ? "text-amber-200 font-medium" : done ? "text-gray-300" : ""}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="text-gray-700">›</span>}
        </li>
      );
    })}
  </ol>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const RealityCheckPage = () => {
  const { slug = "" } = useParams();
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [answers, setAnswers] = useState<RealityCheckAnswers>(emptyAnswers);
  const [result, setResult] = useState<RealityCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialProfile, setInitialProfile] = useState<DecisionProfileFields | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Load role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("roles")
        .select("id, role_slug, role_name, short_description, reality_check, uncomfortable_truth, opportunity_cost, who_not_for, career_regret_risk, competition_level, demand, ai_impact_level, salary_entry, salary_experienced, salary_senior, pathway_school_leaver, pathway_graduate, pathway_adjacent, pathway_no_background, typical_backgrounds, key_employers")
        .eq("role_slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRole(data as Role);
      // Restore in-session result if present (so refresh keeps your judgement)
      const cached = loadSessionResult(slug);
      if (cached) {
        setAnswers(cached.answers);
        setResult(cached.result);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Prefill from Decision Profile (only if we don't already have answers in session)
  useEffect(() => {
    if (!user || !role) {
      return;
    }
    if (result) return; // already restored from session
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("decision_profiles")
        .select("area, starting_point, need_to_earn, weekly_hours, budget_band, commute_flexibility")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && hasAnyProfileField(data as DecisionProfileFields)) {
        const p = data as DecisionProfileFields;
        const normalisedAnswers = profileToAnswers(p, emptyAnswers);
        setInitialProfile(answersToProfile(normalisedAnswers));
        setAnswers((a) => profileToAnswers(p, a));
        setPrefilled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, role?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to result when it lands
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  // ── Validation & progressive disclosure ─────────────────────────────────────

  const sciencyRole = role ? isStemOrHealthcareRole(role.role_name) : false;

  const backgroundRequired =
    !!answers.startingPoint && BACKGROUND_REQUIRED_FOR.includes(answers.startingPoint);
  const backgroundMissing = backgroundRequired && answers.relevantBackground.trim().length < 3;

  // Section gating
  const section1Complete =
    !!answers.startingPoint && (!backgroundRequired || answers.relevantBackground.trim().length >= 3);
  const section2Complete =
    !!answers.qualificationLevel && !!answers.englishMaths && !!answers.scienceSubjects;
  const section3Complete = !!answers.englishComfort;
  const section4Complete =
    !!answers.incomeNeed && !!answers.budget && !!answers.region;

  const showSection2 = !!answers.startingPoint;
  const showSection3 = showSection2 && section2Complete;
  const showSection4 = showSection3 && section3Complete;
  const showSection5 = showSection4 && section4Complete;

  const currentStep: 0 | 1 | 2 | 3 = result
    ? 3
    : !showSection2
    ? 0
    : !showSection4
    ? 1
    : !showSection5
    ? 2
    : 2;

  const missing: string[] = [];
  if (!answers.startingPoint) missing.push("starting point");
  if (backgroundMissing) missing.push("relevant background");
  if (!answers.qualificationLevel) missing.push("highest qualification");
  if (!answers.englishMaths) missing.push("English/maths");
  if (!answers.scienceSubjects) missing.push(sciencyRole ? "science subjects" : "role-related subjects");
  if (!answers.englishComfort) missing.push("English/study readiness");
  if (!answers.incomeNeed) missing.push("earning need");
  if (!answers.budget) missing.push("budget");
  if (!answers.region) missing.push("region");
  const canSubmit = missing.length === 0;

  // ── Submit ───────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!role || !canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    trackEvent("reality_check_submitted", {
      role: role.role_name,
      starting_point: answers.startingPoint,
      income_need: answers.incomeNeed,
      weekly_hours: answers.weeklyHours,
      budget: answers.budget,
      commute_flex: answers.commuteFlex,
    });
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("reality-check", {
        body: { role, answers },
      });
      if (fnErr) throw fnErr;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const r = (data as { result: RealityCheckResult }).result;
      setResult(r);
      saveSessionResult(role.role_slug, {
        answers,
        result: r,
        savedAt: new Date().toISOString(),
      });
      trackEvent("reality_check_result", { role: role.role_name, verdict: r?.overallVerdict });
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const editAnswers = () => {
    setResult(null);
    setError(null);
    if (role) clearSessionResult(role.role_slug);
  };

  const chips = useMemo(() => answerChips(answers), [answers]);

  // ── Render: loading / not found ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (notFound || !role) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-20 max-w-2xl">
          <h1 className="font-display text-3xl font-medium text-foreground">
            We don't have "{deslugifyRole(slug)}" yet.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Try searching for another role to reality-check.
          </p>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link to="/">Search again</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Render: page ────────────────────────────────────────────────────────────

  const scienceLabel = sciencyRole
    ? "Do you have science or role-related subjects?"
    : "Do you have role-related subjects?";
  const scienceHelper = sciencyRole
    ? "For some routes, subjects like science, health, maths, or technology can affect your options."
    : "Subjects you've studied that relate to this role can affect your options.";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Reality-check {role.role_name} | Clear Routes</title>
        <meta
          name="description"
          content={`Reality-check your route into ${role.role_name}. We'll use your background, qualifications, budget, time, and area to judge the most realistic route.`}
        />
      </Helmet>

      <Navbar />

      <main className="max-w-2xl w-full mx-auto px-4 py-6 font-sans">
        <Link
          to={`/role/${role.role_slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {role.role_name}
        </Link>

        <h1 className="text-2xl font-medium text-gray-900 mb-1">
          Reality-check your route into {role.role_name}
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          We'll use your background, qualifications, budget, time, and area to judge the most realistic route.
        </p>

        <section
          aria-label="Reality-check this route"
          className="relative rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-5 text-white shadow-sm"
        >
          <StepIndicator current={currentStep} />

          {!result && prefilled && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5">
              <p className="text-[11px] text-amber-100">Using your saved Decision Profile.</p>
              <Link
                to="/my-decisions#decision-profile"
                className="text-[11px] text-amber-200 underline underline-offset-2 hover:text-white inline-flex items-center gap-1"
              >
                <UserCog className="h-3 w-3" /> Edit
              </Link>
            </div>
          )}

          {result && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
              <p className="text-[11px] text-gray-300 leading-snug">
                <span className="font-semibold uppercase tracking-wider text-gray-500 mr-1.5">Checked for:</span>
                {chips.join(" · ")}
              </p>
              <button
                type="button"
                onClick={editAnswers}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 hover:text-white underline underline-offset-2"
              >
                <Pencil className="h-3 w-3" /> Edit answers
              </button>
            </div>
          )}

          {!result && (
            <div className="space-y-5">
              {/* Section 1 — Starting point */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  1. Your starting point
                </legend>
                <Field label="Starting point">
                  <ChipGroup
                    options={STARTING_POINTS}
                    value={answers.startingPoint}
                    onChange={(v) => setAnswers((a) => ({ ...a, startingPoint: v }))}
                    disabled={submitting}
                  />
                </Field>

                {showSection2 && (
                  <Field
                    label={`Relevant background${backgroundRequired ? "" : " (optional)"}`}
                    helper={
                      backgroundRequired
                        ? "What have you studied or worked in? This helps us judge whether you'll meet entry requirements."
                        : "If anything you've done so far feels relevant, tell us briefly. Otherwise skip."
                    }
                    error={backgroundMissing ? "Add a little more detail about what you studied or worked in." : null}
                  >
                    <input
                      type="text"
                      value={answers.relevantBackground}
                      onChange={(e) => setAnswers((a) => ({ ...a, relevantBackground: e.target.value }))}
                      placeholder="e.g. psychology degree, retail manager, healthcare assistant, biology A-level"
                      disabled={submitting}
                      className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
                    />
                  </Field>
                )}
              </fieldset>

              {/* Section 2 — Qualifications */}
              {showSection2 && (
                <fieldset className="space-y-3 border-t border-gray-700/50 pt-4">
                  <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    2. Qualifications
                  </legend>
                  <Field label="Highest qualification level">
                    <ChipGroup
                      options={QUALIFICATION_LEVELS}
                      value={answers.qualificationLevel}
                      onChange={(v) => setAnswers((a) => ({ ...a, qualificationLevel: v }))}
                      disabled={submitting}
                    />
                  </Field>

                  <Field
                    label="Do you have GCSE English and maths, or equivalent?"
                    helper="Many routes ask for English and maths or an equivalent qualification."
                  >
                    <ChipGroup
                      options={ENGLISH_MATHS}
                      value={answers.englishMaths}
                      onChange={(v) => setAnswers((a) => ({ ...a, englishMaths: v }))}
                      disabled={submitting}
                    />
                  </Field>

                  <Field label={scienceLabel} helper={scienceHelper}>
                    <ChipGroup
                      options={SCIENCE_SUBJECTS}
                      value={answers.scienceSubjects}
                      onChange={(v) => setAnswers((a) => ({ ...a, scienceSubjects: v }))}
                      disabled={submitting}
                    />
                  </Field>
                </fieldset>
              )}

              {/* Section 3 — English / study readiness */}
              {showSection3 && (
                <fieldset className="space-y-3 border-t border-gray-700/50 pt-4">
                  <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    3. Study and English
                  </legend>
                  <Field
                    label="Are you comfortable studying and working in English?"
                    helper="Some routes involve written assignments, interviews, placements, or professional communication. We'll never use this to gatekeep — just to suggest realistic support."
                  >
                    <ChipGroup
                      options={ENGLISH_COMFORT}
                      value={answers.englishComfort}
                      onChange={(v) => setAnswers((a) => ({ ...a, englishComfort: v }))}
                      disabled={submitting}
                    />
                  </Field>
                </fieldset>
              )}

              {/* Section 4 — Practical constraints */}
              {showSection4 && (
                <fieldset className="space-y-3 border-t border-gray-700/50 pt-4">
                  <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    4. Practical constraints
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Need to earn while training?">
                      <ChipGroup
                        options={INCOME_NEEDS}
                        value={answers.incomeNeed}
                        onChange={(v) => setAnswers((a) => ({ ...a, incomeNeed: v }))}
                        disabled={submitting}
                      />
                    </Field>
                    <Field label="Budget">
                      <ChipGroup
                        options={BUDGETS}
                        value={answers.budget}
                        onChange={(v) => setAnswers((a) => ({ ...a, budget: v }))}
                        disabled={submitting}
                      />
                    </Field>
                    <Field label="Where you live (UK)" helper="We use this to set realistic expectations for local opportunity coverage.">
                      <ChipGroup
                        options={REGIONS}
                        value={answers.region}
                        onChange={(v) => setAnswers((a) => ({ ...a, region: v }))}
                        disabled={submitting}
                      />
                      {answers.region && !isSupportedRegion(answers.region) && (
                        <p className="mt-1.5 text-[10px] text-amber-200/90 leading-snug">
                          Verified local opportunity coverage isn't available in your area yet — your route judgement will still work.
                        </p>
                      )}
                    </Field>
                    <Field label="Town or postcode (optional)" helper="Add more detail if you'd like — it's not required.">
                      <input
                        type="text"
                        value={answers.area}
                        onChange={(e) => setAnswers((a) => ({ ...a, area: e.target.value }))}
                        placeholder="e.g. Leeds, SE15"
                        disabled={submitting}
                        className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
                      />
                    </Field>
                    <Field label="Weekly time available">
                      <ChipGroup
                        options={WEEKLY_HOURS}
                        value={answers.weeklyHours}
                        onChange={(v) => setAnswers((a) => ({ ...a, weeklyHours: v }))}
                        disabled={submitting}
                      />
                    </Field>
                    <Field label="Commute / relocation">
                      <ChipGroup
                        options={COMMUTE_FLEX}
                        value={answers.commuteFlex}
                        onChange={(v) => setAnswers((a) => ({ ...a, commuteFlex: v }))}
                        disabled={submitting}
                      />
                    </Field>
                  </div>
                </fieldset>
              )}

              {/* Section 5 — Optional context */}
              {showSection5 && (
                <fieldset className="space-y-3 border-t border-gray-700/50 pt-4">
                  <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    5. Anything else? <span className="text-gray-600 font-normal normal-case">— optional</span>
                  </legend>
                  <Field label="Anything else we should factor in?">
                    <textarea
                      value={answers.notes}
                      onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value }))}
                      placeholder="e.g. caring responsibilities, health, previous applications, transport limits, confidence, childcare"
                      disabled={submitting}
                      rows={3}
                      className="w-full rounded-lg bg-gray-700/40 border border-gray-600/60 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-300/40 resize-none"
                    />
                  </Field>
                </fieldset>
              )}

              {/* Submit */}
              <div className="border-t border-gray-700/50 pt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit || submitting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 transition-colors"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {submitting ? "Finding your route…" : "Show my realistic route"}
                </button>
                {!canSubmit && (
                  <p className="text-[11px] text-gray-500">
                    Still needed: {missing.join(", ")}.
                  </p>
                )}
              </div>

              {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
            </div>
          )}

          {result && (
            <div ref={resultRef}>
              <ResultView
                result={result}
                answers={answers}
                role={role}
                onEdit={editAnswers}
                initialProfile={initialProfile}
                onProfileSaved={(p) => setInitialProfile(p)}
              />
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default RealityCheckPage;
