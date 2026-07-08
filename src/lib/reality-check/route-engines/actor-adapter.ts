// Actor adapter — deterministic engine → RealityCheckResult.
//
// Actor is an evidence-and-risk checker, not an eligibility checker. Care
// is taken so no result copy promises auditions, agents, paid work or course
// outcomes.

import type {
  ModularRealityCheckPayload,
  ModularRouteCard,
  RealityCheckResult,
} from "../types";
import { buildModularPayload } from "./modular-payload";
import {
  ROUTE_TITLES,
  runActorEngine,
  type ActorEngineInput,
  type ActorEngineOutput,
  type ActorRouteEvaluation,
  type ActorRouteId,
} from "./actor";
import {
  actorFlavor,
  AGENT_CAUTION_CARD,
  COURSE_CAUTION_CARD,
} from "./actor-flavor";

export const ACTOR_SCOPE_NOTE =
  "Acting is not statutorily regulated. There is no promised route to paid work. Cautions on paid courses, agent terms, casting-platform fees and unpaid work always apply where relevant.";

const readinessForStatus = (
  status: ActorEngineOutput["status"],
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
    case "ready_now":      return "Realistic but hard";
    case "nearly_ready":   return "Realistic but hard";
    case "needs_bridging": return "Long shot";
    case "high_risk_now":  return "Probably not for you";
  }
};

const cardForEvaluation = (
  ev: ActorRouteEvaluation,
  kind: ModularRouteCard["kind"],
  fit: string,
): ModularRouteCard => ({
  kind,
  title: ev.displayTitle,
  fit,
  constraint:
    ev.blockersAndChecks[0] ??
    "Check evidence, terms and outcomes independently before committing.",
  checks: ev.blockersAndChecks.slice(0, 3),
  timeCaveat: actorFlavor.timeCaveats[ev.id],
  costCaveat: actorFlavor.costCaveats[ev.id],
  patternCaveat: actorFlavor.patternCaveats[ev.id],
  nextAction: ev.immediateAction,
  affordable: ev.affordability.affordable,
});

/** Build cautionary cards that the flavor's generic caution card cannot express
 *  (course caution + agent/casting caution). Actor always renders the course
 *  caution when triggered, and the agent caution when an agent-shaped route
 *  is recommended or a casting-platform check is relevant. */
const extraCautionCards = (out: ActorEngineOutput): ModularRouteCard[] => {
  const cards: ModularRouteCard[] = [];
  if (out.showCourseCaution) {
    cards.push({
      kind: "caution",
      title: COURSE_CAUTION_CARD.title,
      fit: COURSE_CAUTION_CARD.fit,
      constraint: COURSE_CAUTION_CARD.constraint,
      checks: [...COURSE_CAUTION_CARD.checks],
      nextAction: COURSE_CAUTION_CARD.nextAction,
    });
  }
  const agentRecommended =
    out.recommendedRouteId === "agent_and_casting_profile_route" ||
    out.alternativeRouteIds.includes("agent_and_casting_profile_route");
  if (agentRecommended) {
    cards.push({
      kind: "caution",
      title: AGENT_CAUTION_CARD.title,
      fit: AGENT_CAUTION_CARD.fit,
      constraint: AGENT_CAUTION_CARD.constraint,
      checks: [...AGENT_CAUTION_CARD.checks],
      nextAction: AGENT_CAUTION_CARD.nextAction,
    });
  }
  return cards;
};

const buildVerificationPayload = (
  out: ActorEngineOutput,
): ModularRealityCheckPayload => {
  const routes: ModularRouteCard[] = [];
  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (!ev) continue;
    routes.push(cardForEvaluation(ev, "may_open_later", actorFlavor.mayOpenLaterFit));
  }
  routes.push(...extraCautionCards(out));
  return {
    status: "qualification_verification_required",
    headline:
      "A university drama degree or formal training route needs a UK equivalence check on your international qualification first. Equivalence is a check, not a training route.",
    routes,
    checksBeforeCommitting: [...out.blockersAndChecks, ACTOR_SCOPE_NOTE],
  };
};

const buildModularForActor = (
  out: ActorEngineOutput,
): ModularRealityCheckPayload => {
  if (out.status === "qualification_verification_required") {
    return buildVerificationPayload(out);
  }
  const base = buildModularPayload<ActorRouteId>(out, actorFlavor);
  if (out.status === "insufficient_information") return base;
  // Append extra caution cards (course/agent). The flavor already added its
  // default course-caution card on route_recommended — drop that duplicate.
  const withoutDefaultCaution =
    out.status === "route_recommended"
      ? base.routes.filter((r) => r.kind !== "caution")
      : base.routes;
  // may_open_later cards for degree fallback
  const mayOpen: ModularRouteCard[] = [];
  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (!ev) continue;
    mayOpen.push(cardForEvaluation(ev, "may_open_later", actorFlavor.mayOpenLaterFit));
  }
  return {
    ...base,
    routes: [...withoutDefaultCaution, ...mayOpen, ...extraCautionCards(out)],
    checksBeforeCommitting: [...base.checksBeforeCommitting, ACTOR_SCOPE_NOTE],
  };
};

