// Police Officer adapter — deterministic engine → RealityCheckResult.
//
// Verification-required payloads are built directly here so we can:
//   - render the rejoiner path as `investigate_after_check` primary (with
//     no route card fabricated for international qualifications)
//   - keep `qualification_verification_required` free of `recommended` /
//     `backup` card kinds (parity with Registered Nurse)
//   - keep `bridging_required` free of `recommended` / `backup` card kinds
//
// England/Wales scope note is appended to every non-insufficient result via
// `checksBeforeCommitting` so it always appears in the result methodology.

import type {
  ModularRealityCheckPayload,
  ModularRouteCard,
  RealityCheckResult,
} from "../types";
import { buildModularPayload } from "./modular-payload";
import {
  ROUTE_TITLES,
  runPoliceOfficerEngine,
  type PoliceOfficerEngineInput,
  type PoliceOfficerEngineOutput,
  type PoliceOfficerRouteEvaluation,
  type PoliceOfficerRouteId,
} from "./police-officer";
import { policeOfficerFlavor } from "./police-officer-flavor";

export const ENGLAND_WALES_SCOPE_NOTE =
  "This checker is for police constable routes in England and Wales. Police Scotland and PSNI have separate recruitment routes and are out of scope for v1. Detective and specialist-entry routes are also out of scope for v1.";

const readinessForStatus = (
  status: PoliceOfficerEngineOutput["status"],
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

const cardForEvaluation = (
  ev: PoliceOfficerRouteEvaluation,
  kind: ModularRouteCard["kind"],
  fit: string,
): ModularRouteCard => ({
  kind,
  title: ev.displayTitle,
  fit,
  constraint:
    ev.blockersAndChecks[0] ??
    "Confirm eligibility criteria with the recruiting force before applying.",
  checks: ev.blockersAndChecks.slice(0, 3),
  timeCaveat: policeOfficerFlavor.timeCaveats[ev.id],
  costCaveat: policeOfficerFlavor.costCaveats[ev.id],
  patternCaveat: policeOfficerFlavor.patternCaveats[ev.id],
  nextAction: ev.immediateAction,
  affordable: ev.affordability.affordable,
});

const buildVerificationPayload = (
  out: PoliceOfficerEngineOutput,
): ModularRealityCheckPayload => {
  const routes: ModularRouteCard[] = [];

  // International verification: NO route card fabricated. Equivalence lives
  // in checksBeforeCommitting.
  if (!out.isInternationalVerification && out.verificationPrimaryRouteId) {
    const primary = out.routeEvaluations.find(
      (r) => r.id === out.verificationPrimaryRouteId,
    );
    if (primary) {
      routes.push(
        cardForEvaluation(
          primary,
          "investigate_after_check",
          policeOfficerFlavor.investigateAfterCheckFit,
        ),
      );
    }
  }

  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (!ev) continue;
    routes.push(
      cardForEvaluation(
        ev,
        "may_open_later",
        policeOfficerFlavor.mayOpenLaterFit,
      ),
    );
  }

  return {
    status: "qualification_verification_required",
    headline: out.isInternationalVerification
      ? "Your qualification needs a formal equivalence check before any UK police constable route can be compared. Equivalence is a check, not a training route."
      : "A force-specific check is needed before a UK police constable route can be confirmed. Verification is a step, not a training route.",
    routes,
    checksBeforeCommitting: [
      ...out.blockersAndChecks,
      ENGLAND_WALES_SCOPE_NOTE,
    ],
  };
};

const buildModularForPolice = (
  out: PoliceOfficerEngineOutput,
): ModularRealityCheckPayload => {
  if (out.status === "qualification_verification_required") {
    return buildVerificationPayload(out);
  }
  const base = buildModularPayload<PoliceOfficerRouteId>(
    out,
    policeOfficerFlavor,
  );
  if (out.status === "insufficient_information") return base;
  return {
    ...base,
    checksBeforeCommitting: [
      ...base.checksBeforeCommitting,
      ENGLAND_WALES_SCOPE_NOTE,
    ],
  };
};

