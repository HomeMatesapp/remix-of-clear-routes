// Deno mirror of src/lib/reality-check/route-engines/actor.ts.
// Parity enforced by shared/reality-check/actor-cases.json.

import {
  actorFlavor,
  AGENT_CAUTION_CARD,
  COURSE_CAUTION_CARD,
  type ActorRouteId,
} from "./_actor_flavor.ts";
import type { ModularPayload, ModularRouteCard } from "./_modular_payload.ts";
import { buildModularPayload } from "./_modular_payload.ts";

type Status =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

interface Signals {
  performerScope: string | null;
  highestQualification: string | null;
  qualificationOrigin: string | null;
  trainingBackground: string | null;
  existingCredits: string | null;
  auditionMaterials: string[];
  representationStatus: string | null;
  routePriorities: string[];
  incomeExpectation: string | null;
  timeAvailability: string | null;
  budgetForTrainingOrMaterials: string | null;
  checksBeforeCommitting: string[];
}

interface RouteEval {
  id: ActorRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: { affordable: boolean; notes: string[] };
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface EngineOutput {
  status: Status;
  recommendedRouteId: ActorRouteId | null;
  alternativeRouteIds: ActorRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: RouteEval[];
  missingSignals: string[];
  mayOpenLaterRouteIds: ActorRouteId[];
  isInternationalVerification: boolean;
  showCourseCaution: boolean;
}

const TITLES: Record<ActorRouteId, string> = {
  formal_actor_training: "Formal actor training (accredited conservatoire / drama school)",
  university_drama_degree: "University drama degree",
  portfolio_audition_materials_route: "Build audition materials (headshot, showreel, casting profile)",
  credits_and_experience_route: "Build credits and experience (student, fringe, short-film work)",
  agent_and_casting_profile_route: "Explore representation and casting-profile route",
  adjacent_performance_income_route: "Adjacent paid performance work (voice, corporate role-play, workshops, presenting, background artist)",
};

const EVIDENCE: Record<ActorRouteId, string> = {
  formal_actor_training: "Accreditation (e.g. CDMT) is a quality-assurance signal, not proof of paid work afterwards.",
  university_drama_degree: "A drama degree provides structured training. It does not promise auditions or paid work.",
  portfolio_audition_materials_route: "Materials are evidence, not proof of paid work.",
  credits_and_experience_route: "Student, fringe and short-film credits build evidence. Check unpaid-work terms.",
  agent_and_casting_profile_route: "Signing with an agent does not promise auditions or income.",
  adjacent_performance_income_route: "Adjacent paid performance work is not an automatic stepping-stone into acting roles.",
};

const AFF: Record<ActorRouteId, string> = {
  formal_actor_training: "Accredited drama-school fees vary widely. Check the specific provider.",
  university_drama_degree: "UK undergraduate tuition is loan-funded via GOV.UK Student Finance.",
  portfolio_audition_materials_route: "Costs are typically modest but vary — headshots and showreel edits are the largest items.",
  credits_and_experience_route: "Usually low or no cost. Check unpaid-work terms.",
  agent_and_casting_profile_route: "Casting-platform subscriptions carry fees. Reputable agents do NOT charge sign-up fees.",
  adjacent_performance_income_route: "Paid work — usually no upfront cost. Confirm rates and terms.",
};

export const ACTOR_SCOPE_NOTE =
  "Acting is not statutorily regulated. There is no promised route to paid work. Cautions on paid courses, agent terms, casting-platform fees and unpaid work always apply where relevant.";

const LEVEL_3 = new Set([
  "a_level_or_level_3",
  "performing_arts_level_3",
  "bachelors_drama_or_acting",
  "bachelors_other",
  "masters_plus",
]);

const hasLevel3ForDegree = (s: Signals) =>
  s.highestQualification !== null && LEVEL_3.has(s.highestQualification);

const hasMeaningfulTime = (s: Signals) =>
  s.timeAvailability === "full_time" || s.timeAvailability === "part_time_flexible";

const has = (s: Signals, m: string) => s.auditionMaterials.includes(m);
const hasPriority = (s: Signals, p: string) => s.routePriorities.includes(p);

const hasHeadshotAndShowreel = (s: Signals) => has(s, "headshot") && has(s, "showreel");

const isFormal = (s: Signals) =>
  hasMeaningfulTime(s) &&
  (
    hasPriority(s, "formal_training") ||
    s.trainingBackground === "school_or_youth_drama" ||
    s.trainingBackground === "short_courses_or_workshops" ||
    s.trainingBackground === "private_acting_course" ||
    s.trainingBackground === "accredited_conservatoire_or_drama_school" ||
    s.trainingBackground === "university_drama_degree"
  );

const isDegree = (s: Signals) =>
  hasLevel3ForDegree(s) &&
  s.timeAvailability === "full_time" &&
  (hasPriority(s, "formal_training") || hasPriority(s, "stage_work"));

const isMaterials = (s: Signals) =>
  !has(s, "headshot") || !has(s, "showreel") || !has(s, "spotlight_or_equivalent_profile");

const isCredits = (s: Signals) =>
  s.existingCredits === "none" ||
  s.existingCredits === "student_or_amateur_only" ||
  s.existingCredits === "unpaid_short_or_student_films";

const isAgent = (s: Signals) =>
  (s.representationStatus === "no_agent" || s.representationStatus === "seeking_agent") &&
  (hasHeadshotAndShowreel(s) ||
    s.existingCredits === "some_paid_credits" ||
    s.existingCredits === "regular_paid_credits");

const isAdjacent = (s: Signals) =>
  s.incomeExpectation === "main_income_soon" || s.incomeExpectation === "unsure";

const baseScore = (id: ActorRouteId): number => {
  switch (id) {
    case "portfolio_audition_materials_route": return 88;
    case "credits_and_experience_route": return 86;
    case "agent_and_casting_profile_route": return 84;
    case "formal_actor_training": return 82;
    case "university_drama_degree": return 80;
    case "adjacent_performance_income_route": return 70;
  }
};

const priorityBonus = (id: ActorRouteId, s: Signals): number => {
  let b = 0;
  if (hasPriority(s, "formal_training")) {
    if (id === "formal_actor_training") b += 14;
    if (id === "university_drama_degree") b += 12;
  }
  if (hasPriority(s, "stage_work") && id === "university_drama_degree") b += 6;
  if (hasPriority(s, "agent_and_profile")) {
    if (id === "agent_and_casting_profile_route") b += 12;
    if (id === "portfolio_audition_materials_route") b += 6;
  }
  if (hasPriority(s, "build_credits") && id === "credits_and_experience_route") b += 10;
  if (hasPriority(s, "screen_work") && id === "credits_and_experience_route") b += 4;
  return b;
};

const blockers = (id: ActorRouteId): string[] => {
  switch (id) {
    case "formal_actor_training":
      return [
        "Paid acting courses vary widely in quality. Accreditation (e.g. CDMT) is a quality-assurance signal, not proof of paid work afterwards.",
        "Confirm the specific course's accreditation, tutor credits and graduate outcomes before committing.",
      ];
    case "university_drama_degree":
      return [
        "A drama degree does not promise auditions or paid work. Check staff credits, graduate outcomes and industry links.",
        "Confirm entry requirements and student-finance eligibility with the specific university.",
      ];
    case "portfolio_audition_materials_route":
      return [
        "Materials are evidence, not proof of paid work. Get a professional headshot and a short focused showreel before paying for casting-platform subscriptions.",
      ];
    case "credits_and_experience_route":
      return [
        "Check unpaid-work terms, travel, subsistence and safety arrangements before committing to any production. Equity provides guidance.",
      ];
    case "agent_and_casting_profile_route":
      return [
        "Signing with an agent does not promise auditions or income. Check contract terms, commission rates and notice periods. Reputable agents do not charge sign-up fees.",
        "Casting-platform subscriptions carry fees and do not promise castings.",
      ];
    case "adjacent_performance_income_route":
      return [
        "Voice, corporate role-play, workshops, presenting and background artist work are separate paid activities — they are not automatic stepping-stones into acting roles.",
      ];
  }
};

const immediate = (id: ActorRouteId): string => {
  switch (id) {
    case "formal_actor_training":
      return "Shortlist two accredited providers (e.g. from the CDMT recognised list), then confirm fees, funding options and graduate outcomes before applying.";
    case "university_drama_degree":
      return "Check UCAS entry requirements and Discover Uni graduate outcomes for two drama degrees before committing.";
    case "portfolio_audition_materials_route":
      return "Book a professional headshot and plan a short focused showreel (2–3 minutes). Add a casting profile only once headshot and showreel are ready.";
    case "credits_and_experience_route":
      return "Apply to student / fringe / short-film productions and check unpaid-work terms with Equity guidance before signing on.";
    case "agent_and_casting_profile_route":
      return "Research a shortlist of reputable agents (open submission windows) and check Equity guidance on contract terms before signing.";
    case "adjacent_performance_income_route":
      return "Look up rates and terms for adjacent paid performance work in your area and treat it as separate paid work.";
  }
};

const critical = (s: Signals): string[] => {
  const m: string[] = [];
  if (!s.performerScope) m.push("performer_scope");
  if (!s.highestQualification) m.push("highest_qualification");
  if (!s.qualificationOrigin) m.push("qualification_origin");
  if (!s.trainingBackground) m.push("training_background");
  if (!s.existingCredits) m.push("existing_credits");
  if (!s.representationStatus) m.push("representation_status");
  if (!s.incomeExpectation) m.push("income_expectation");
  if (!s.timeAvailability) m.push("time_availability");
  return m;
};

const shouldShowCourseCaution = (s: Signals, eligible: Set<ActorRouteId>): boolean =>
  eligible.has("formal_actor_training") ||
  s.trainingBackground === "private_acting_course" ||
  (
    (s.budgetForTrainingOrMaterials === "500_to_2000" ||
      s.budgetForTrainingOrMaterials === "2000_plus") &&
    (hasPriority(s, "formal_training") ||
      s.trainingBackground === "short_courses_or_workshops")
  );

export function runActorEngine(input: { signals: Signals }): EngineOutput {
  const s = input.signals;
  const missing = critical(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null, alternativeRouteIds: [],
      affordabilityNotes: [], considerations: [],
      blockersAndChecks: [`We need answers on: ${missing.join(", ")} before we can compare acting evidence routes.`],
      immediateAction: "Go back and complete the outstanding questions so we can compare evidence-building routes for you.",
      evidenceNotes: [], routeEvaluations: [], missingSignals: missing,
      mayOpenLaterRouteIds: [], isInternationalVerification: false, showCourseCaution: false,
    };
  }

