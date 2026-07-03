import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gavel, Info, Sparkles } from "lucide-react";
import {
  loadSessionResult,
  type SessionRCEntry,
} from "@/components/role/reality-check-shared";
import {
  isRealityCheckEnabled,
  type RoleServiceLevel,
} from "@/lib/reality-check/service-levels";
import { READINESS_LABEL } from "@/lib/reality-check/types";

/**
 * Compact role-page entry point for the Reality-check.
 *
 * Behaviour by service_level:
 *   - info_only      → honest "not reviewed yet" card. No Start button.
 *   - reality_check  → standard CTA (or compact summary if a result exists).
 *   - full_support   → same as reality_check (no full_support roles in Release 1).
 *
 * Result summary surfaces the deterministic four-state `readiness` chip when
 * present, falling back to the legacy `overallVerdict` for older session entries.
 */
export const RealityCheckCTA = ({
  roleSlug,
  roleName,
  serviceLevel,
}: {
  roleSlug: string;
  roleName: string;
  serviceLevel: RoleServiceLevel | null | undefined;
}) => {
  const [cached, setCached] = useState<SessionRCEntry | null>(null);

  useEffect(() => {
    setCached(loadSessionResult(roleSlug));
  }, [roleSlug]);

  if (!isRealityCheckEnabled(serviceLevel)) {
    return (
      <section
        aria-label="Reality-check not yet available for this role"
        className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6"
      >
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              General role info only
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              We haven't reviewed the entry-route logic for {roleName} yet, so the
              adaptive Reality-check isn't available here. The role information
              below is general — confirm specifics directly with employers or
              training providers.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const target = `/role/${roleSlug}/reality-check`;

  if (cached) {
    const r = cached.result;
    const firstMove = r.immediateAction || r.firstMoves?.[0];
    const readinessLabel = r.readiness ? READINESS_LABEL[r.readiness] : r.overallVerdict;
    return (
      <section
        aria-label="Your route judgement"
        className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-gray-900 to-gray-800 p-4 mb-6 text-white shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2 text-amber-300">
          <Gavel className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-wider">Your route judgement</p>
        </div>
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
            {readinessLabel}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Best route</dt>
            <dd className="text-sm text-gray-100 leading-snug mt-0.5">{r.bestRoute.title}</dd>
          </div>
          {firstMove && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">Do this week</dt>
              <dd className="text-sm text-gray-100 leading-snug mt-0.5">{firstMove}</dd>
            </div>
          )}
        </dl>
        <Link
          to={target}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-200 hover:text-white underline underline-offset-2"
        >
          View full Reality-check <ArrowRight className="h-3 w-3" />
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="Find your most realistic route"
      className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-5 mb-6 text-white shadow-sm"
    >
      <h2 className="text-lg font-semibold mb-2 leading-snug">
        Find your most realistic route into {roleName}
      </h2>
      <p className="text-sm text-gray-300 mb-3 leading-relaxed">
        In about 3 minutes you'll get:
      </p>
      <ul className="space-y-1.5 mb-3 text-sm text-gray-100">
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-amber-300 flex-shrink-0 mt-0.5">·</span>
          <span>the most realistic route for your situation</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-amber-300 flex-shrink-0 mt-0.5">·</span>
          <span>the main barriers you'll need to solve</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-amber-300 flex-shrink-0 mt-0.5">·</span>
          <span>the training route to avoid</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-amber-300 flex-shrink-0 mt-0.5">·</span>
          <span>your next three actions</span>
        </li>
      </ul>
      <p className="text-xs text-gray-400 mb-4">
        No account needed. You can save the result afterwards.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={target}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-amber-200 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Check my route
        </Link>
        <a
          href="#about-this-role"
          className="text-xs text-gray-300 underline underline-offset-2 hover:text-white"
        >
          Not ready yet? Explore the role
        </a>
      </div>
    </section>
  );
};
