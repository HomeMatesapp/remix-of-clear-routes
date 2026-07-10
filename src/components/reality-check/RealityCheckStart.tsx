// Reality Check start screen — Increment 1.
//
// Shown before question one for users with no existing draft, in-progress
// answers, or session result (see lib/reality-check/start-screen.ts).
// Purely presentational + analytics; it never touches questionnaire state.

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/posthog";

export interface RealityCheckStartProps {
  roleName: string;
  roleSlug: string;
  onStart: () => void;
}

const VALUE_POINTS = [
  "See routes that fit your current qualifications, budget, timeline, and work needs.",
  "Understand why a route looks realistic, risky, or blocked.",
  "Get practical next actions, not just a verdict.",
  "Save your result and reassess later if your situation changes.",
];

export function RealityCheckStart({ roleName, roleSlug, onStart }: RealityCheckStartProps) {
  const viewedTracked = useRef(false);

  useEffect(() => {
    if (viewedTracked.current) return;
    viewedTracked.current = true;
    trackEvent("reality_check_start_screen_viewed", { role_slug: roleSlug });
  }, [roleSlug]);

  const handleStart = () => {
    trackEvent("reality_check_start_clicked", { role_slug: roleSlug });
    onStart();
  };

  return (
    <section
      aria-label="Before you start the reality check"
      className="mt-8 bg-white border-2 border-ink rounded-[10px] p-6 sm:p-8"
    >
      <p className="font-mono text-[11.5px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
        Before you start
      </p>
      <h1 className="mt-2 font-display font-extrabold text-ink tracking-[-0.01em] leading-[1.1] text-[clamp(24px,4vw,34px)]">
        Check which routes look realistic for you.
      </h1>
      <p className="mt-4 text-[15px] text-ink leading-snug">
        Answer a few practical questions about your current situation. Clear
        Routes will show which routes into {roleName} appear realistic,
        risky, blocked, or worth checking further — with sources and next
        actions.
      </p>

      <ul className="mt-6 space-y-3">
        {VALUE_POINTS.map((point) => (
          <li key={point} className="flex gap-3 items-start text-[14.5px] text-ink leading-snug">
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-path text-path text-[12px] font-bold flex items-center justify-center mt-0.5"
            >
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13.5px] text-muted-foreground leading-snug border-t border-dashed border-[hsl(40_15%_82%)] pt-4">
        You do not need to know your route yet. Your result can change as
        your circumstances change. We use your answers to compare route fit,
        not to judge you.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleStart}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-3 rounded-md bg-ink text-white font-mono text-[13px] uppercase tracking-[0.1em] font-semibold hover:bg-path focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2"
        >
          Start Reality Check
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="mt-3 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground">
          About 3 to 5 minutes · Save and return any time
        </p>
      </div>
    </section>
  );
}