const bestRouteForOutcome = (
  out: PoliceOfficerEngineOutput,
): RealityCheckResult["bestRoute"] => {
  if (out.status === "route_recommended" && out.recommendedRouteId) {
    const best = out.routeEvaluations.find(
      (r) => r.id === out.recommendedRouteId,
    )!;
    const whyThisFits: string[] = [
      "This route appears structurally relevant to your situation — it is not a promise of a police constable role.",
    ];
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
        "This appears to be the strongest structural route from your answers. Final eligibility is decided by the recruiting force during recruitment.",
      whyThisFits,
      estimatedTime:
        policeOfficerFlavor.timeCaveats[best.id] ?? "Depends on the force",
      likelyCost:
        policeOfficerFlavor.costCaveats[best.id] ??
        "Confirm current costs with the force or provider before committing",
      mainDifficulty:
        best.blockersAndChecks[0] ??
        "Confirm eligibility criteria with the recruiting force before applying.",
      confidence: "medium",
    };
  }
  const title =
    out.status === "qualification_verification_required"
      ? "A formal check is needed before a UK police constable route can be confirmed"
      : out.status === "bridging_required"
        ? "A bridging step is needed before the standard police constable routes open"
        : "We need a few more answers before comparing police constable routes";
  return {
    title,
    summary:
      out.status === "qualification_verification_required"
        ? "The recruiting force (or UK ENIC for qualification equivalence) is the authority for this check. The step below is the next concrete action — it is not a training route in itself."
        : out.status === "bridging_required"
          ? "None of the standard police constable routes are directly open from your current situation. The step below is the bridging action, not a route."
          : "Some critical answers are missing. Complete them and we'll compare routes for you.",
    whyThisFits: [],
    estimatedTime: "Depends on the outcome of the step below",
    likelyCost: "Depends on the outcome of the step below",
    mainDifficulty: out.blockersAndChecks[0] ?? "",
    confidence: "low",
  };
};

const backupRouteForOutcome = (
  out: PoliceOfficerEngineOutput,
): RealityCheckResult["backupRoute"] => {
  const altId: PoliceOfficerRouteId | undefined = out.alternativeRouteIds[0];
  if (altId) {
    const alt = out.routeEvaluations.find((r) => r.id === altId)!;
    return {
      title: alt.displayTitle,
      summary:
        "A second structurally relevant route from your answers. Compare it against the recommended route and confirm the force is running it this cycle.",
      tradeOff:
        "Different timeline and delivery model — see the caveats and blockers notes.",
    };
  }
  return {
    title: "No secondary route from your current answers",
    summary: "Only one route was structurally relevant from what you told us.",
    tradeOff: "",
  };
};

const routeToAvoidFor = (): RealityCheckResult["routeToAvoid"] => ({
  title: "Applying without checking force-specific criteria",
  whyRisky:
    "Forces publish their own eligibility criteria, cohort dates and route availability. Applying to whichever force opens recruitment first — without checking their criteria — is the most common wasted application.",
  whenItMightWork:
    "Rarely. Even a strong candidate should read the recruiting force's own eligibility criteria and cohort availability before submitting an application.",
});

const firstMovesFor = (out: PoliceOfficerEngineOutput): string[] => {
  const moves = [out.immediateAction];
  if (out.status === "route_recommended" && out.alternativeRouteIds[0]) {
    const alt = out.routeEvaluations.find(
      (r) => r.id === out.alternativeRouteIds[0],
    )!;
    moves.push(`Compare the alternative route: ${alt.immediateAction}`);
  }
  moves.push(
    "Check the recruiting force's own eligibility criteria and current cohort availability before applying.",
  );
  return moves.slice(0, 3);
};

export const buildPoliceOfficerResult = (
  input: PoliceOfficerEngineInput,
  _answers?: unknown,
): RealityCheckResult => {
  void _answers;
  const out = runPoliceOfficerEngine(input);
  const readiness = readinessForStatus(out.status);
  const reason =
    out.status === "route_recommended"
      ? "Your answers point to at least one structurally relevant UK police constable route. Final eligibility is decided by the recruiting force."
      : out.status === "qualification_verification_required"
        ? out.isInternationalVerification
          ? "A qualification-equivalence check is needed before a UK police constable route can be compared."
          : "A force-specific check is needed before a UK police constable route can be confirmed."
        : out.status === "bridging_required"
          ? "None of the standard UK police constable routes are directly open from your current situation — a bridging step is needed first."
          : "We need a few more answers before we can compare police constable routes.";

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
    modular: buildModularForPolice(out),
  };
};

export { runPoliceOfficerEngine };
export type { PoliceOfficerEngineOutput };
