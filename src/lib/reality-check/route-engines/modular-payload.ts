// Shared builder for the route-comparison payload consumed by
// ModularResultView. All three reviewed modular role adapters
// (electrician, plumber, hvac-engineer) feed their engine output through
// this so the four modular statuses are handled consistently and cannot
// masquerade as normal route recommendations.
//
// Runtime-neutral: no React, no browser/Deno globals. The Deno edge
// function ships a mirror at supabase/functions/reality-check/_modular_payload.ts.

import type {
  ModularMissingInformationItem,
  ModularRealityCheckPayload,
  ModularRouteCard,
  ModularRouteCardKind,
} from "../types";

/** Minimal shape shared by every modular engine output. */
export interface ModularEngineOutputShape<RouteId extends string> {
  status:
    | "route_recommended"
    | "qualification_verification_required"
    | "bridging_required"
    | "insufficient_information";
  recommendedRouteId: RouteId | null;
  alternativeRouteIds: RouteId[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  missingSignals: string[];
  routeEvaluations: {
    id: RouteId;
    displayTitle: string;
    eligible: boolean;
    affordability: { affordable: boolean; notes: string[] };
    blockersAndChecks: string[];
    immediateAction: string;
  }[];
}

/** Role-specific copy and mappings that vary between roles. */
export interface ModularPayloadFlavor<RouteId extends string> {
  /** Human labels for the questionnaire questions used for missing-info edit links. */
  questionLabels: Record<string, string>;
  /** Rough timing caveat per route. */
  timeCaveats: Partial<Record<RouteId, string>>;
  /** Rough cost caveat per route (when affordable). */
  costCaveats: Partial<Record<RouteId, string>>;
  /** Delivery-pattern caveat per route (e.g. day-release, self-managed). */
  patternCaveats: Partial<Record<RouteId, string>>;
  /** Route-to-be-careful-with caution card, used only for route_recommended. */
  cautionCard: {
    title: string;
    fit: string;
    constraint: string;
    checks: string[];
    nextAction: string;
  };
  /** Short "why this may fit" line for a recommended route. */
  fitCopyRecommended: (opts: { affordable: boolean }) => string;
  /** Short "why this may fit" line for a backup route. */
  fitCopyBackup: (opts: { affordable: boolean }) => string;
  /** Copy for investigate-after-check cards (verification status). */
  investigateAfterCheckFit: string;
  /** Copy for may-open-later cards (bridging status). */
  mayOpenLaterFit: string;
}

const buildRouteCardFromEval = <RouteId extends string>(
  ev: ModularEngineOutputShape<RouteId>["routeEvaluations"][number],
  kind: ModularRouteCardKind,
  flavor: ModularPayloadFlavor<RouteId>,
  fitCopy: string,
): ModularRouteCard => {
  const affordable = ev.affordability.affordable;
  return {
    kind,
    title: ev.displayTitle,
    fit: fitCopy,
    constraint:
      ev.blockersAndChecks[0] ??
      "Confirm entry requirements with the specific provider or employer before committing.",
    checks: ev.blockersAndChecks.slice(0, 3),
    timeCaveat: flavor.timeCaveats[ev.id],
    costCaveat: affordable
      ? flavor.costCaveats[ev.id]
      : "May exceed your stated training budget — confirm current fees with the provider before committing.",
    patternCaveat: flavor.patternCaveats[ev.id],
    nextAction: ev.immediateAction,
    affordable,
  };
};

const HEADLINES = {
  route_recommended:
    "At least one training route appears structurally suitable from your answers. Local availability of specific employers and courses needs checking separately.",
  qualification_verification_required:
    "Your existing qualification needs formal verification before any route can be confirmed. Verification is a bridging step, not a training route.",
  bridging_required:
    "None of the standard training routes are directly open from your current situation — a bridging step is needed first.",
  insufficient_information:
    "We need a few more answers before we can compare training routes for you.",
} as const;

export const buildModularPayload = <RouteId extends string>(
  out: ModularEngineOutputShape<RouteId>,
  flavor: ModularPayloadFlavor<RouteId>,
): ModularRealityCheckPayload => {
  const status = out.status;
  const headline = HEADLINES[status];

  if (status === "insufficient_information") {
    const missingInformation: ModularMissingInformationItem[] = out.missingSignals.map(
      (id) => ({
        questionId: id,
        label: flavor.questionLabels[id] ?? id,
      }),
    );
    return {
      status,
      headline,
      routes: [],
      checksBeforeCommitting: out.blockersAndChecks,
      missingInformation,
    };
  }

  if (status === "qualification_verification_required") {
    // No confirmed routes — only "investigate after verification" cards.
    // Surface the standard eligible-looking routes as investigate cards
    // so the user can see the route landscape, but never as recommended.
    const investigateRoutes: ModularRouteCard[] = out.routeEvaluations
      .filter((r) => r.eligible)
      .map((r) =>
        buildRouteCardFromEval(r, "investigate_after_check", flavor, flavor.investigateAfterCheckFit),
      );
    return {
      status,
      headline,
      routes: investigateRoutes,
      checksBeforeCommitting: out.blockersAndChecks,
    };
  }

  if (status === "bridging_required") {
    // Show may-open-later cards for routes that would be eligible after
    // bridging, if the engine surfaces any. Otherwise no route cards.
    const mayOpenLater: ModularRouteCard[] = out.routeEvaluations
      .filter((r) => r.eligible)
      .map((r) => buildRouteCardFromEval(r, "may_open_later", flavor, flavor.mayOpenLaterFit));
    return {
      status,
      headline,
      routes: mayOpenLater,
      checksBeforeCommitting: out.blockersAndChecks,
    };
  }

  // route_recommended -------------------------------------------------------
  const routes: ModularRouteCard[] = [];
  if (out.recommendedRouteId) {
    const best = out.routeEvaluations.find((r) => r.id === out.recommendedRouteId)!;
    routes.push(
      buildRouteCardFromEval(
        best,
        "recommended",
        flavor,
        flavor.fitCopyRecommended({ affordable: best.affordability.affordable }),
      ),
    );
  }
  for (const altId of out.alternativeRouteIds) {
    const alt = out.routeEvaluations.find((r) => r.id === altId);
    if (!alt) continue;
    routes.push(
      buildRouteCardFromEval(
        alt,
        "backup",
        flavor,
        flavor.fitCopyBackup({ affordable: alt.affordability.affordable }),
      ),
    );
  }
  // Always include the caution card so the "route to be careful with"
  // guidance never disappears for a reviewed role.
  routes.push({
    kind: "caution",
    title: flavor.cautionCard.title,
    fit: flavor.cautionCard.fit,
    constraint: flavor.cautionCard.constraint,
    checks: flavor.cautionCard.checks,
    nextAction: flavor.cautionCard.nextAction,
  });

  return {
    status,
    headline,
    routes,
    checksBeforeCommitting: out.blockersAndChecks,
  };
};
