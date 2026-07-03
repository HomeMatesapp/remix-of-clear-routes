import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
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
 * Field Map re-skin: paper card, 2px ink borders, mono eyebrows, and a
 * dashed magenta path along the leading edge to signal "this is the route".
 * Magenta is reserved for the primary action and the path itself.
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

  // ── info_only: honest "not surveyed" note ────────────────────────────────
  if (!isRealityCheckEnabled(serviceLevel)) {
    return (
      <section
        aria-label="Reality-check not yet available for this role"
        className="relative rounded-md border-2 border-dashed border-ink/40 bg-tint/60 p-4 mb-6"
      >
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-ink/60 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 mb-1">
              Unsurveyed sheet
            </p>
            <p className="text-sm font-semibold text-ink">
              General role info only
            </p>
            <p className="text-xs text-ink/70 mt-1 leading-relaxed">
              We haven't reviewed the entry-route logic for {roleName} yet, so
              the adaptive Reality-check isn't available here. The role
              information below is general — confirm specifics directly with
              employers or training providers.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const target = `/role/${roleSlug}/reality-check`;

  // ── cached: compact "your route judgement" summary ───────────────────────
  if (cached) {
    const r = cached.result;
    const firstMove = r.immediateAction || r.firstMoves?.[0];
    const readinessLabel = r.readiness ? READINESS_LABEL[r.readiness] : r.overallVerdict;
    return (
      <section
        aria-label="Your route judgement"
        className="relative rounded-md border-2 border-ink bg-paper p-5 mb-6 overflow-hidden"
      >
        {/* dashed magenta path along the left edge — the route */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[6px] border-l-2 border-dashed border-primary"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 mb-2">
          Your route judgement
        </p>
        <div className="mb-4">
          <span className="inline-flex items-center rounded-sm border-2 border-ink bg-paper px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink">
            {readinessLabel}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-wood mb-0.5">
              Best route
            </dt>
            <dd className="text-sm text-ink leading-snug">{r.bestRoute.title}</dd>
          </div>
          {firstMove && (
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 mb-0.5">
                Do this week
              </dt>
              <dd className="text-sm text-ink leading-snug">{firstMove}</dd>
            </div>
          )}
        </dl>
        <Link
          to={target}
          className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:underline underline-offset-4"
        >
          View full Reality-check <ArrowRight className="h-3 w-3" />
        </Link>
      </section>
    );
  }

  // ── default: primary CTA ─────────────────────────────────────────────────
  return (
    <section
      aria-label="Find your most realistic route"
      className="relative rounded-md border-2 border-ink bg-paper p-5 sm:p-6 mb-6 overflow-hidden"
    >
      {/* trig-point triangle — small map marker in the corner */}
      <span
        aria-hidden="true"
        className="absolute top-3 right-4 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50"
      >
        ▲ start
      </span>
      {/* dashed magenta path along the left edge */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[6px] border-l-2 border-dashed border-primary"
      />

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 mb-2">
        Reality-check · 3 min
      </p>
      <h2 className="font-display text-2xl leading-[1.15] text-ink mb-3">
        Find your most realistic route into {roleName}.
      </h2>
      <ul className="space-y-1.5 mb-5 text-sm text-ink/85">
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-primary flex-shrink-0 mt-0.5">→</span>
          <span>the most realistic route for your situation</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-primary flex-shrink-0 mt-0.5">→</span>
          <span>the main barriers you'll need to solve</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-primary flex-shrink-0 mt-0.5">→</span>
          <span>the training route to be careful with</span>
        </li>
        <li className="flex gap-2 items-start leading-snug">
          <span className="text-primary flex-shrink-0 mt-0.5">→</span>
          <span>your next three actions</span>
        </li>
      </ul>
      <p className="text-xs text-ink/60 mb-5">
        No account needed. You can save the result afterwards.
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <Link
          to={target}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-5 py-2.5 rounded-md border-2 border-ink hover:bg-primary/90 transition-colors"
        >
          Check my route
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href="#about-this-role"
          className="font-mono text-[11px] uppercase tracking-wider text-ink/60 underline underline-offset-4 hover:text-ink"
        >
          Not ready? Explore the role
        </a>
      </div>
    </section>
  );
};