  const ids: ActorRouteId[] = [
    "formal_actor_training",
    "university_drama_degree",
    "portfolio_audition_materials_route",
    "credits_and_experience_route",
    "agent_and_casting_profile_route",
    "adjacent_performance_income_route",
  ];
  const eligFns: Record<ActorRouteId, (s: Signals) => boolean> = {
    formal_actor_training: isFormal,
    university_drama_degree: isDegree,
    portfolio_audition_materials_route: isMaterials,
    credits_and_experience_route: isCredits,
    agent_and_casting_profile_route: isAgent,
    adjacent_performance_income_route: isAdjacent,
  };
  const rawEvals: RouteEval[] = ids.map((id) => {
    const eligible = eligFns[id](s);
    return {
      id, displayTitle: TITLES[id], eligible,
      affordability: { affordable: true, notes: [AFF[id]] },
      rankingScore: eligible ? baseScore(id) + priorityBonus(id, s) : -1,
      blockersAndChecks: eligible ? blockers(id) : [],
      immediateAction: immediate(id),
      evidenceNote: EVIDENCE[id],
    };
  });

  if (s.performerScope === "under_18_or_child_performer") {
    const gated = rawEvals.map((r) => ({ ...r, eligible: false }));
    return {
      status: "bridging_required",
      recommendedRouteId: null, alternativeRouteIds: [],
      affordabilityNotes: [], considerations: [],
      blockersAndChecks: [
        "Child and young performer routes are out of scope for v1. Speak to a licensed child performance chaperone service or your local authority child performance team.",
      ],
      immediateAction: "Contact your local authority child performance / child employment team for licensing, chaperoning and safeguarding guidance before pursuing any acting work.",
      evidenceNotes: ["Under-18 acting work is governed by child performance licensing rules — separate from adult professional routes."],
      routeEvaluations: gated, missingSignals: [],
      mayOpenLaterRouteIds: [], isInternationalVerification: false, showCourseCaution: false,
    };
  }