const bestRouteForOutcome = (
  out: ActorEngineOutput,
): RealityCheckResult["bestRoute"] => {
  if (out.status === "route_recommended" && out.recommendedRouteId) {
    const best = out.routeEvaluations.find(
      (r) => r.id === out.recommendedRouteId,
    )!;
    const whyThisFits: string[] = [
      "This route appears structurally relevant to your answers. It does not promise auditions, representation or paid acting work.",
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
        "This appears to be the strongest evidence-building step from your answers. Acting outcomes are not decided by any single route.",
      whyThisFits,
      estimatedTime: actorFlavor.timeCaveats[best.id] ?? "Depends on the provider",
      likelyCost:
        actorFlavor.costCaveats[best.id] ??
        "Confirm current fees and terms with the provider before committing",
      mainDifficulty:
        best.blockersAndChecks[0] ??
        "Check evidence, terms and outcomes independently before committing.",
      confidence: "medium",
    };
  }
  const title =
    out.status === "qualification_verification_required"
      ? "A qualification-equivalence check is needed before a formal training / degree route can be compared"
      : out.status === "bridging_required"
        ? "Foundations first — a bridging step is needed before naming a primary route"
        : "We need a few more answers before comparing evidence routes";
  return {
    title,
    summary:
      out.status === "qualification_verification_required"
        ? "UK ENIC is the authority for the equivalence check. The step below is the next concrete action — it is not a route in itself."
        : out.status === "bridging_required"
          ? "Right now the strongest next step is building foundations rather than pursuing a specific route as the primary outcome."
          : "Some critical answers are missing. Complete them and we'll compare routes for you.",
    whyThisFits: [],
    estimatedTime: "Depends on the outcome of the step below",
    likelyCost: "Depends on the outcome of the step below",
    mainDifficulty: out.blockersAndChecks[0] ?? "",
    confidence: "low",
  };
};

const backupRouteForOutcome = (
  out: ActorEngineOutput,
): RealityCheckResult["backupRoute"] => {
  const altId: ActorRouteId | undefined = out.alternativeRouteIds[0];
  if (altId) {
    const alt = out.routeEvaluations.find((r) => r.id === altId)!;
    return {
      title: alt.displayTitle,
      summary:
        "A second structurally relevant evidence-building route from your answers. It also does not promise paid acting work.",
      tradeOff:
        "Different timeline, cost and evidence value — see the caveats and checks on the card.",
    };
  }
  return {
    title: "No secondary route from your current answers",
    summary: "Only one evidence-building route was structurally relevant from what you told us.",
    tradeOff: "",
  };
};

const routeToAvoidFor = (): RealityCheckResult["routeToAvoid"] => ({
  title: "Paying for an unaccredited acting course expecting it to lead to paid work",
  whyRisky:
    "Paid acting courses do not promise paid acting work afterwards. Unaccredited providers vary widely in tutor credits, graduate outcomes and refund terms.",
  whenItMightWork:
    "When you've independently checked accreditation, named tutor credits, recent graduate outcomes and refund/cancellation terms — and treat the course as evidence-building only, not as a route to work.",
});

const firstMovesFor = (out: ActorEngineOutput): string[] => {
  const moves = [out.immediateAction];
  if (out.status === "route_recommended" && out.alternativeRouteIds[0]) {
    const alt = out.routeEvaluations.find(
      (r) => r.id === out.alternativeRouteIds[0],
    )!;
    moves.push(`Compare the alternative route: ${alt.immediateAction}`);
  }
  moves.push(
    "Cross-check National Careers Service and Equity guidance before committing money or signing anything.",
  );
  return moves.slice(0, 3);
};

export const buildActorResult = (
  input: ActorEngineInput,
  _answers?: unknown,
): RealityCheckResult => {
  void _answers;
  const out = runActorEngine(input);
  const readiness = readinessForStatus(out.status);
  const reason =
    out.status === "route_recommended"
      ? "Your answers point to at least one structurally relevant evidence-building route. No route promises paid acting work."
      : out.status === "qualification_verification_required"
        ? "A qualification-equivalence check is needed before a formal training or degree route can be compared."
        : out.status === "bridging_required"
          ? "Right now the strongest next step is building foundations rather than pursuing a specific route as the primary outcome."
          : "We need a few more answers before we can compare evidence routes.";

  const biggestBlocker =
    out.blockersAndChecks[0] ??
    "No single structural blocker stood out from what you told us — but check evidence, terms and outcomes independently before committing.";

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
    modular: buildModularForActor(out),
  };
};

export { runActorEngine };
export type { ActorEngineOutput };
