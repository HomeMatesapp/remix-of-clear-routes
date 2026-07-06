import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2, Pencil, UserCog } from "lucide-react";
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
import { ModularRealityCheckWizard } from "@/components/role/ModularRealityCheckWizard";
import { resolveConfig, hasModularConfig } from "@/lib/reality-check/questionnaire/registry";
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

const PHASES = ["Starting point", "Qualifications", "Practical constraints", "Result"] as const;

const ContourBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <svg viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <g fill="none" stroke="hsl(var(--contour))" strokeWidth="1.4" opacity="0.4">
        <path d="M-50 800 C300 740, 620 830, 900 760 S1300 670, 1460 710" />
        <path d="M-50 720 C320 665, 640 755, 920 685 S1290 595, 1460 635" />
        <path d="M-50 640 C340 590, 660 680, 940 610 S1280 520, 1460 560" />
        <path d="M850 120 C1000 95, 1150 150, 1290 105 S1440 60, 1520 80" />
        <path d="M900 190 C1040 168, 1180 220, 1300 178 S1440 135, 1520 155" />
      </g>
    </svg>
  </div>
);

const WizardHeader = ({ roleName, roleSlug }: { roleName: string; roleSlug: string }) => (
  <nav className="sticky top-0 z-40 flex items-center justify-between bg-paper border-b-2 border-ink h-[66px] px-4 sm:px-8 md:px-12">
    <Link to="/" className="flex items-center gap-2.5 font-display font-extrabold text-[20px] text-ink no-underline">
      <span
        aria-hidden="true"
        className="inline-block w-0 h-0 border-l-[11px] border-r-[11px] border-b-[19px] border-l-transparent border-r-transparent border-b-path"
      />
      Clear Routes
    </Link>
    <Link
      to={`/role/${roleSlug}`}
      className="font-mono text-[13px] text-muted-foreground hover:text-ink hover:underline underline-offset-4"
    >
      <span className="hidden sm:inline">Save &amp; exit — back to {roleName}</span>
      <span className="sm:hidden">Save &amp; exit</span>
    </Link>
  </nav>
);