  const suppressAgentAndPaidCourse = s.performerScope === "not_sure";

  const degreeStructurallyRelevant = hasLevel3ForDegree(s) || hasPriority(s, "formal_training");
  if (s.qualificationOrigin === "international" && degreeStructurallyRelevant) {
    const mayOpen: ActorRouteId[] = [];
    if (rawEvals.find((r) => r.id === "university_drama_degree")?.eligible) mayOpen.push("university_drama_degree");
    if (rawEvals.find((r) => r.id === "formal_actor_training")?.eligible) mayOpen.push("formal_actor_training");
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null, alternativeRouteIds: [],
      affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["A university drama degree or formal training route needs a UK equivalence check on your international qualification before it can be compared. Equivalence is a check, not a training route."],
      immediateAction: "Check your qualification equivalence with UK ENIC, then compare drama-school or degree entry requirements.",
      evidenceNotes: ["UK ENIC issues Statements of Comparability that map international qualifications to UK levels."],
      routeEvaluations: rawEvals, missingSignals: [],
      mayOpenLaterRouteIds: mayOpen, isInternationalVerification: true,
      showCourseCaution: shouldShowCourseCaution(s, new Set(mayOpen)),
    };
  }

  const suppressed = new Set<ActorRouteId>();
  if (suppressAgentAndPaidCourse) {
    suppressed.add("agent_and_casting_profile_route");
    suppressed.add("formal_actor_training");
    suppressed.add("university_drama_degree");
  }

  const mayOpen: ActorRouteId[] = [];
  const degreeEval = rawEvals.find((r) => r.id === "university_drama_degree")!;
  if (
    (s.highestQualification === "none" || s.highestQualification === "gcse" || s.highestQualification === "unknown") &&
    !degreeEval.eligible
  ) {
    mayOpen.push("university_drama_degree");
    suppressed.add("university_drama_degree");
  }

  const evals: RouteEval[] = rawEvals.map((r) =>
    suppressed.has(r.id) ? { ...r, eligible: false, rankingScore: -1, blockersAndChecks: [] } : r,
  );

  const eligible = evals.filter((r) => r.eligible);
  const eligibleIds = new Set(eligible.map((r) => r.id));

  const beginnerAdult =
    s.trainingBackground === "no_formal_training" &&
    s.existingCredits === "none" &&
    has(s, "none_yet");

  if (
    eligible.length === 0 ||
    (beginnerAdult &&
      !eligibleIds.has("portfolio_audition_materials_route") &&
      !eligibleIds.has("credits_and_experience_route") &&
      !eligibleIds.has("adjacent_performance_income_route") &&
      !eligibleIds.has("formal_actor_training"))
  ) {
    return {
      status: "bridging_required",
      recommendedRouteId: null, alternativeRouteIds: [],
      affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["Right now the strongest next step is building foundations — training, materials or credits — rather than pursuing a specific route as the primary outcome."],
      immediateAction: "Focus on one foundation-building step first (short course, headshot + showreel, or a student/fringe credit) before comparing named routes.",
      evidenceNotes: ["Acting has no statutory qualification gate and no promised route to paid work. Foundations build the evidence needed for later routes."],
      routeEvaluations: evals, missingSignals: [],
      mayOpenLaterRouteIds: mayOpen, isInternationalVerification: false,
      showCourseCaution: shouldShowCourseCaution(s, eligibleIds),
    };
  }

  const ranked = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore).slice(0, 3);
  const best = ranked[0];
  const alt = ranked.slice(1);

  const considerations: string[] = [];
  if (isAdjacent(s)) considerations.push("Acting income is irregular. Most working actors do other paid work between acting jobs.");
  if (suppressAgentAndPaidCourse) considerations.push("You selected `not sure` on scope — agent, casting-platform and paid-course routes are held back until you confirm you're exploring adult professional-acting routes.");
  if (mayOpen.includes("university_drama_degree")) considerations.push("A drama degree route may open later once a Level 3 qualification or access route is in place.");

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alt.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations,
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [...ranked, ...evals.filter((e) => !ranked.includes(e))],
    missingSignals: [],
    mayOpenLaterRouteIds: mayOpen,
    isInternationalVerification: false,
    showCourseCaution: shouldShowCourseCaution(s, eligibleIds),
  };
}

