import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { Loader2, Sparkles, AlertOctagon, MapPin, Compass, LifeBuoy, ListChecks } from "lucide-react";
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
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
  const [answers, setAnswers] = useState<RealityCheckAnswers>(emptyAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RealityCheckResult | null>(null);

  // Require at least 3 structured answers before we'll judge anything.
  const filledCount = [
    answers.startingPoint,
    answers.incomeNeed,
    answers.weeklyHours,
    answers.budget,
    answers.commuteFlex,
    answers.area.trim() ? "area" : null,
  ].filter(Boolean).length;
  const canSubmit = filledCount >= 3;

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
      className="relative rounded-2xl border-2 border-gray-900 bg-gradient-to-br from-gray-900 to-gray-800 p-5 sm:p-6 mb-8 text-white shadow-lg"
    >
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-amber-300" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
          Reality-check this route
        </p>
      </div>
      <h2 className="text-lg sm:text-xl font-medium mb-1">
        What's the most realistic route into {role.role_name} for you?
      </h2>
      <p className="text-sm text-gray-300 mb-5">
        Answer a few quick questions about your situation. Clear Routes will judge the best route, a backup, and — crucially — the route to avoid.
      </p>

      {!result && (
        <>
          <div className="space-y-4">
            <Field label="1. Starting point">
              <ChipGroup
                options={STARTING_POINTS}
                value={answers.startingPoint}
                onChange={(v) => setAnswers((a) => ({ ...a, startingPoint: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="2. Need to earn while training?">
              <ChipGroup
                options={INCOME_NEEDS}
                value={answers.incomeNeed}
                onChange={(v) => setAnswers((a) => ({ ...a, incomeNeed: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="3. Weekly time available">
              <ChipGroup
                options={WEEKLY_HOURS}
                value={answers.weeklyHours}
                onChange={(v) => setAnswers((a) => ({ ...a, weeklyHours: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="4. Budget">
              <ChipGroup
                options={BUDGETS}
                value={answers.budget}
                onChange={(v) => setAnswers((a) => ({ ...a, budget: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="5. Area (town, city, or outward postcode)">
              <input
                type="text"
                value={answers.area}
                onChange={(e) => setAnswers((a) => ({ ...a, area: e.target.value }))}
                placeholder="e.g. Leeds, SE15, M14"
                disabled={loading}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              />
              <p className="text-[11px] text-gray-400 mt-1">No full postcode — just the area.</p>
            </Field>

            <Field label="6. Commute / relocation flexibility">
              <ChipGroup
                options={COMMUTE_FLEX}
                value={answers.commuteFlex}
                onChange={(v) => setAnswers((a) => ({ ...a, commuteFlex: v }))}
                disabled={loading}
              />
            </Field>

            <Field label="Anything else we should know? (optional)">
              <textarea
                value={answers.notes}
                onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value }))}
                placeholder="Caring responsibilities, health, prior attempts, specific employers in mind…"
                disabled={loading}
                rows={2}
                className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300/60 resize-none"
              />
            </Field>
          </div>

          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || loading}
              className="inline-flex items-center gap-2 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Judging your route…" : "Judge my route"}
            </button>
            <p className="text-xs text-gray-400">
              {canSubmit ? "Takes ~10s. No sign-up." : "Answer a few more to get a verdict."}
            </p>
          </div>
        </>
      )}

      {result && (
        <ResultView result={result} onReset={reset} />
      )}
    </section>
  );
};

// ── Result rendering ──────────────────────────────────────────────────────────

function ResultView({ result, onReset }: { result: RealityCheckResult; onReset: () => void }) {
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
