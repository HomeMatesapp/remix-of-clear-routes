import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { saveDecision, stashPendingDecision } from "@/lib/saved-decisions";
import { Loader2, Sparkles, AlertOctagon, MapPin, Compass, LifeBuoy, ListChecks, BookmarkPlus, Check, UserCog, Pencil, Gavel } from "lucide-react";
import { SupportMatches } from "@/components/role/SupportMatches";
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

const labelFor = <T extends string>(
  options: { value: T; label: string }[],
  v: T | null,
): string | null => (v ? options.find((o) => o.value === v)?.label ?? null : null);

const answerChips = (a: RealityCheckAnswers): string[] => {
  const chips: string[] = [];
  const sp = labelFor(STARTING_POINTS, a.startingPoint);
  if (sp) chips.push(sp);
  if (a.relevantBackground.trim()) chips.push(a.relevantBackground.trim());
  const ql = labelFor(QUALIFICATION_LEVELS, a.qualificationLevel);
  if (ql) chips.push(ql);
  const em = labelFor(ENGLISH_MATHS, a.englishMaths);
  if (em) chips.push(`English/maths: ${em}`);
  const inc = labelFor(INCOME_NEEDS, a.incomeNeed);
  if (inc) chips.push(inc);
  const b = labelFor(BUDGETS, a.budget);
  if (b) chips.push(`${b} budget`);
  if (a.area.trim()) chips.push(a.area.trim());
  const cf = labelFor(COMMUTE_FLEX, a.commuteFlex);
  if (cf) chips.push(cf);
  const wh = labelFor(WEEKLY_HOURS, a.weeklyHours);
  if (wh) chips.push(wh);
  return chips;
};
import {
  answersToProfile,
  emptyProfileFields,
  hasAnyProfileField,
  profileToAnswers,
  profilesDiffer,
  type DecisionProfileFields,
} from "@/lib/reality-check/profile-mapping";

const verdictTone = (v: string): string => {
  const s = v.toLowerCase();
  if (s.includes("not for you")) return "bg-rose-50 text-rose-800 border-rose-200";
  if (s.includes("long shot"))   return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("hard"))        return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("realistic"))   return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
};