const PhaseTrail = ({ current }: { current: 0 | 1 | 2 | 3 }) => {
  // Progress fraction across the trail (0 → left, 3 → right)
  const donePct = Math.max(0, Math.min(1, current / (PHASES.length - 1))) * 92;
  return (
    <div className="mt-5 relative px-1.5" aria-label="Progress phases">
      <div className="absolute left-3.5 right-3.5 top-[11px] border-t-[3px] border-dashed border-[hsl(40_15%_82%)]" aria-hidden="true" />
      <div
        className="absolute left-3.5 top-[11px] border-t-[3px] border-dashed border-path transition-all duration-300"
        style={{ width: `${donePct}%` }}
        aria-hidden="true"
      />
      <ol className="relative flex justify-between list-none m-0 p-0">
        {PHASES.map((label, i) => {
          const done = i < current;
          const isCurrent = i === current;
          const isLast = i === PHASES.length - 1;
          return (
            <li key={label} className="flex flex-col items-center gap-2 w-1/4">
              {isLast ? (
                <span
                  className={[
                    "w-0 h-0 border-l-[12px] border-r-[12px] border-b-[21px] border-l-transparent border-r-transparent",
                    done || isCurrent ? "border-b-path" : "border-b-[hsl(40_15%_82%)]",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={[
                    "relative w-[22px] h-[22px] rounded-full bg-white border-[4px] transition-colors",
                    done
                      ? "border-path bg-path after:content-[''] after:absolute after:inset-1 after:rounded-full after:bg-white"
                      : isCurrent
                      ? "border-path shadow-[0_0_0_5px_hsl(var(--path)/0.15)]"
                      : "border-[hsl(40_15%_82%)]",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
              <span
                className={[
                  "font-mono text-[11px] tracking-[0.1em] uppercase text-center",
                  isCurrent
                    ? "text-path font-semibold"
                    : done
                    ? "text-ink"
                    : "text-muted-foreground",
                  // On narrow screens, hide labels for non-current phases
                  isCurrent ? "block" : "hidden sm:block",
                ].join(" ")}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

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
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Helmet>
        <title>Reality-check {role.role_name} | Clear Routes</title>
        <meta
          name="description"
          content={`Reality-check your route into ${role.role_name}. We'll use your background, qualifications, budget, time, and area to judge the most realistic route.`}
        />
      </Helmet>

      <WizardHeader roleName={role.role_name} roleSlug={role.role_slug} />

      <div className="relative flex-1 overflow-hidden">
        <ContourBackdrop />
        <main className="relative max-w-[820px] mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-20">
          <p className="font-mono text-[12.5px] tracking-[0.14em] uppercase text-muted-foreground">
            Reality-check · <b className="text-ink font-semibold">{role.role_name}</b>
          </p>

          <PhaseTrail current={currentStep} />

          {!result && prefilled && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-md border-2 border-ink bg-tint px-3 py-2">
              <p className="text-[13px] text-ink">Using your saved Decision Profile.</p>
              <Link
                to="/my-decisions#decision-profile"
                className="text-[12px] font-mono text-path underline underline-offset-4 hover:text-ink inline-flex items-center gap-1"
              >
                <UserCog className="h-3.5 w-3.5" /> Edit
              </Link>
            </div>
          )}

          {!result ? (
            <section
              aria-label="Reality-check this route"
              aria-live="polite"
              className="mt-8 bg-white border-2 border-ink rounded-[10px] overflow-hidden"
            >
              {hasModularConfig(role.role_slug) ? (
                <ModularRealityCheckWizard
                  role={role}
                  config={resolveConfig(role.role_slug)!}
                  onResult={(r) => setResult(r)}
                />
              ) : (
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
            </section>
          ) : (
            <section
              aria-label="Reality-check result"
              className="mt-8 bg-white border-2 border-ink rounded-[10px] p-4 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-[hsl(40_15%_82%)] pb-3">
                <p className="text-[12px] text-muted-foreground leading-snug">
                  <span className="font-mono uppercase tracking-wider text-ink mr-1.5">Checked for:</span>
                  {chips.join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={editAnswers}
                  className="inline-flex items-center gap-1 font-mono text-[12px] text-path hover:text-ink underline underline-offset-4"
                >
                  <Pencil className="h-3 w-3" /> Edit answers
                </button>
              </div>
              <div ref={resultRef}>
                {startingPointUnresolved && (
                  <div className="mb-4 rounded-md border-l-4 border-path bg-tint px-3 py-2">
                    <p className="text-[13px] text-ink leading-snug">
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
            </section>
          )}

          {!result && (
            <p className="mt-5 text-center font-mono text-[12.5px] text-muted-foreground">
              Your progress is saved on this device · No account needed
            </p>
          )}
        </main>
      </div>
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
          why="Your starting point decides which routes are even open to you — an apprenticeship straight from school and an experience-based NVQ route have completely different entry doors."
        >
          <ChipGroup
            options={STARTING_POINTS}
            value={answers.startingPoint}
            onChange={pickStartingPoint}
            disabled={submitting}
          />
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-dashed border-[hsl(40_15%_82%)]">
            <button
              type="button"
              disabled={submitting}
              aria-pressed={notSureActive}
              onClick={() => pickStartingPointUnresolved("not_sure")}
              className={[
                "font-body font-bold text-[14px] border-2 rounded-full px-4 py-2 transition-colors min-h-[40px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                notSureActive
                  ? "bg-path border-path text-white"
                  : "bg-white border-ink text-ink hover:border-path hover:text-path",
                "disabled:opacity-50",
              ].join(" ")}
            >
              Not sure
            </button>
            <button
              type="button"
              disabled={submitting}
              aria-pressed={otherActive}
              onClick={() => pickStartingPointUnresolved("other")}
              className={[
                "font-body font-bold text-[14px] border-2 rounded-full px-4 py-2 transition-colors min-h-[40px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                otherActive
                  ? "bg-path border-path text-white"
                  : "bg-white border-ink text-ink hover:border-path hover:text-path",
                "disabled:opacity-50",
              ].join(" ")}
            >
              Something else
            </button>
          </div>
          {otherActive && (
            <div className="mt-4">
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Tell us briefly what your current situation is (optional)
              </label>
              <input
                type="text"
                value={startingPointOtherText}
                onChange={(e) => setStartingPointOtherText(e.target.value)}
                placeholder="e.g. between roles after a career break"
                disabled={submitting}
                className="w-full rounded-md bg-white border-2 border-ink px-3 py-2 text-[15px] text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-path focus:ring-offset-0"
              />
              <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-snug">
                We'll skip inferring a starting point from this — your route judgement will be a little less specific.
              </p>
            </div>
          )}
          {notSureActive && (
            <p className="mt-3 text-[12.5px] text-muted-foreground leading-snug">
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
              why="If your starting point is a related field or a career change, your existing study or work can shorten a route — but only when it maps to what employers or awarding bodies recognise."
              error={backgroundMissing ? "Add a little more detail." : null}
            >
              <input
                type="text"
                value={answers.relevantBackground}
                onChange={(e) => set("relevantBackground", e.target.value)}
                placeholder="e.g. psychology degree, retail manager, biology A-level"
                disabled={submitting}
                className={PAPER_INPUT}
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
        <Field
          label="What's your highest qualification?"
          why="Different routes have different entry doors. Your highest qualification decides which are open right now, and which need bridging first."
        >
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
          why="Most regulated and apprenticeship routes require English and maths at GCSE grade 4/C or equivalent — sometimes as a strict entry gate."
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
        <Field
          label={scienceLabel}
          helper={scienceHelper}
          why="Some routes have subject-specific entry requirements — this signals whether you already meet them or would need a bridging qualification."
        >
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
          why="If English isn't your first language, we can point you at support and preparation routes instead of assuming you don't need them."
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
          why="If you need income now, unpaid or full-time study routes may not be realistic — this rules those out honestly rather than recommending routes you'd have to abandon."
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
          why="Some routes cost nothing and pay you; others quietly cost thousands. We use this to rule out routes that would put you in debt for no better outcome — never to sell you anything."
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
        <div className="space-y-6">
          <Field
            label="Where in the UK do you live?"
            helper="We use this to set realistic expectations for local opportunity coverage."
            why="Some routes cluster in specific regions and countries of the UK have different funding and entry rules. Your region shapes which routes are actually reachable."
          >
            <ChipGroup
              options={REGIONS}
              value={answers.region}
              onChange={(v) => set("region", v)}
              disabled={submitting}
            />
            {answers.region && !isSupportedRegion(answers.region) && (
              <p className="mt-3 text-[13px] text-wood font-medium leading-snug">
                Verified local opportunity coverage isn't available in your area yet — your route judgement will still work.
              </p>
            )}
          </Field>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Town or postcode (optional)
            </label>
            <input
              type="text"
              value={answers.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="e.g. Leeds, SE15"
              disabled={submitting}
              className={PAPER_INPUT}
            />
          </div>
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
          why="Time is the constraint people most often overestimate. A part-time college route needs steady evening hours for two years; an apprenticeship replaces your working week entirely."
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
          why="If a good route requires moving city or a long commute you can't sustain, we'd rather flag that upfront than let you find out three months in."
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
            rows={4}
            className={`${PAPER_INPUT} resize-none`}
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
            <h1 className="font-display font-extrabold text-ink tracking-[-0.02em] leading-[1.08] text-[clamp(24px,3.6vw,34px)]">
              Ready to check your route?
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[hsl(90_10%_28%)] max-w-[56ch]">
              Review your answers. Use Back to change anything before we run the check.
            </p>
            <dl className="mt-6 rounded-md border-2 border-ink divide-y-2 divide-ink/10 bg-white">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-1 sm:gap-4 px-4 py-3"
                >
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="text-[15px] text-ink break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
            {startingPointUnresolved && (
              <div className="mt-4 rounded-md border-l-4 border-path bg-tint px-3 py-2.5">
                <p className="text-[13.5px] text-ink leading-snug">
                  {UNRESOLVED_STARTING_POINT_NOTICE}
                </p>
                {otherActive && startingPointOtherText.trim() && (
                  <p className="mt-1.5 text-[13px] text-ink/80 leading-snug">
                    {UNRESOLVED_STARTING_POINT_OTHER_NOTICE}
                  </p>
                )}
              </div>
            )}
            {!canSubmit && (
              <p className="mt-4 text-[13.5px] text-danger font-medium leading-snug">
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
    <div>
      {/* Card header — question count + compact progress bar */}
      <div className="flex justify-between items-center gap-3 px-6 py-3.5 bg-tint border-b-2 border-ink">
        <span className="font-mono text-[12px] tracking-[0.14em] uppercase text-muted-foreground">
          {isReview ? `Review · ${totalQuestions} questions` : `Question ${currentQuestionNumber} of ${totalQuestions}`}
        </span>
        <span
          className="flex-1 max-w-[220px] h-[6px] border-[1.5px] border-ink rounded-full overflow-hidden bg-white"
          aria-hidden="true"
        >
          <span
            className="block h-full bg-path transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </span>
      </div>

      {/* Card body — current question */}
      <div key={step.id} className="p-6 sm:p-10">
        {step.render()}
        {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
      </div>

      {/* Card footer — Back / Skip / Next */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 px-6 py-4 border-t-2 border-dashed border-[hsl(40_15%_82%)]">
        <button
          type="button"
          onClick={goBack}
          disabled={safeIndex === 0 || submitting}
          className="font-body font-bold text-[15px] bg-transparent border-2 border-transparent text-muted-foreground px-4 py-2.5 rounded-[5px] hover:text-ink hover:border-ink disabled:opacity-35 disabled:cursor-default disabled:hover:border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path"
        >
          ← Back
        </button>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-5">
          {step.optional && !isReview && (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="font-mono text-[13px] text-muted-foreground hover:text-ink underline underline-offset-4 bg-transparent border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path rounded"
            >
              Skip this question
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance || submitting}
            className="font-display font-bold text-[16px] bg-path text-white border-0 px-7 py-3.5 rounded-[5px] hover:bg-ink disabled:bg-[hsl(40_15%_82%)] disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-white inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Finding your route…" : isReview ? "Show my realistic route →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PAPER_INPUT =
  "w-full rounded-md bg-white border-2 border-ink px-3 py-2.5 text-[15px] text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-path focus:ring-offset-0";