function card(ev: RouteEval, kind: ModularRouteCard["kind"], fit: string): ModularRouteCard {
  return {
    kind, title: ev.displayTitle, fit,
    constraint: ev.blockersAndChecks[0] ?? "Check evidence, terms and outcomes independently before committing.",
    checks: ev.blockersAndChecks.slice(0, 3),
    timeCaveat: actorFlavor.timeCaveats[ev.id],
    costCaveat: actorFlavor.costCaveats[ev.id],
    patternCaveat: actorFlavor.patternCaveats[ev.id],
    nextAction: ev.immediateAction,
    affordable: ev.affordability.affordable,
  };
}

function extraCautionCards(out: EngineOutput): ModularRouteCard[] {
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
}

function buildVerification(out: EngineOutput): ModularPayload {
  const routes: ModularRouteCard[] = [];
  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (ev) routes.push(card(ev, "may_open_later", actorFlavor.mayOpenLaterFit));
  }
  routes.push(...extraCautionCards(out));
  return {
    status: "qualification_verification_required",
    headline: "A university drama degree or formal training route needs a UK equivalence check on your international qualification first. Equivalence is a check, not a training route.",
    routes,
    checksBeforeCommitting: [...out.blockersAndChecks, ACTOR_SCOPE_NOTE],
  };
}

