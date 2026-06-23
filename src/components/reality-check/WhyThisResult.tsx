// "Why this result?" — explains which answers and evidence shaped the verdict.
// Uses cautious language only: no "at risk", no absolute "wrong route" claims.

import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import {
  getInfluencingAnswers,
  getThingsToVerify,
  type SourceEntry,
} from "@/lib/reality-check/sources";
import type {
  RealityCheckAnswers,
  RealityCheckResult,
  RoleContext,
} from "@/lib/reality-check/types";

interface Props {
  role: RoleContext;
  answers: RealityCheckAnswers;
  result: RealityCheckResult;
  sources: SourceEntry[];
}

export function WhyThisResult({ role, answers, result, sources }: Props) {
  const influences = getInfluencingAnswers(answers);
  const verify = getThingsToVerify(role, answers);
  const sourceCount = sources.length;

  return (
    <div className="rounded-xl border border-gray-600 bg-gray-800/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-amber-200">
        <HelpCircle className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider">Why this result?</p>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed mb-3">
        Based on the information you provided. This is a judgement to help you
        decide what to look into next — not a prediction or a guarantee.
      </p>

      {/* Which of your answers influenced this */}
      {influences.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200 mb-1.5">
            Your answers that shaped this
          </p>
          <ul className="space-y-1.5">
            {influences.map((inf) => (
              <li key={inf.label} className="text-xs text-gray-200 leading-snug">
                <span className="font-medium text-white">{inf.label}:</span>{" "}
                <span className="text-gray-200">{inf.value}</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  {inf.influence}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Why one route may be better aligned */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1.5">
          Why <span className="text-white">{result.bestRoute.title}</span> may be a better fit
        </p>
        <p className="text-xs text-gray-200 leading-relaxed">
          {result.bestRoute.summary}{" "}
          {result.bestRoute.confidence && (
            <span className="text-gray-400">
              Confidence: {result.bestRoute.confidence}.
            </span>
          )}
        </p>
      </div>

      {/* Why another route may need caution — softened wording */}
      {result.routeToAvoid?.title && result.routeToAvoid.title !== "—" && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-1.5">
            Why <span className="text-white">{result.routeToAvoid.title}</span> may be worth discussing further
          </p>
          <p className="text-xs text-gray-200 leading-relaxed">
            {result.routeToAvoid.whyRisky || "Based on what you told us, there may be a mismatch worth checking before committing."}
          </p>
        </div>
      )}

      {/* What to verify */}
      {verify.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 mb-1.5">
            What to check before you act
          </p>
          <ul className="space-y-1">
            {verify.map((v, i) => (
              <li key={i} className="text-xs text-gray-200 leading-snug flex gap-2">
                <span className="text-sky-300">•</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-gray-400 leading-relaxed pt-3 border-t border-gray-700">
        Evidence used: {sourceCount} {sourceCount === 1 ? "source" : "sources"} from UK public bodies
        (see citations below).{" "}
        <Link to="/sources" className="underline underline-offset-2 hover:text-white">
          How we judge routes
        </Link>
        .
      </p>
    </div>
  );
}
