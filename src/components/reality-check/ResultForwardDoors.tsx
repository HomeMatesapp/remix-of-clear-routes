// Result forward doors — Increment 1.
//
// A decision-support block shown after the result content in live mode.
// Rules:
//   - insufficient_information renders nothing (the user should complete
//     answers via the existing missing-information affordances instead).
//   - "Build My Route" is offered only when a route is actually recommended.
//   - "Reassess later" is a CTA plus analytics event ONLY. There is no
//     reassessment persistence model yet (Increment 4) and this component
//     must not pretend otherwise.
// No route-engine logic is read or changed here; the component consumes the
// already-computed payload status.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Scale, Map, RefreshCw } from "lucide-react";
import { trackEvent } from "@/lib/posthog";
import type { ModularRealityCheckPayload, RoleContext } from "@/lib/reality-check/types";

export interface ResultForwardDoorsProps {
  role: RoleContext;
  status: ModularRealityCheckPayload["status"];
  hasRoutes: boolean;
  recommendedRouteTitle?: string;
}

const scrollToAnchor = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof el.scrollIntoView === "function") {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  if (typeof (el as HTMLElement).focus === "function") {
    (el as HTMLElement).focus({ preventScroll: true });
  }
};

const DoorShell = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <article className="bg-white border-2 border-ink rounded-[10px] p-5 flex flex-col gap-3 h-full">
    <div className="flex items-center gap-2">
      <span className="text-path" aria-hidden="true">
        {icon}
      </span>
      <h3 className="font-display font-bold text-ink text-[16px] leading-tight">{title}</h3>
    </div>
    {children}
  </article>
);

const doorLinkClass =
  "mt-auto inline-flex min-h-11 items-center gap-1 self-start px-1 -mx-1 font-mono text-[12.5px] text-path underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path rounded";

export function ResultForwardDoors({
  role,
  status,
  hasRoutes,
  recommendedRouteTitle,
}: ResultForwardDoorsProps) {
  const [reassessNoted, setReassessNoted] = useState(false);

  if (status === "insufficient_information") return null;

  // Privacy-lean event properties: route titles can imply background
  // (education, transfer status), so only a boolean leaves the client.
  const baseProps = {
    role_slug: role.role_slug,
    status,
    has_recommended_route: Boolean(recommendedRouteTitle),
  };

  const trackDoor = (door: string) => {
    trackEvent("result_forward_door_clicked", { ...baseProps, door });
  };

  const showBuild = status === "route_recommended";
  const showCompare = hasRoutes;

  return (
    <section
      aria-labelledby="forward-doors-heading"
      className="bg-white border-2 border-ink rounded-[10px] p-5 sm:p-6"
    >
      <h2
        id="forward-doors-heading"
        className="font-display font-bold text-ink text-[18px] leading-tight mb-4"
      >
        Where to go from here
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DoorShell icon={<Bookmark className="h-4 w-4" />} title="Save this result">
          <p className="text-[13.5px] text-ink leading-snug">
            {showBuild
              ? "Save this result so you can compare routes, build your plan, and reassess when your grades, budget, timeline, or work experience changes."
              : "Save this result so you can come back to it and reassess when your grades, budget, timeline, or work experience changes."}
          </p>
          <button
            type="button"
            className={doorLinkClass}
            onClick={() => {
              trackDoor("save");
              scrollToAnchor("save-route-check");
            }}
          >
            Go to save
          </button>
        </DoorShell>

        {showCompare && (
          <DoorShell icon={<Scale className="h-4 w-4" />} title="Compare routes">
            <p className="text-[13.5px] text-ink leading-snug">
              Review your route cards side by side and compare the main
              trade-offs before choosing anything.
            </p>
            <button
              type="button"
              className={doorLinkClass}
              onClick={() => {
                trackDoor("compare");
                scrollToAnchor("route-comparison");
              }}
            >
              Review your route cards
            </button>
          </DoorShell>
        )}

        {showBuild && (
          <DoorShell icon={<Map className="h-4 w-4" />} title="Build My Route">
            <p className="text-[13.5px] text-ink leading-snug">
              Turn this result into a practical action plan. Works best after
              you save this result.
            </p>
            <Link to="/my-route" className={doorLinkClass} onClick={() => trackDoor("build")}>
              Open My Route
            </Link>
          </DoorShell>
        )}

        <DoorShell icon={<RefreshCw className="h-4 w-4" />} title="Reassess later">
          {reassessNoted ? (
            <p className="text-[13.5px] text-ink leading-snug">
              Noted. When something changes — grades, budget, timeline, work
              experience, or applications — run this check again and compare
              your results.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] text-ink leading-snug">
                Come back when something changes — such as grades, budget,
                timeline, work experience, or applications — and update your
                route.
              </p>
              <button
                type="button"
                className={doorLinkClass}
                onClick={() => {
                  trackDoor("reassess");
                  trackEvent("reassess_intent_clicked", baseProps);
                  setReassessNoted(true);
                }}
              >
                I'll reassess later
              </button>
            </>
          )}
        </DoorShell>
      </div>
    </section>
  );
}