function buildModularForActor(out: EngineOutput): ModularPayload {
  if (out.status === "qualification_verification_required") return buildVerification(out);
  const base = buildModularPayload(out, actorFlavor);
  if (out.status === "insufficient_information") return base;
  const withoutDefaultCaution =
    out.status === "route_recommended" ? base.routes.filter((r) => r.kind !== "caution") : base.routes;
  const mayOpenCards: ModularRouteCard[] = [];
  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (ev) mayOpenCards.push(card(ev, "may_open_later", actorFlavor.mayOpenLaterFit));
  }
  return {
    ...base,
    routes: [...withoutDefaultCaution, ...mayOpenCards, ...extraCautionCards(out)],
    checksBeforeCommitting: [...base.checksBeforeCommitting, ACTOR_SCOPE_NOTE],
  };
}

export function buildActorResult(input: { signals: Signals }) {
  const out = runActorEngine(input);
  const readiness = out.status === "route_recommended" ? "ready_now"
    : out.status === "insufficient_information" ? "nearly_ready" : "needs_bridging";
  const overall = readiness === "ready_now" ? "Realistic but hard"
    : readiness === "nearly_ready" ? "Realistic but hard" : "Long shot";
  const bestEv = out.recommendedRouteId ? out.routeEvaluations.find((r) => r.id === out.recommendedRouteId) : undefined;
  const altEv = out.alternativeRouteIds[0] ? out.routeEvaluations.find((r) => r.id === out.alternativeRouteIds[0]) : undefined;
  const bestRoute = bestEv
    ? {
        title: bestEv.displayTitle,
        summary: "This appears to be the strongest evidence-building step from your answers. Acting outcomes are not decided by any single route.",
        whyThisFits: ["This route appears structurally relevant to your answers. It does not promise auditions, representation or paid acting work."],
        estimatedTime: actorFlavor.timeCaveats[bestEv.id] ?? "Depends on the provider",
        likelyCost: actorFlavor.costCaveats[bestEv.id] ?? "Confirm current fees and terms with the provider before committing",
        mainDifficulty: bestEv.blockersAndChecks[0] ?? "Check evidence, terms and outcomes independently before committing.",
        confidence: "medium",
      }
    : {
        title: out.status === "qualification_verification_required"
          ? "A qualification-equivalence check is needed before a formal training / degree route can be compared"
          : out.status === "bridging_required"
            ? "Foundations first — a bridging step is needed before naming a primary route"
            : "We need a few more answers before comparing evidence routes",
        summary: out.status === "qualification_verification_required"
          ? "UK ENIC is the authority for the equivalence check. The step below is the next concrete action — it is not a route in itself."
          : out.status === "bridging_required"
            ? "Right now the strongest next step is building foundations rather than pursuing a specific route as the primary outcome."
            : "Some critical answers are missing. Complete them and we'll compare routes for you.",
        whyThisFits: [] as string[],
        estimatedTime: "Depends on the outcome of the step below",
        likelyCost: "Depends on the outcome of the step below",
        mainDifficulty: out.blockersAndChecks[0] ?? "",
        confidence: "low",
      };
  const backupRoute = altEv
    ? {
        title: altEv.displayTitle,
        summary: "A second structurally relevant evidence-building route from your answers. It also does not promise paid acting work.",
        tradeOff: "Different timeline, cost and evidence value — see the caveats and checks on the card.",
      }
    : { title: "No secondary route from your current answers", summary: "Only one evidence-building route was structurally relevant from what you told us.", tradeOff: "" };
  return {
    readiness,
    readinessReason:
      out.status === "route_recommended"
        ? "Your answers point to at least one structurally relevant evidence-building route. No route promises paid acting work."
        : out.status === "qualification_verification_required"
          ? "A qualification-equivalence check is needed before a formal training or degree route can be compared."
          : out.status === "bridging_required"
            ? "Right now the strongest next step is building foundations rather than pursuing a specific route as the primary outcome."
            : "We need a few more answers before we can compare evidence routes.",
    biggestBlocker: out.blockersAndChecks[0] ?? "No single structural blocker stood out — but check evidence, terms and outcomes independently before committing.",
    immediateAction: out.immediateAction,
    overallVerdict: overall,
    bestRoute, backupRoute,
    routeToAvoid: {
      title: "Paying for an unaccredited acting course expecting it to lead to paid work",
      whyRisky: "Paid acting courses do not promise paid acting work afterwards. Unaccredited providers vary widely in tutor credits, graduate outcomes and refund terms.",
      whenItMightWork: "When you've independently checked accreditation, named tutor credits, recent graduate outcomes and refund/cancellation terms — and treat the course as evidence-building only, not as a route to work.",
    },
    firstMoves: [out.immediateAction, "Cross-check National Careers Service and Equity guidance before committing money or signing anything."].slice(0, 3),
    considerations: out.considerations.length ? out.considerations : undefined,
    modular: buildModularForActor(out),
  };
}
