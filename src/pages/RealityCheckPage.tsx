import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, Loader2, Pencil, Sparkles, UserCog } from "lucide-react";
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
  loadInProgressAnswers,
  saveInProgressAnswers,
  clearInProgressAnswers,
  sanitiseAnswersForVisibility,
  clampStepId,
  UNRESOLVED_STARTING_POINT_NOTICE,
  UNRESOLVED_STARTING_POINT_OTHER_NOTICE,
  type StartingPointStatus,
} from "@/components/role/reality-check-shared";
import { isSupportedRegion } from "@/lib/reality-check/regions";
import { isRealityCheckEnabled as isRealityCheckReady } from "@/lib/reality-check/service-levels";

type Role = RoleContext & {
  id: string;
  role_slug: string;
  role_name: string;
  reality_rating?: string | null;
  service_level?: import("@/lib/reality-check/service-levels").RoleServiceLevel | null;
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

  // Wizard state is persisted across refresh (per-tab, sessionStorage) so
  // partially-completed answers survive an accidental reload.
  // `startingPointStatus === "unresolved_*"` means the user picked "Not sure"
  // or "Something else" for Q1: the engine gets no signal from that field,
  // but the questionnaire can still submit — see the review-screen notice
  // and the result-page banner below.
  // We track position by stepId (stable) rather than a numeric index so
  // future changes to question order don't restore users onto a different
  // question.
  const [stepId, setStepId] = useState<string | null>(null);
  const [startingPointStatus, setStartingPointStatus] = useState<StartingPointStatus | null>(null);
  const [startingPointOtherText, setStartingPointOtherText] = useState("");
  const [hydratedProgress, setHydratedProgress] = useState(false);

  // Load role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("roles")
        .select("id, role_slug, role_name, service_level, short_description, reality_check, uncomfortable_truth, opportunity_cost, who_not_for, career_regret_risk, competition_level, demand, ai_impact_level, salary_entry, salary_experienced, salary_senior, pathway_school_leaver, pathway_graduate, pathway_adjacent, pathway_no_background, typical_backgrounds, key_employers")
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
        setHydratedProgress(true);
      } else {
        // Otherwise restore in-progress answers so a mid-wizard refresh
        // doesn't wipe what the user has already typed.
        const progress = loadInProgressAnswers(slug);
        if (progress) {
          setAnswers(progress.answers);
          setStepId(progress.stepId);
          setStartingPointStatus(progress.startingPointStatus);
          setStartingPointOtherText(progress.startingPointOtherText);
        }
        setHydratedProgress(true);
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

  // Dependency cleanup — when a conditional question is no longer visible
  // (e.g. background question hidden after user re-selects starting point),
  // its answer must not linger in state, persistence, or the submission
  // payload. Runs on every render but only writes when a change is needed.
  useEffect(() => {
    if (!backgroundRequired && answers.relevantBackground) {
      setAnswers((a) => sanitiseAnswersForVisibility(a, { backgroundRequired: false }));
    }
  }, [backgroundRequired, answers.relevantBackground]);

  // Persist in-progress answers so a refresh mid-wizard doesn't wipe them.
  // Only writes after hydration to avoid clobbering restored state. Uses
  // stepId (not a numeric index) so the persisted position stays meaningful
  // when the question order changes.
  useEffect(() => {
    if (!slug || !hydratedProgress || result) return;
    if (!stepId) return;
    saveInProgressAnswers(slug, {
      answers,
      stepId,
      startingPointStatus,
      startingPointOtherText,
    });
  }, [slug, hydratedProgress, result, answers, stepId, startingPointStatus, startingPointOtherText]);

  // Validity is now enforced step-by-step in the WizardForm; the aggregate
  // `canSubmit` gate below still guards the network submit for defence in depth.
  // Q1 is considered answered if either a canonical starting point is chosen
  // OR the user selected "Not sure" / "Something else" (answered_unresolved).
  const startingPointAnswered =
    !!answers.startingPoint ||
    startingPointStatus === "unresolved_not_sure" ||
    startingPointStatus === "unresolved_other";
  const startingPointUnresolved =
    startingPointStatus === "unresolved_not_sure" ||
    startingPointStatus === "unresolved_other";
  const missing: string[] = [];
  if (!startingPointAnswered) missing.push("starting point");
  if (backgroundMissing) missing.push("relevant background");
  if (!answers.qualificationLevel) missing.push("highest qualification");
  if (!answers.englishMaths) missing.push("English/maths");
  if (!answers.scienceSubjects) missing.push(sciencyRole ? "science subjects" : "role-related subjects");
  if (!answers.englishComfort) missing.push("English/study readiness");
  if (!answers.incomeNeed) missing.push("earning need");
  if (!answers.budget) missing.push("budget");
  if (!answers.region) missing.push("region");
  const canSubmit = missing.length === 0;

  const currentStep: 0 | 1 | 2 | 3 = result
    ? 3
    : !answers.qualificationLevel
    ? 0
    : !answers.incomeNeed
    ? 1
    : 2;

  // ── Submit ───────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!role || !canSubmit || submitting) return;
    // Sanitise for visibility one more time before sending, so any hidden
    // conditional answer that hasn't been cleared by the state effect yet
    // can't leak into the submission payload or the saved result.
    const submissionAnswers = sanitiseAnswersForVisibility(answers, { backgroundRequired });
    setSubmitting(true);
    setError(null);
    setResult(null);
    // NOTE: we deliberately do NOT include `startingPointOtherText` in
    // analytics — the raw free text stays on the client until we have an
    // AI interpretation layer to make it safe to send.
    trackEvent("reality_check_submitted", {
      role: role.role_name,
      starting_point: submissionAnswers.startingPoint,
      starting_point_status: submissionAnswers.startingPoint ? "resolved" : startingPointStatus,
      income_need: submissionAnswers.incomeNeed,
      weekly_hours: submissionAnswers.weeklyHours,
      budget: submissionAnswers.budget,
      commute_flex: submissionAnswers.commuteFlex,
    });
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("reality-check", {
        body: { role, answers: submissionAnswers },
      });
      if (fnErr) throw fnErr;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const r = (data as { result: RealityCheckResult }).result;
      setResult(r);
      saveSessionResult(role.role_slug, {
        answers: submissionAnswers,
        result: r,
        savedAt: new Date().toISOString(),
      });
      clearInProgressAnswers(role.role_slug);
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

  // Gate by service_level — info_only roles do not yet have a reviewed
  // Reality-check. Show an honest fallback rather than running the engine.
  if (!isRealityCheckReady(role.service_level)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Helmet>
          <title>Reality-check not yet available — {role.role_name} | Clear Routes</title>
        </Helmet>
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
          <Link
            to={`/role/${role.role_slug}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {role.role_name}
          </Link>
          <h1 className="font-display text-2xl font-medium text-foreground mb-3">
            Reality-check isn't reviewed for {role.role_name} yet
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            We've intentionally limited the adaptive Reality-check to a small
            set of pilot roles where we've reviewed entry requirements, pathway
            logic and the route judgement against current evidence.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Browse the role page for general information, or try a pilot role
            (e.g. Registered Nurse, Software Engineer, Electrician, Data
            Analyst, Primary School Teacher).
          </p>
          <Button asChild variant="outline">
            <Link to={`/role/${role.role_slug}`}>Back to role page</Link>
          </Button>
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
            <WizardForm
              answers={answers}
              setAnswers={setAnswers}
              submitting={submitting}
              submit={submit}
              canSubmit={canSubmit}
              error={error}
              backgroundRequired={backgroundRequired}
              backgroundMissing={backgroundMissing}
              scienceLabel={scienceLabel}
              scienceHelper={scienceHelper}
              stepId={stepId}
              setStepId={setStepId}
              startingPointUnresolved={startingPointUnresolved}
              startingPointStatus={startingPointStatus}
              setStartingPointStatus={setStartingPointStatus}
              startingPointOtherText={startingPointOtherText}
              setStartingPointOtherText={setStartingPointOtherText}
            />
          )}


          {result && (
            <div ref={resultRef}>
              {startingPointUnresolved && (
                <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2">
                  <p className="text-[11px] text-amber-100 leading-snug">
                    {UNRESOLVED_STARTING_POINT_NOTICE}
                  </p>
                </div>
              )}
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

// ── Wizard form ───────────────────────────────────────────────────────────────
// One-question-per-screen form with visible progress and Back/Next controls.
// Validation runs per-step; the aggregate `canSubmit` gate in the parent still
// guards the network submit for defence in depth.

type WizardProps = {
  answers: RealityCheckAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<RealityCheckAnswers>>;
  submitting: boolean;
  submit: () => void;
  canSubmit: boolean;
  error: string | null;
  backgroundRequired: boolean;
  backgroundMissing: boolean;
  scienceLabel: string;
  scienceHelper: string;
  stepId: string | null;
  setStepId: React.Dispatch<React.SetStateAction<string | null>>;
  startingPointUnresolved: boolean;
  startingPointStatus: StartingPointStatus | null;
  setStartingPointStatus: React.Dispatch<React.SetStateAction<StartingPointStatus | null>>;
  startingPointOtherText: string;
  setStartingPointOtherText: React.Dispatch<React.SetStateAction<string>>;
};

type WizardStep = {
  id: string;
  phase: 0 | 1 | 2;
  render: () => React.ReactNode;
  isValid: () => boolean;
  optional?: boolean;
  isReview?: boolean;
};

const WizardForm = ({
  answers,
  setAnswers,
  submitting,
  submit,
  canSubmit,
  error,
  backgroundRequired,
  backgroundMissing,
  scienceLabel,
  scienceHelper,
  stepId,
  setStepId,
  startingPointUnresolved,
  startingPointStatus,
  setStartingPointStatus,
  startingPointOtherText,
  setStartingPointOtherText,
}: WizardProps) => {
  const set = <K extends keyof RealityCheckAnswers>(key: K, value: RealityCheckAnswers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const pickStartingPoint = (v: RealityCheckAnswers["startingPoint"]) => {
    set("startingPoint", v);
    setStartingPointStatus("resolved");
    setStartingPointOtherText("");
  };

  const pickStartingPointUnresolved = (variant: "not_sure" | "other") => {
    set("startingPoint", null);
    setStartingPointStatus(
      variant === "not_sure" ? "unresolved_not_sure" : "unresolved_other",
    );
    if (variant === "not_sure") setStartingPointOtherText("");
  };

  const notSureActive = startingPointStatus === "unresolved_not_sure";
  const otherActive = startingPointStatus === "unresolved_other";
  const startingPointAnswered = !!answers.startingPoint || startingPointUnresolved;

  const rawSteps: (WizardStep | null)[] = [
    {
      id: "starting_point",
      phase: 0,
      isValid: () => startingPointAnswered,
      render: () => (
        <Field
          label="Where are you starting from?"
          helper="Pick the option that best describes you right now."
        >
          <ChipGroup
            options={STARTING_POINTS}
            value={answers.startingPoint}
            onChange={pickStartingPoint}
            disabled={submitting}
          />
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-700/60">
            <button
              type="button"
              disabled={submitting}
              onClick={() => pickStartingPointUnresolved("not_sure")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                notSureActive
                  ? "border-amber-300 bg-amber-300 text-gray-900"
                  : "border-gray-600 bg-gray-700/50 text-gray-200 hover:bg-gray-700"
              } disabled:opacity-50`}
            >
              Not sure
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => pickStartingPointUnresolved("other")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                otherActive
                  ? "border-amber-300 bg-amber-300 text-gray-900"
                  : "border-gray-600 bg-gray-700/50 text-gray-200 hover:bg-gray-700"
              } disabled:opacity-50`}
            >
              Something else
            </button>
          </div>
          {otherActive && (
            <div className="mt-2">
              <label className="block text-[10px] text-gray-400 mb-1">
                Tell us briefly what your current situation is (optional)
              </label>
              <input
                type="text"
                value={startingPointOtherText}
                onChange={(e) => setStartingPointOtherText(e.target.value)}
                placeholder="e.g. between roles after a career break"
                disabled={submitting}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
              />
              <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                We'll skip inferring a starting point from this — your route judgement will be a little less specific.
              </p>
            </div>
          )}
          {notSureActive && (
            <p className="mt-2 text-[10px] text-gray-500 leading-snug">
              We'll skip inferring a starting point — your route judgement will be a little less specific.
            </p>
          )}
        </Field>
      ),
    },
    backgroundRequired
      ? {
          id: "background",
          phase: 0,
          isValid: () => !backgroundMissing,
          render: () => (
            <Field
              label="What have you studied or worked in?"
              helper="A brief note helps us judge whether you'll meet entry requirements."
              error={backgroundMissing ? "Add a little more detail." : null}
            >
              <input
                type="text"
                value={answers.relevantBackground}
                onChange={(e) => set("relevantBackground", e.target.value)}
                placeholder="e.g. psychology degree, retail manager, biology A-level"
                disabled={submitting}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
              />
            </Field>
          ),
        }
      : null,
    {
      id: "qualification",
      phase: 1,
      isValid: () => !!answers.qualificationLevel,
      render: () => (
        <Field label="What's your highest qualification?">
          <ChipGroup
            options={QUALIFICATION_LEVELS}
            value={answers.qualificationLevel}
            onChange={(v) => set("qualificationLevel", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "english_maths",
      phase: 1,
      isValid: () => !!answers.englishMaths,
      render: () => (
        <Field
          label="Do you have GCSE English and maths, or equivalent?"
          helper="Many routes ask for English and maths or an equivalent qualification."
        >
          <ChipGroup
            options={ENGLISH_MATHS}
            value={answers.englishMaths}
            onChange={(v) => set("englishMaths", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "science",
      phase: 1,
      isValid: () => !!answers.scienceSubjects,
      render: () => (
        <Field label={scienceLabel} helper={scienceHelper}>
          <ChipGroup
            options={SCIENCE_SUBJECTS}
            value={answers.scienceSubjects}
            onChange={(v) => set("scienceSubjects", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "english_comfort",
      phase: 2,
      isValid: () => !!answers.englishComfort,
      render: () => (
        <Field
          label="Are you comfortable studying and working in English?"
          helper="We only use this to suggest realistic support — never to gatekeep."
        >
          <ChipGroup
            options={ENGLISH_COMFORT}
            value={answers.englishComfort}
            onChange={(v) => set("englishComfort", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "income",
      phase: 2,
      isValid: () => !!answers.incomeNeed,
      render: () => (
        <Field
          label="Do you need to earn while training?"
          helper="This changes which routes are realistic — for example, apprenticeships pay, university generally doesn't."
        >
          <ChipGroup
            options={INCOME_NEEDS}
            value={answers.incomeNeed}
            onChange={(v) => set("incomeNeed", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "budget",
      phase: 2,
      isValid: () => !!answers.budget,
      render: () => (
        <Field
          label="How much can you spend on training?"
          helper="Roughly — we use this to filter routes you can actually afford."
        >
          <ChipGroup
            options={BUDGETS}
            value={answers.budget}
            onChange={(v) => set("budget", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "region",
      phase: 2,
      isValid: () => !!answers.region,
      render: () => (
        <div className="space-y-3">
          <Field
            label="Where in the UK do you live?"
            helper="We use this to set realistic expectations for local opportunity coverage."
          >
            <ChipGroup
              options={REGIONS}
              value={answers.region}
              onChange={(v) => set("region", v)}
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
              onChange={(e) => set("area", e.target.value)}
              placeholder="e.g. Leeds, SE15"
              disabled={submitting}
              className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
            />
          </Field>
        </div>
      ),
    },
    {
      id: "weekly_hours",
      phase: 2,
      isValid: () => !!answers.weeklyHours,
      optional: true,
      render: () => (
        <Field
          label="How much time can you give this each week?"
          helper="A rough estimate is fine. Skip if you're not sure."
        >
          <ChipGroup
            options={WEEKLY_HOURS}
            value={answers.weeklyHours}
            onChange={(v) => set("weeklyHours", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "commute",
      phase: 2,
      isValid: () => !!answers.commuteFlex,
      optional: true,
      render: () => (
        <Field
          label="How far are you willing to travel or relocate?"
          helper="Some routes cluster in particular places — this helps us judge fit."
        >
          <ChipGroup
            options={COMMUTE_FLEX}
            value={answers.commuteFlex}
            onChange={(v) => set("commuteFlex", v)}
            disabled={submitting}
          />
        </Field>
      ),
    },
    {
      id: "notes",
      phase: 2,
      isValid: () => true,
      optional: true,
      render: () => (
        <Field
          label="Anything else we should factor in? (optional)"
          helper="e.g. caring responsibilities, health, transport, previous applications, childcare."
        >
          <textarea
            value={answers.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Tell us anything that could affect what's realistic for you."
            disabled={submitting}
            rows={3}
            className="w-full rounded-lg bg-gray-700/40 border border-gray-600/60 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-300/40 resize-none"
          />
        </Field>
      ),
    },
    {
      id: "review",
      phase: 2,
      isReview: true,
      isValid: () => canSubmit,
      render: () => {
        const summaryRows: { label: string; value: string }[] = [];
        const startingLabel = answers.startingPoint
          ? STARTING_POINTS.find((o) => o.value === answers.startingPoint)?.label ?? null
          : startingPointStatus === "unresolved_other"
          ? startingPointOtherText.trim() || "Something else"
          : startingPointStatus === "unresolved_not_sure"
          ? "Not sure"
          : null;
        if (startingLabel) summaryRows.push({ label: "Starting from", value: startingLabel });
        if (answers.relevantBackground.trim())
          summaryRows.push({ label: "Background", value: answers.relevantBackground.trim() });
        const ql = QUALIFICATION_LEVELS.find((o) => o.value === answers.qualificationLevel)?.label;
        if (ql) summaryRows.push({ label: "Highest qualification", value: ql });
        const em = ENGLISH_MATHS.find((o) => o.value === answers.englishMaths)?.label;
        if (em) summaryRows.push({ label: "English & maths", value: em });
        const sci = SCIENCE_SUBJECTS.find((o) => o.value === answers.scienceSubjects)?.label;
        if (sci) summaryRows.push({ label: "Role-related subjects", value: sci });
        const ec = ENGLISH_COMFORT.find((o) => o.value === answers.englishComfort)?.label;
        if (ec) summaryRows.push({ label: "Studying in English", value: ec });
        const inc = INCOME_NEEDS.find((o) => o.value === answers.incomeNeed)?.label;
        if (inc) summaryRows.push({ label: "Earning need", value: inc });
        const bd = BUDGETS.find((o) => o.value === answers.budget)?.label;
        if (bd) summaryRows.push({ label: "Training budget", value: bd });
        const rg = REGIONS.find((o) => o.value === answers.region)?.label;
        if (rg) summaryRows.push({ label: "Region", value: rg });
        if (answers.area.trim()) summaryRows.push({ label: "Town / postcode", value: answers.area.trim() });
        const wh = WEEKLY_HOURS.find((o) => o.value === answers.weeklyHours)?.label;
        if (wh) summaryRows.push({ label: "Weekly time", value: wh });
        const cf = COMMUTE_FLEX.find((o) => o.value === answers.commuteFlex)?.label;
        if (cf) summaryRows.push({ label: "Travel", value: cf });

        return (
          <div>
            <h2 className="text-base font-medium text-white mb-1">Ready to check your route?</h2>
            <p className="text-[11px] text-gray-400 mb-3 leading-snug">
              Review your answers. Use Back to change anything before we run the check.
            </p>
            <dl className="rounded-lg border border-gray-700 bg-gray-800/60 divide-y divide-gray-700/60">
              {summaryRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-gray-500">{row.label}</dt>
                  <dd className="text-xs text-gray-100 break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
            {startingPointUnresolved && (
              <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2">
                <p className="text-[11px] text-amber-100 leading-snug">
                  {UNRESOLVED_STARTING_POINT_NOTICE}
                </p>
                {otherActive && startingPointOtherText.trim() && (
                  <p className="mt-1 text-[11px] text-amber-100/80 leading-snug">
                    {UNRESOLVED_STARTING_POINT_OTHER_NOTICE}
                  </p>
                )}
              </div>
            )}
            {!canSubmit && (
              <p className="mt-3 text-[11px] text-amber-200/90 leading-snug">
                A few earlier questions still need an answer — use Back to complete them.
              </p>
            )}
          </div>
        );
      },
    },
  ];

  const steps = rawSteps.filter((s): s is WizardStep => s !== null);
  const visibleIds = steps.map((s) => s.id);
  const questionIds = visibleIds.filter((id) => id !== "review");
  const totalQuestions = questionIds.length;

  // Initialise stepId once we know the visible steps; clamp any restored
  // value against the current visible set so an old session can't restore
  // onto a hidden or unknown screen.
  const currentStepId = clampStepId(stepId, visibleIds);
  useEffect(() => {
    if (stepId !== currentStepId) setStepId(currentStepId);
  }, [stepId, currentStepId, setStepId]);

  const safeIndex = Math.max(0, visibleIds.indexOf(currentStepId));
  const step = steps[safeIndex];
  const isReview = step.isReview === true;
  const canAdvance = step.isValid() || step.optional === true;
  const currentQuestionNumber = isReview
    ? totalQuestions
    : Math.min(questionIds.indexOf(step.id) + 1, totalQuestions);
  const progressPct = Math.round(
    ((isReview ? totalQuestions : currentQuestionNumber) / Math.max(1, totalQuestions)) * 100,
  );

  const goNext = () => {
    if (isReview) {
      submit();
    } else {
      const nextId = visibleIds[Math.min(safeIndex + 1, visibleIds.length - 1)];
      setStepId(nextId);
    }
  };
  const goBack = () => {
    const prevId = visibleIds[Math.max(safeIndex - 1, 0)];
    setStepId(prevId);
  };

  return (
    <div className="space-y-4">
      {/* Fine-grained progress */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
          <span>
            {isReview
              ? `Review · ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}`
              : `Question ${currentQuestionNumber} of ${totalQuestions}`}
          </span>
          {step.optional && !isReview && (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="text-amber-200 hover:text-white underline underline-offset-2"
            >
              Skip
            </button>
          )}
        </div>
        <div className="h-1 rounded-full bg-gray-700/60 overflow-hidden">
          <div
            className="h-full bg-amber-300 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Active question */}
      <div key={step.id} className="pt-1">
        {step.render()}
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-700/50 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={safeIndex === 0 || submitting}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance || submitting}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isReview ? (
            <Sparkles className="h-4 w-4" />
          ) : null}
          {submitting
            ? "Finding your route…"
            : isReview
            ? "Show my realistic route"
            : "Next"}
          {!submitting && !isReview && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
