// Adapt the pure Software Engineer engine to the shared RealityCheckResult
// shape used across the app. Kept structurally identical to the trades
// adapters so the modular result view renders it without changes.

import type { RealityCheckAnswers, RealityCheckResult } from "../types";
import {
  ROUTE_TITLES,
  runSoftwareEngineerEngine,
  type SoftwareEngineerEngineInput,
  type SoftwareEngineerEngineOutput,
  type SoftwareEngineerRouteId,
} from "./software-engineer";
import { buildModularPayload } from "./modular-payload";
import { softwareEngineerFlavor } from "./software-engineer-flavor";

const readinessForStatus = (
  status: SoftwareEngineerEngineOutput["status"],
): RealityCheckResult["readiness"] => {
  switch (status) {
    case "route_recommended":
      return "ready_now";
    case "qualification_verification_required":
      return "needs_bridging";
    case "bridging_required":
      return "needs_bridging";
    case "insufficient_information":
      return "nearly_ready";
  }
};

const overallVerdictFor = (
  readiness: RealityCheckResult["readiness"],
): RealityCheckResult["overallVerdict"] => {
  switch (readiness) {
    case "ready_now":      return "Realistic";
    case "nearly_ready":   return "Realistic but hard";
    case "needs_bridging": return "Long shot";
    case "high_risk_now":  return "Probably not for you";
  }
};

const timeFor = (id: SoftwareEngineerRouteId): string =>
  softwareEngineerFlavor.timeCaveats[id] ?? "Depends on the provider";

const costFor = (id: SoftwareEngineerRouteId, affordable: boolean): string =>
  affordable
    ? softwareEngineerFlavor.costCaveats[id] ?? "Confirm current fees before committing"
    : "May exceed your stated budget — confirm current fees before committing";

const bestRouteForOutcome = (
  out: SoftwareEngineerEngineOutput,
): RealityCheckResult["bestRoute"] => {
  if (out.status === "route_recommended" && out.recommendedRouteId) {
    const best = out.routeEvaluations.find(
      (r) => r.id === out.recommendedRouteId,
    )!;
    const whyThisFits: string[] = [];
    whyThisFits.push(
      best.affordability.affordable
        ? "This route appears structurally suitable for you based on your answers."
        : "This route is structurally the strongest fit for you; note the affordability caveats below.",
    );
    if (out.alternativeRouteIds.length > 0) {
      whyThisFits.push(
        `Also worth comparing: ${out.alternativeRouteIds
          .map((id) => ROUTE_TITLES[id])
          .join("; ")}.`,
      );
    }
    return {
      title: best.displayTitle,
      summary:
        "This appears to be the strongest structural route from what you told us. Local availability of specific employers, cohorts and universities needs checking separately.",
      whyThisFits,
      estimatedTime: timeFor(best.id),
      likelyCost: costFor(best.id, best.affordability.affordable),
      mainDifficulty:
        best.blockersAndChecks[0] ??
        "Confirm entry requirements with the specific provider or employer",
      confidence: "medium",
    };
  }
  const title =
    out.status === "qualification_verification_required"
      ? "Verification of your existing qualification is needed first"
      : out.status === "bridging_required"
        ? "A bridging step is needed before the standard routes open"
        : "We need a few more answers before recommending a route";
  return {
    title,
    summary:
      out.status === "qualification_verification_required"
        ? "We can't safely place your existing qualification without a formal check. This isn't a training route in itself — it's the step that unlocks one."
        : out.status === "bridging_required"
          ? "None of the standard training routes are directly open from your current situation. The step below is the bridging action, not a route in itself."
          : "Some critical answers are missing. Complete them and we'll suggest a specific route.",
    whyThisFits: [],
    estimatedTime: "Depends on the outcome of the step below",
    likelyCost: "Depends on the outcome of the step below",
    mainDifficulty: out.blockersAndChecks[0] ?? "",
    confidence: "low",
  };
};

const backupRouteForOutcome = (
  out: SoftwareEngineerEngineOutput,
): RealityCheckResult["backupRoute"] => {
  const altId: SoftwareEngineerRouteId | undefined = out.alternativeRouteIds[0];
  if (altId) {
    const alt = out.routeEvaluations.find((r) => r.id === altId)!;
    return {
      title: alt.displayTitle,
      summary:
        "A second structurally viable route from your answers. Compare it against the recommended route before committing.",
      tradeOff: alt.affordability.affordable
        ? "Different timeline and delivery model — see the affordability and blockers notes."
        : "Structurally viable but likely exceeds your stated training budget.",
    };
  }
  return {
    title: "No secondary route from your current answers",
    summary: "Only one route was structurally viable from what you told us.",
    tradeOff: "",
  };
};

const routeToAvoidFor = (): RealityCheckResult["routeToAvoid"] => ({
  title: "A high-cost private bootcamp with weak evidence of outcomes",
  whyRisky:
    "Some private bootcamps market strong job outcomes without independent audit. Paying £8,000–£12,000+ for a course that does not lead to a first developer role is one of the most expensive wrong turns in this route family.",
  whenItMightWork:
    "Only when the provider publishes an independently audited outcomes methodology, clear refund terms and direct references from recent graduates.",
});

const firstMovesFor = (out: SoftwareEngineerEngineOutput): string[] => {
  const moves = [out.immediateAction];
  if (out.status === "route_recommended" && out.alternativeRouteIds[0]) {
    const alt = out.routeEvaluations.find(
      (r) => r.id === out.alternativeRouteIds[0],
    )!;
    moves.push(`Compare the alternative route: ${alt.immediateAction}`);
  }
  moves.push(
    "Come back and rerun your Reality-check when your situation changes (portfolio, learning hours, qualifications).",
  );
  return moves.slice(0, 3);
};

export const buildSoftwareEngineerResult = (
  input: SoftwareEngineerEngineInput,
  _answers: RealityCheckAnswers,
): RealityCheckResult => {
  const out = runSoftwareEngineerEngine(input);
  const readiness = readinessForStatus(out.status);
  const reason =
    out.status === "route_recommended"
      ? "Your answers point to at least one structurally suitable software-engineering route."
      : out.status === "qualification_verification_required"
        ? "Your existing qualification needs formal verification before we can place you on a route."
        : out.status === "bridging_required"
          ? "None of the standard routes are directly open from your current situation — a bridging step is needed first."
          : "We need a few more answers before we can suggest a specific route.";

  const biggestBlocker =
    out.blockersAndChecks[0] ??
    "No single structural blocker stood out from what you told us.";

  return {
    readiness,
    readinessReason: reason,
    biggestBlocker,
    immediateAction: out.immediateAction,
    overallVerdict: overallVerdictFor(readiness),
    bestRoute: bestRouteForOutcome(out),
    backupRoute: backupRouteForOutcome(out),
    routeToAvoid: routeToAvoidFor(),
    firstMoves: firstMovesFor(out),
    considerations: out.considerations.length ? out.considerations : undefined,
    modular: buildModularPayload<SoftwareEngineerRouteId>(
      out,
      softwareEngineerFlavor,
    ),
  };
};

export { runSoftwareEngineerEngine };
export type { SoftwareEngineerEngineOutput };
