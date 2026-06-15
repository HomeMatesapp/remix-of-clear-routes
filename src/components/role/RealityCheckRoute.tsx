import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { saveDecision, stashPendingDecision } from "@/lib/saved-decisions";
import { Loader2, Sparkles, AlertOctagon, MapPin, Compass, LifeBuoy, ListChecks, BookmarkPlus, Check, UserCog } from "lucide-react";
import {
  BUDGETS,
  COMMUTE_FLEX,
  INCOME_NEEDS,
  STARTING_POINTS,
  WEEKLY_HOURS,
  type RealityCheckAnswers,
  type RealityCheckResult,
  type RoleContext,
} from "@/lib/reality-check/types";
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
};

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const RealityCheckRoute = ({ role }: { role: RoleContext }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<RealityCheckAnswers>(emptyAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RealityCheckResult | null>(null);
  const [initialProfile, setInitialProfile] = useState<DecisionProfileFields | null>(null);
  const [prefilled, setPrefilled] = useState(false);

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

  // Required fields: starting point, income need, budget, area.
  const missing: string[] = [];
  if (!answers.startingPoint) missing.push("starting point");
  if (!answers.incomeNeed)    missing.push("earning need");
  if (!answers.budget)        missing.push("budget");
  if (!answers.area.trim())   missing.push("area");
  const canSubmit = missing.length === 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
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
  };

  return (
    <section
      aria-label="Reality-check this route"
      className="relative rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-3 sm:p-4 mb-6 text-white shadow-sm"
    >
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
                : "Fill all 4 fields above."}
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
        <ResultView
          result={result}
          answers={answers}
          role={role}
          onReset={reset}
          initialProfile={initialProfile}
          onProfileSaved={(p) => setInitialProfile(p)}
        />
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
  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictTone(
            result.overallVerdict
          )}`}
        >
          {result.overallVerdict}
        </span>
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