const confidenceTone = (c: string): string => {
  if (c === "high")   return "bg-emerald-100 text-emerald-800";
  if (c === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-200 text-gray-700";
};

const localToneText = (r: string): string => {
  if (r === "strong") return "text-emerald-700";
  if (r === "weak")   return "text-rose-700";
  return "text-amber-700";
};

const emptyAnswers: RealityCheckAnswers = {
  startingPoint: null,
  incomeNeed: null,
  weeklyHours: null,
  budget: null,
  area: "",
  commuteFlex: null,
  notes: "",
  relevantBackground: "",
  englishMaths: null,
  scienceSubjects: null,
  qualificationLevel: null,
  englishComfort: null,
};

// Starting points where Relevant background is required (vs optional).
const BACKGROUND_REQUIRED_FOR: Array<RealityCheckAnswers["startingPoint"]> = [
  "graduate",
  "career_changer",
  "adjacent",
];

// Small reusable chip selector (kept inline — it's only used here)
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "border-amber-300 bg-amber-300 text-gray-900"
                : "border-gray-600 bg-gray-700/50 text-gray-200 hover:bg-gray-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">{label}</label>
      {helper && <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{helper}</p>}
      {children}
      {error && <p className="text-[10px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
}

export const RealityCheckRoute = ({
  role,
  onResult,
}: {
  role: RoleContext;
  onResult?: (hasResult: boolean) => void;
}) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<RealityCheckAnswers>(emptyAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RealityCheckResult | null>(null);
  const [initialProfile, setInitialProfile] = useState<DecisionProfileFields | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Prefill from the user's saved Decision Profile when logged in.
  useEffect(() => {
    if (!user) {
      setInitialProfile(null);
      setPrefilled(false);
      return;
    }
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
        // Normalise: store the profile as it looks after round-tripping through
        // the answer enums, so diff comparisons aren't tripped by free-text
        // labels (e.g. DB "Graduate" vs enum code "graduate").
        const normalisedAnswers = profileToAnswers(p, emptyAnswers);
        setInitialProfile(answersToProfile(normalisedAnswers));
        setAnswers((a) => profileToAnswers(p, a));
        setPrefilled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Smooth-scroll into the result area once a result lands.
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  // Required fields. Relevant background is required when the starting point
  // implies the user has prior study or work to describe.
  const backgroundRequired = !!answers.startingPoint && BACKGROUND_REQUIRED_FOR.includes(answers.startingPoint);
  const backgroundMissing = backgroundRequired && answers.relevantBackground.trim().length < 3;
  const missing: string[] = [];
  if (!answers.startingPoint) missing.push("starting point");
  if (backgroundMissing)      missing.push("relevant background");
  if (!answers.incomeNeed)    missing.push("earning need");
  if (!answers.budget)        missing.push("budget");
  if (!answers.area.trim())   missing.push("area");
  const canSubmit = missing.length === 0;


  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    onResult?.(false);
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
      onResult?.(true);
      trackEvent("reality_check_result", { role: role.role_name, verdict: r?.overallVerdict });
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    onResult?.(false);
  };

  const chips = answerChips(answers);

  return (
    <section
      aria-label="Reality-check this route"
      className="relative rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-3 sm:p-4 mb-6 text-white shadow-sm"
    >
      {!result && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Reality-check this route
            </p>
          </div>
          <h2 className="text-base font-medium mb-0.5">
            Is {role.role_name} realistic for you?
          </h2>
          <p className="text-[11px] text-gray-400 mb-2.5 leading-snug">
            Four quick facts about your situation. We'll show the route with the best odds — plus a backup, and one to avoid.
          </p>
        </>
      )}

      {result && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
          <p className="text-[11px] text-gray-300 leading-snug">
            <span className="font-semibold uppercase tracking-wider text-gray-500 mr-1.5">Checked for:</span>
            {chips.join(" · ")}
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 hover:text-white underline underline-offset-2"
          >
            <Pencil className="h-3 w-3" /> Edit answers
          </button>
        </div>
      )}

      {!result && prefilled && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5">
          <p className="text-[11px] text-amber-100">
            Using your saved Decision Profile.
          </p>

          <Link
            to="/my-decisions#decision-profile"
            className="text-[11px] text-amber-200 underline underline-offset-2 hover:text-white inline-flex items-center gap-1"
          >
            <UserCog className="h-3 w-3" /> Edit
          </Link>
        </div>
      )}

      {!result && (
        <>
          {/* Primary: Your situation */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Your situation</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Starting point">
              <ChipGroup
                options={STARTING_POINTS}
                value={answers.startingPoint}
                onChange={(v) => setAnswers((a) => ({ ...a, startingPoint: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="Need to earn while training?">
              <ChipGroup
                options={INCOME_NEEDS}
                value={answers.incomeNeed}
                onChange={(v) => setAnswers((a) => ({ ...a, incomeNeed: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="Budget">
              <ChipGroup
                options={BUDGETS}
                value={answers.budget}
                onChange={(v) => setAnswers((a) => ({ ...a, budget: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="Area (town or postcode)">
              <input
                type="text"
                value={answers.area}
                onChange={(e) => setAnswers((a) => ({ ...a, area: e.target.value }))}
                placeholder="e.g. Leeds, SE15"
                disabled={loading}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
              />
            </Field>
          </div>

          {/* Qualifications and background */}
          <div className="mt-3 rounded-lg border border-gray-700/40 bg-gray-800/30 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Qualifications and background
            </p>
            <p className="text-[10px] text-gray-500 mb-2 leading-snug">
              Routes can depend on your subjects, qualifications, and English/study readiness.
            </p>

            <Field
              label={`Relevant background${backgroundRequired ? "" : " (optional)"}`}
              helper="What have you studied or worked in?"
              error={backgroundMissing ? "Add a little more detail about what you studied or worked in." : null}
            >
              <input
                type="text"
                value={answers.relevantBackground}
                onChange={(e) => setAnswers((a) => ({ ...a, relevantBackground: e.target.value }))}
                placeholder="e.g. psychology degree, retail manager, healthcare assistant, biology A-level, no healthcare experience"
                disabled={loading}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-2.5 py-1 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
              <Field
                label="Do you have GCSE English and maths, or equivalent?"
                helper="Many routes ask for English and maths or an equivalent qualification."
              >
                <ChipGroup
                  options={ENGLISH_MATHS}
                  value={answers.englishMaths}
                  onChange={(v) => setAnswers((a) => ({ ...a, englishMaths: v }))}
                  disabled={loading}
                />
              </Field>

              <Field
                label="Do you have science or role-related subjects?"
                helper="For some routes, subjects like science, health, maths, or technology can affect your options."
              >
                <ChipGroup
                  options={SCIENCE_SUBJECTS}
                  value={answers.scienceSubjects}
                  onChange={(v) => setAnswers((a) => ({ ...a, scienceSubjects: v }))}
                  disabled={loading}
                />
              </Field>

              <Field label="Highest qualification level">
                <ChipGroup
                  options={QUALIFICATION_LEVELS}
                  value={answers.qualificationLevel}
                  onChange={(v) => setAnswers((a) => ({ ...a, qualificationLevel: v }))}
                  disabled={loading}
                />
              </Field>

              <Field
                label="Are you comfortable studying and working in English?"
                helper="Some routes involve written assignments, interviews, placements, or professional communication."
              >
                <ChipGroup
                  options={ENGLISH_COMFORT}
                  value={answers.englishComfort}
                  onChange={(v) => setAnswers((a) => ({ ...a, englishComfort: v }))}
                  disabled={loading}
                />
              </Field>
            </div>
          </div>


          {/* CTA sits close to primary fields */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || loading}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-amber-300 text-gray-900 px-3.5 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Finding your route…" : "Show my realistic route"}
            </button>
            <p className="text-[11px] text-gray-500">
              {canSubmit
                ? "Takes ~10s. No sign-up."
                : `Add: ${missing.join(", ")}.`}
            </p>
          </div>

          {/* Secondary: Your flexibility */}
          <div className="mt-3 rounded-lg border border-gray-700/40 bg-gray-800/30 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Your flexibility <span className="text-gray-600 font-normal normal-case">— optional</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Weekly time available">
                <ChipGroup
                  options={WEEKLY_HOURS}
                  value={answers.weeklyHours}
                  onChange={(v) => setAnswers((a) => ({ ...a, weeklyHours: v }))}
                  disabled={loading}
                />
              </Field>
              <Field label="Commute / relocation">
                <ChipGroup
                  options={COMMUTE_FLEX}
                  value={answers.commuteFlex}
                  onChange={(v) => setAnswers((a) => ({ ...a, commuteFlex: v }))}
                  disabled={loading}
                />
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Anything else? (optional)">
                <textarea
                  value={answers.notes}
                  onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value }))}
                  placeholder="Caring responsibilities, health, prior attempts…"
                  disabled={loading}
                  rows={2}
                  className="w-full rounded-lg bg-gray-700/40 border border-gray-600/60 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-300/40 resize-none"
                />
              </Field>
            </div>
          </div>

          {error && <p className="mt-2.5 text-xs text-rose-300">{error}</p>}
        </>
      )}

      {result && (
        <div ref={resultRef}>
          <ResultView
            result={result}
            answers={answers}
            role={role}
            onReset={reset}
            initialProfile={initialProfile}
            onProfileSaved={(p) => setInitialProfile(p)}
          />
        </div>
      )}
    </section>
  );
};

// ── Save prompt ───────────────────────────────────────────────────────────────

function SavePrompt({
  role,
  answers,
  result,
}: {
  role: RoleContext;
  answers: RealityCheckAnswers;
  result: RealityCheckResult;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    if (saving || saved) return;
    trackEvent("save_decision_clicked", { role: role.role_name, logged_in: !!user });

    if (!user) {
      stashPendingDecision(role, answers, result);
      navigate(`/signup?redirect=/my-decisions&reason=save`);
      return;
    }

    setSaving(true);
    try {
      await saveDecision(user.id, role, answers, result);
      setSaved(true);
      trackEvent("decision_saved", { role: role.role_name });
      toast({
        title: "Saved to My Career Decisions",
        description: "You can come back and compare routes any time.",
      });
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: (e as Error).message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-start gap-3">
        <Check className="h-4 w-4 text-emerald-300 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Saved to My Career Decisions</p>
          <button
            type="button"
            onClick={() => navigate("/my-decisions")}
            className="text-xs text-emerald-200 underline underline-offset-2 hover:text-white mt-1"
          >
            View My Career Decisions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-300/5 p-4">
      <div className="flex items-start gap-2 mb-2">
        <BookmarkPlus className="h-4 w-4 text-amber-300 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Save this decision</p>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            Keep this route check, compare it with other careers, and come back when you're ready.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-2 inline-flex items-center gap-2 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
        {saving ? "Saving…" : "Save to My Career Decisions"}
      </button>
      {!user && (
        <p className="text-[11px] text-gray-400 mt-2">
          We'll ask you to create a free account so you can return to it.
        </p>
      )}
    </div>
  );
}

// ── Result rendering ──────────────────────────────────────────────────────────

function ResultView({
  result,
  answers,
  role,
  onReset,
  initialProfile,
  onProfileSaved,
}: {
  result: RealityCheckResult;
  answers: RealityCheckAnswers;
  role: RoleContext;
  onReset: () => void;
  initialProfile: DecisionProfileFields | null;
  onProfileSaved: (p: DecisionProfileFields) => void;
}) {
  const firstMove = result.firstMoves?.[0];
  return (
    <div className="space-y-4">
      {/* Decision summary — scannable verdict at the top */}
      <div className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-gray-800 to-gray-900 p-4">
        <div className="flex items-center gap-2 mb-2 text-amber-300">
          <Gavel className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-wider">Your route judgement</p>
        </div>
        <div className="mb-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictTone(
              result.overallVerdict
            )}`}
          >
            {result.overallVerdict}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <SummaryRow label="Best route" value={result.bestRoute.title} tone="emerald" />
          <SummaryRow label="Be careful with" value={result.routeToAvoid.title} tone="rose" />
          <SummaryRow
            label="Local realism"
            value={
              <span className={`capitalize font-medium ${localToneText(result.localRealism.rating)}`}>
                {result.localRealism.rating}
              </span>
            }
            tone="amber"
          />
          {firstMove && <SummaryRow label="First move" value={firstMove} tone="sky" />}
        </dl>
      </div>


      {/* Best route */}
      <Card icon={<Compass className="h-4 w-4" />} eyebrow="Best route for you" tone="emerald">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{result.bestRoute.title}</h3>
          {result.bestRoute.confidence && (
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${confidenceTone(
                result.bestRoute.confidence
              )}`}
            >
              {result.bestRoute.confidence} confidence
            </span>
          )}
        </div>
        <p className="text-sm text-gray-200 mt-1 leading-relaxed">{result.bestRoute.summary}</p>

        {result.bestRoute.whyThisFits?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">Why this fits you</p>
            <ul className="space-y-1">
              {result.bestRoute.whyThisFits.map((w, i) => (
                <li key={i} className="text-sm text-gray-200 flex gap-2">
                  <span className="text-emerald-300">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Time"     value={result.bestRoute.estimatedTime} />
          <Stat label="Cost"     value={result.bestRoute.likelyCost} />
          <Stat label="Hard bit" value={result.bestRoute.mainDifficulty} />
        </div>
      </Card>

      {/* Backup route */}
      <Card icon={<LifeBuoy className="h-4 w-4" />} eyebrow="Backup route" tone="sky">
        <h3 className="text-base font-semibold text-white">{result.backupRoute.title}</h3>
        <p className="text-sm text-gray-200 mt-1 leading-relaxed">{result.backupRoute.summary}</p>
        {result.backupRoute.tradeOff && (
          <p className="text-xs text-gray-400 mt-2">
            <span className="font-semibold text-sky-300 uppercase tracking-wider mr-1">Trade-off:</span>
            {result.backupRoute.tradeOff}
          </p>
        )}
      </Card>

      {/* Route to avoid — the differentiator. Never softened. */}
      <Card icon={<AlertOctagon className="h-4 w-4" />} eyebrow="Route to avoid" tone="rose">
        <h3 className="text-base font-semibold text-white">{result.routeToAvoid.title}</h3>
        {result.routeToAvoid.whyRisky && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-1">Why this is risky for you</p>
            <p className="text-sm text-gray-200 leading-relaxed">{result.routeToAvoid.whyRisky}</p>
          </div>
        )}
        {result.routeToAvoid.whenItMightWork && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-1">When it might still work</p>
            <p className="text-sm text-gray-300 leading-relaxed">{result.routeToAvoid.whenItMightWork}</p>
          </div>
        )}
      </Card>

      {/* Local realism */}
      <Card icon={<MapPin className="h-4 w-4" />} eyebrow="Local realism" tone="amber">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold capitalize ${localToneText(result.localRealism.rating)}`}>
            {result.localRealism.rating}
          </span>
        </div>
        <p className="text-sm text-gray-200 mt-1 leading-relaxed">{result.localRealism.summary}</p>
        {result.localRealism.dependsOn?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-1">Depends on</p>
            <ul className="space-y-1">
              {result.localRealism.dependsOn.map((d, i) => (
                <li key={i} className="text-sm text-gray-200 flex gap-2">
                  <span className="text-amber-300">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* First moves */}
      {result.firstMoves?.length > 0 && (
        <Card icon={<ListChecks className="h-4 w-4" />} eyebrow="First 3 moves" tone="amber">
          <ol className="space-y-2">
            {result.firstMoves.map((m, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-300 text-gray-900 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-200 leading-relaxed">{m}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {role.role_slug && (
        <SupportMatches
          roleSlug={role.role_slug}
          roleName={role.role_name}
          variant="dark"
          max={3}
        />
      )}

      <SavePrompt role={role} answers={answers} result={result} />

      <ProfileSyncPrompt
        answers={answers}
        initialProfile={initialProfile}
        onProfileSaved={onProfileSaved}
      />

      <button
        type="button"
        onClick={onReset}
        className="text-xs text-gray-300 underline underline-offset-2 hover:text-white"
      >
        Change my answers
      </button>
    </div>
  );
}

const toneRing: Record<string, string> = {
  emerald: "border-emerald-400/40",
  sky:     "border-sky-400/40",
  rose:    "border-rose-400/60 ring-1 ring-rose-400/30",
  amber:   "border-amber-300/40",
};
const toneIcon: Record<string, string> = {
  emerald: "text-emerald-300",
  sky:     "text-sky-300",
  rose:    "text-rose-300",
  amber:   "text-amber-300",
};

function Card({
  icon,
  eyebrow,
  tone,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  tone: "emerald" | "sky" | "rose" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl bg-gray-700/40 border ${toneRing[tone]} p-4`}>
      <div className={`flex items-center gap-2 mb-2 ${toneIcon[tone]}`}>
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{eyebrow}</p>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-600 p-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-xs font-medium text-white leading-tight mt-0.5">{value}</p>
    </div>
  );
}

const summaryLabelTone: Record<string, string> = {
  emerald: "text-emerald-300",
  sky:     "text-sky-300",
  rose:    "text-rose-300",
  amber:   "text-amber-300",
};

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  return (
    <div className="flex flex-col">
      <dt className={`text-[10px] font-semibold uppercase tracking-wider ${summaryLabelTone[tone]}`}>
        {label}
      </dt>
      <dd className="text-sm text-gray-100 leading-snug mt-0.5">{value}</dd>
    </div>
  );
}

// ── Decision Profile sync prompt ──────────────────────────────────────────────

function ProfileSyncPrompt({
  answers,
  initialProfile,
  onProfileSaved,
}: {
  answers: RealityCheckAnswers;
  initialProfile: DecisionProfileFields | null;
  onProfileSaved: (p: DecisionProfileFields) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user || done || dismissed) return null;

  const current = answersToProfile(answers);
  if (!hasAnyProfileField(current)) return null;

  const isNew = !initialProfile;
  const isUpdate = !!initialProfile && profilesDiffer(initialProfile, current);
  if (!isNew && !isUpdate) return null;

  const heading = isNew
    ? "Save these answers to your Decision Profile?"
    : "Update your Decision Profile with these answers?";

  const onConfirm = async () => {
    if (saving) return;
    setSaving(true);
    const payload = { user_id: user.id, ...current };
    const { error } = await supabase
      .from("decision_profiles")
      .upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save profile", description: error.message, variant: "destructive" });
      return;
    }
    onProfileSaved(current);
    setDone(true);
    toast({
      title: isNew ? "Decision Profile saved" : "Decision Profile updated",
      description: "Clear Routes will use these constraints next time.",
    });
  };

  return (
    <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
      <div className="flex items-start gap-2 mb-2">
        <UserCog className="h-4 w-4 text-sky-300 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">{heading}</p>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            Your Decision Profile helps Clear Routes judge routes from your real situation.
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-medium bg-sky-300 text-gray-900 px-3 py-1.5 rounded-lg hover:bg-sky-200 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : isNew ? "Save profile" : "Update profile"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
