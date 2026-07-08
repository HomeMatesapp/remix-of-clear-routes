// Deno mirror of src/lib/reality-check/route-engines/modular-payload.ts.
// Behaviour must stay in lockstep — modify both files together.

export type ModularStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export type ModularRouteCardKind =
  | "recommended"
  | "backup"
  | "caution"
  | "investigate_after_check"
  | "may_open_later";

export interface ModularRouteCard {
  kind: ModularRouteCardKind;
  title: string;
  fit: string;
  constraint: string;
  checks: string[];
  timeCaveat?: string;
  costCaveat?: string;
  patternCaveat?: string;
  nextAction: string;
  affordable?: boolean;
}

export interface ModularMissingInformationItem {
  label: string;
  questionId: string;
}

export interface ModularPayload {
  status: ModularStatus;
  headline: string;
  routes: ModularRouteCard[];
  checksBeforeCommitting: string[];
  missingInformation?: ModularMissingInformationItem[];
}

/** Legacy alias — retained so older Deno mirrors keep compiling. */
export type ModularRealityCheckPayload = ModularPayload;

export interface ModularEngineOutputShape<RouteId extends string> {
  status: ModularStatus;
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

export interface ModularPayloadFlavor<RouteId extends string> {
  questionLabels: Record<string, string>;
  timeCaveats: Partial<Record<RouteId, string>>;
  costCaveats: Partial<Record<RouteId, string>>;
  patternCaveats: Partial<Record<RouteId, string>>;
  cautionCard: {
    title: string;
    fit: string;
    constraint: string;
    checks: string[];
    nextAction: string;
  };
  fitCopyRecommended: (opts: { affordable: boolean }) => string;
  fitCopyBackup: (opts: { affordable: boolean }) => string;
  investigateAfterCheckFit: string;
  mayOpenLaterFit: string;
}

const HEADLINES: Record<ModularStatus, string> = {
  route_recommended:
    "At least one training route appears structurally suitable from your answers. Local availability of specific employers and courses needs checking separately.",
  qualification_verification_required:
    "Your existing qualification needs formal verification before any route can be confirmed. Verification is a bridging step, not a training route.",
  bridging_required:
    "None of the standard training routes are directly open from your current situation — a bridging step is needed first.",
  insufficient_information:
    "We need a few more answers before we can compare training routes for you.",
};

const buildCard = <RouteId extends string>(
  ev: ModularEngineOutputShape<RouteId>["routeEvaluations"][number],
  kind: ModularRouteCardKind,
  flavor: ModularPayloadFlavor<RouteId>,
  fit: string,
): ModularRouteCard => {
  const affordable = ev.affordability.affordable;
  return {
    kind,
    title: ev.displayTitle,
    fit,
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

export const buildModularPayload = <RouteId extends string>(
  out: ModularEngineOutputShape<RouteId>,
  flavor: ModularPayloadFlavor<RouteId>,
): ModularPayload => {
  const status = out.status;
  const headline = HEADLINES[status];
  if (status === "insufficient_information") {
    return {
      status,
      headline,
      routes: [],
      checksBeforeCommitting: out.blockersAndChecks,
      missingInformation: out.missingSignals.map((id) => ({
        questionId: id,
        label: flavor.questionLabels[id] ?? id,
      })),
    };
  }
  if (status === "qualification_verification_required") {
    return {
      status,
      headline,
      routes: out.routeEvaluations
        .filter((r) => r.eligible)
        .map((r) => buildCard(r, "investigate_after_check", flavor, flavor.investigateAfterCheckFit)),
      checksBeforeCommitting: out.blockersAndChecks,
    };
  }
  if (status === "bridging_required") {
    return {
      status,
      headline,
      routes: out.routeEvaluations
        .filter((r) => r.eligible)
        .map((r) => buildCard(r, "may_open_later", flavor, flavor.mayOpenLaterFit)),
      checksBeforeCommitting: out.blockersAndChecks,
    };
  }
  const routes: ModularRouteCard[] = [];
  if (out.recommendedRouteId) {
    const best = out.routeEvaluations.find((r) => r.id === out.recommendedRouteId)!;
    routes.push(
      buildCard(best, "recommended", flavor, flavor.fitCopyRecommended({ affordable: best.affordability.affordable })),
    );
  }
  for (const id of out.alternativeRouteIds) {
    const alt = out.routeEvaluations.find((r) => r.id === id);
    if (!alt) continue;
    routes.push(
      buildCard(alt, "backup", flavor, flavor.fitCopyBackup({ affordable: alt.affordability.affordable })),
    );
  }
  routes.push({
    kind: "caution",
    title: flavor.cautionCard.title,
    fit: flavor.cautionCard.fit,
    constraint: flavor.cautionCard.constraint,
    checks: flavor.cautionCard.checks,
    nextAction: flavor.cautionCard.nextAction,
  });
  return { status, headline, routes, checksBeforeCommitting: out.blockersAndChecks };
};
