import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { Loader2, Sparkles } from "lucide-react";

type RoleCtx = {
  role_name: string;
  short_description?: string | null;
  reality_check?: string | null;
  uncomfortable_truth?: string | null;
  opportunity_cost?: string | null;
  who_not_for?: string | null;
  career_regret_risk?: string | null;
  competition_level?: string | null;
  demand?: string | null;
  ai_impact_level?: string | null;
  salary_entry?: number | null;
  salary_experienced?: number | null;
  salary_senior?: number | null;
};

type Result = {
  verdict: string;
  headline: string;
  honest_take: string;
  watch_outs: string[];
  if_you_go_for_it: string;
};

const fields: { key: keyof Answers; label: string; placeholder: string }[] = [
  { key: "situation",  label: "Where you're at right now",          placeholder: "e.g. 28, working in retail, no degree, £4k saved" },
  { key: "motivation", label: "Why this role pulls at you",          placeholder: "e.g. I want work that uses my brain and pays the rent" },
  { key: "timeframe",  label: "How fast you need to be earning",     placeholder: "e.g. need an income within 12 months" },
  { key: "tradeoff",   label: "What you're willing to trade",        placeholder: "e.g. happy to study evenings, can't quit my job" },
];

type Answers = {
  situation: string;
  motivation: string;
  timeframe: string;
  tradeoff: string;
};

const verdictTone = (v: string): string => {
  const s = v.toLowerCase();
  if (s.includes("not for you")) return "bg-rose-50 text-rose-800 border-rose-200";
  if (s.includes("long shot")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("hard")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("realistic")) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
};

export const RealityCheckRoute = ({ role }: { role: RoleCtx }) => {
  const [answers, setAnswers] = useState<Answers>({ situation: "", motivation: "", timeframe: "", tradeoff: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const canSubmit = Object.values(answers).some((v) => v.trim().length > 3);

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    trackEvent("reality_check_submitted", { role: role.role_name });
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("reality-check", {
        body: { role, answers },
      });
      if (fnErr) throw fnErr;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const r = (data as { result: Result }).result;
      setResult(r);
      trackEvent("reality_check_result", { role: role.role_name, verdict: r?.verdict });
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
        Is {role.role_name} actually realistic for you?
      </h2>
      <p className="text-sm text-gray-300 mb-5">
        Tell us a bit about your situation. We'll give you a brutally honest take in seconds — not a sales pitch.
      </p>

      {!result && (
        <>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-300 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={answers[f.key]}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg bg-gray-700/60 border border-gray-600 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || loading}
              className="inline-flex items-center gap-2 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Reality-checking…" : "Give me the honest verdict"}
            </button>
            <p className="text-xs text-gray-400">Takes ~10s. No sign-up.</p>
          </div>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictTone(result.verdict)}`}>
              {result.verdict}
            </span>
            <p className="mt-3 text-base font-medium text-white leading-snug">{result.headline}</p>
          </div>

          {result.honest_take && (
            <p className="text-sm text-gray-200 leading-relaxed">{result.honest_take}</p>
          )}

          {result.watch_outs?.length > 0 && (
            <div className="rounded-lg bg-gray-700/50 border border-gray-600 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-2">Watch-outs</p>
              <ul className="space-y-1.5">
                {result.watch_outs.map((w, i) => (
                  <li key={i} className="text-sm text-gray-200 flex gap-2">
                    <span className="text-amber-300">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.if_you_go_for_it && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">
                If you go for it
              </p>
              <p className="text-sm text-gray-200 leading-relaxed">{result.if_you_go_for_it}</p>
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="text-xs text-gray-300 underline underline-offset-2 hover:text-white"
          >
            Try a different answer
          </button>
        </div>
      )}
    </section>
  );
};
