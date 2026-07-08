// Actor deterministic route engine — v1 (Design Brief v3).
//
// Runtime-neutral. Deno mirror at supabase/functions/reality-check/_actor.ts
// kept identical via shared/reality-check/actor-cases.json.
//
// Contract (per Design Brief v3):
//   - Six route IDs. `creative_foundation_bridging` is a bridging OUTCOME —
//     never a route card.
//   - `qualification_verification_required` is used ONLY when
//     qualificationOrigin == "international" AND a degree/training route is
//     genuinely being compared and equivalence blocks it.
//   - `unknown` (highest_qualification or qualification_origin) NEVER behaves
//     like `international` and NEVER triggers verification.
//   - Budget NEVER gates eligibility. Budget only informs affordability copy.
//   - `checks_before_committing` NEVER gates eligibility and NEVER removes a
//     safety caution.
//   - `performer_scope == under_18_or_child_performer` returns a conservative
//     bridging outcome with no paid-course / agent / casting-platform /
//     credits / adjacent-income route recommendations.
//   - `performer_scope == not_sure` treats as adult, but suppresses paid-course
//     and agent/casting-profile routes until confirmed.
//   - No question or signal captures protected characteristics, appearance,
//     body, gender, ethnicity, disability, accent, casting-type or precise age.

import type {
  ActorAuditionMaterial,
  ActorHighestQualification,
  ActorRoutePriority,
  ActorSignals,
} from "../questionnaire/signals";

export type ActorRouteId =
  | "formal_actor_training"
  | "university_drama_degree"
  | "portfolio_audition_materials_route"
  | "credits_and_experience_route"
  | "agent_and_casting_profile_route"
  | "adjacent_performance_income_route";

export type ActorOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export interface ActorRouteEvaluation {
  id: ActorRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: { affordable: boolean; notes: string[] };
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface ActorEngineOutput {
  status: ActorOutcomeStatus;
  recommendedRouteId: ActorRouteId | null;
  alternativeRouteIds: ActorRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: ActorRouteEvaluation[];
  missingSignals: string[];
  /** may_open_later routes surfaced on qualification_verification_required or
   *  bridging paths (e.g. degree route when Level 3 is missing). */
  mayOpenLaterRouteIds: ActorRouteId[];
  /** True when the verification path is international-qualification — no route
   *  card should be fabricated in that branch. */
  isInternationalVerification: boolean;
  /** True when the course/accreditation caution must render (independent of
   *  checks_before_committing). */
  showCourseCaution: boolean;
}

export interface ActorEngineInput {
  signals: ActorSignals;
  region?: string | null;
  serviceLevel?: string | null;
  role?: { role_slug?: string; role_name?: string } | null;
}

export const ROUTE_TITLES: Record<ActorRouteId, string> = {
  formal_actor_training:
    "Formal actor training (accredited conservatoire / drama school)",
  university_drama_degree: "University drama degree",
  portfolio_audition_materials_route:
    "Build audition materials (headshot, showreel, casting profile)",
  credits_and_experience_route:
    "Build credits and experience (student, fringe, short-film work)",
  agent_and_casting_profile_route:
    "Explore representation and casting-profile route",
  adjacent_performance_income_route:
    "Adjacent paid performance work (voice, corporate role-play, workshops, presenting, background artist)",
};

const EVIDENCE_NOTES: Record<ActorRouteId, string> = {
  formal_actor_training:
    "Accredited conservatoire / drama school training is a common pathway. Accreditation (e.g. CDMT recognition) is a quality-assurance signal, not proof of paid work afterwards.",
  university_drama_degree:
    "A drama degree provides structured training and time to build credits. It does not promise auditions or paid work.",
  portfolio_audition_materials_route:
    "A recognisable headshot, showreel and casting profile are the baseline evidence agents and casting directors expect. They are evidence, not proof of paid work.",
  credits_and_experience_route:
    "Student films, fringe theatre and short films build the evidence you need for later routes. Check unpaid-work terms before committing.",
  agent_and_casting_profile_route:
    "Signing with an agent does not promise auditions or income. Check contract terms, commission rates and notice periods. Equity provides guidance.",
  adjacent_performance_income_route:
    "Voice work, corporate role-play, workshops, presenting and background/supporting-artist work are separate paid activities. They are not automatic stepping-stones into acting roles.",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const LEVEL_3_FOR_DEGREE: ReadonlySet<ActorHighestQualification> = new Set([
  "a_level_or_level_3",
  "performing_arts_level_3",
  "bachelors_drama_or_acting",
  "bachelors_other",
  "masters_plus",
]);

export const hasLevel3ForDegree = (s: ActorSignals): boolean =>
  s.highestQualification !== null &&
  LEVEL_3_FOR_DEGREE.has(s.highestQualification);

export const hasMeaningfulTime = (s: ActorSignals): boolean =>
  s.timeAvailability === "full_time" ||
  s.timeAvailability === "part_time_flexible";

const includesMaterial = (
  s: ActorSignals,
  m: ActorAuditionMaterial,
): boolean => s.auditionMaterials.includes(m);

const includesPriority = (
  s: ActorSignals,
  p: ActorRoutePriority,
): boolean => s.routePriorities.includes(p);

const hasHeadshotAndShowreel = (s: ActorSignals): boolean =>
  includesMaterial(s, "headshot") && includesMaterial(s, "showreel");

const isCompleteBeginnerAdult = (s: ActorSignals): boolean =>
  s.trainingBackground === "no_formal_training" &&
  s.existingCredits === "none" &&
  includesMaterial(s, "none_yet");

const isAdultRoute = (s: ActorSignals): boolean =>
  s.performerScope === "adult_professional_route";

// ── Eligibility predicates (fully parenthesised, named) ─────────────────────

const isFormalActorTrainingEligible = (s: ActorSignals): boolean =>
  hasMeaningfulTime(s) &&
  (
    includesPriority(s, "formal_training") ||
    s.trainingBackground === "school_or_youth_drama" ||
    s.trainingBackground === "short_courses_or_workshops" ||
    s.trainingBackground === "private_acting_course" ||
    s.trainingBackground === "accredited_conservatoire_or_drama_school" ||
    s.trainingBackground === "university_drama_degree"
  );

const isUniversityDramaDegreeEligible = (s: ActorSignals): boolean =>
  hasLevel3ForDegree(s) &&
  s.timeAvailability === "full_time" &&
  (includesPriority(s, "formal_training") || includesPriority(s, "stage_work"));

const isPortfolioMaterialsEligible = (s: ActorSignals): boolean =>
  !includesMaterial(s, "headshot") ||
  !includesMaterial(s, "showreel") ||
  !includesMaterial(s, "spotlight_or_equivalent_profile");

const isCreditsRouteEligible = (s: ActorSignals): boolean =>
  (
    s.existingCredits === "none" ||
    s.existingCredits === "student_or_amateur_only" ||
    s.existingCredits === "unpaid_short_or_student_films"
  );

const isAgentRouteEligible = (s: ActorSignals): boolean =>
  (
    s.representationStatus === "no_agent" ||
    s.representationStatus === "seeking_agent"
  ) &&
  (
    hasHeadshotAndShowreel(s) ||
    s.existingCredits === "some_paid_credits" ||
    s.existingCredits === "regular_paid_credits"
  );

const isAdjacentIncomeEligible = (s: ActorSignals): boolean =>
  s.incomeExpectation === "main_income_soon" ||
  s.incomeExpectation === "unsure";

// ── Affordability (budget informs COPY only, never eligibility) ─────────────

const AFFORDABILITY_NOTES: Record<ActorRouteId, string> = {
  formal_actor_training:
    "Accredited drama-school fees vary widely. Check current fees, funding options and student finance eligibility with the specific provider.",
  university_drama_degree:
    "UK undergraduate tuition is loan-funded via GOV.UK Student Finance. Check with the specific university.",
  portfolio_audition_materials_route:
    "Costs are typically modest but vary — professional headshots and showreel edits are the largest items.",
  credits_and_experience_route:
    "Usually low or no cost. Check unpaid-work terms and travel/subsistence before committing.",
  agent_and_casting_profile_route:
    "Casting-platform subscriptions carry fees. Reputable agents do NOT charge sign-up fees — commission comes from paid work.",
  adjacent_performance_income_route:
    "Paid work — usually no upfront cost. Confirm rates and terms before accepting.",
};

const affordabilityFor = (id: ActorRouteId) => ({
  affordable: true,
  notes: [AFFORDABILITY_NOTES[id]],
});

// ── Ranking ─────────────────────────────────────────────────────────────────

const baseScore = (id: ActorRouteId): number => {
  switch (id) {
    case "portfolio_audition_materials_route": return 88;
    case "credits_and_experience_route":       return 86;
    case "agent_and_casting_profile_route":    return 84;
    case "formal_actor_training":              return 82;
    case "university_drama_degree":            return 80;
    case "adjacent_performance_income_route":  return 70;
  }
};

const priorityBonus = (id: ActorRouteId, s: ActorSignals): number => {
  let b = 0;
  if (includesPriority(s, "formal_training")) {
    if (id === "formal_actor_training") b += 14;
    if (id === "university_drama_degree") b += 12;
  }
  if (includesPriority(s, "stage_work") && id === "university_drama_degree") b += 6;
  if (includesPriority(s, "agent_and_profile")) {
    if (id === "agent_and_casting_profile_route") b += 12;
    if (id === "portfolio_audition_materials_route") b += 6;
  }
  if (includesPriority(s, "build_credits") && id === "credits_and_experience_route") b += 10;
  if (includesPriority(s, "screen_work") && id === "credits_and_experience_route") b += 4;
  return b;
};

// ── Blockers / immediate action ─────────────────────────────────────────────

const routeBlockers = (id: ActorRouteId): string[] => {
  switch (id) {
    case "formal_actor_training":
      return [
        "Paid acting courses vary widely in quality. Accreditation (e.g. CDMT) is a quality-assurance signal, not proof of paid work afterwards.",
        "Confirm the specific course's accreditation, tutor credits and graduate outcomes before committing.",
      ];
    case "university_drama_degree":
      return [
        "A drama degree does not promise auditions or paid work. Check the course's staff credits, graduate outcomes and industry links.",
        "Confirm entry requirements and student-finance eligibility with the specific university.",
      ];
    case "portfolio_audition_materials_route":
      return [
        "Materials are evidence, not proof of paid work. Get a professional headshot and a short focused showreel before committing to paid casting-platform subscriptions.",
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

const routeImmediate = (id: ActorRouteId): string => {
  switch (id) {
    case "formal_actor_training":
      return "Shortlist two accredited providers (e.g. from the CDMT recognised list), then confirm fees, funding options and graduate outcomes before applying.";
    case "university_drama_degree":
      return "Check UCAS entry requirements and Discover Uni graduate outcomes for two drama degrees before committing.";
    case "portfolio_audition_materials_route":
      return "Book a professional headshot and plan a short focused showreel (2–3 minutes). Add a casting profile only once headshot and showreel are ready.";
    case "credits_and_experience_route":
      return "Apply to student / fringe / short-film productions and check the unpaid-work terms with Equity guidance before signing on.";
    case "agent_and_casting_profile_route":
      return "Research a shortlist of reputable agents (open submission windows) and check Equity guidance on contract terms before signing.";
    case "adjacent_performance_income_route":
      return "Look up rates and terms for adjacent paid performance work (voice, corporate role-play, workshops, background artist) in your area and treat it as separate paid work.";
  }
};

// ── Critical missing signals ────────────────────────────────────────────────

const CRITICAL_MISSING = (s: ActorSignals): string[] => {
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

// ── Course-caution rule (independent of checks_before_committing) ───────────

const shouldShowCourseCaution = (
  s: ActorSignals,
  eligibleIds: ReadonlySet<ActorRouteId>,
): boolean =>
  eligibleIds.has("formal_actor_training") ||
  s.trainingBackground === "private_acting_course" ||
  (
    (s.budgetForTrainingOrMaterials === "500_to_2000" ||
      s.budgetForTrainingOrMaterials === "2000_plus") &&
    (includesPriority(s, "formal_training") ||
      s.trainingBackground === "short_courses_or_workshops")
  );

// ── Main entry point ────────────────────────────────────────────────────────

export const runActorEngine = (
  input: ActorEngineInput,
): ActorEngineOutput => {
  const s = input.signals;

  // 1. Missing critical signals.
  const missing = CRITICAL_MISSING(s);
  if (missing.length > 0) {
    return baseInsufficient(missing, [
      `We need answers on: ${missing.join(", ")} before we can compare acting evidence routes.`,
    ], "Go back and complete the outstanding questions so we can compare evidence-building routes for you.");
  }

  // Evaluate all six routes for the landscape view.
  const routeIds: ActorRouteId[] = [
    "formal_actor_training",
    "university_drama_degree",
    "portfolio_audition_materials_route",
    "credits_and_experience_route",
    "agent_and_casting_profile_route",
    "adjacent_performance_income_route",
  ];
  const eligibilityFns: Record<ActorRouteId, (s: ActorSignals) => boolean> = {
    formal_actor_training: isFormalActorTrainingEligible,
    university_drama_degree: isUniversityDramaDegreeEligible,
    portfolio_audition_materials_route: isPortfolioMaterialsEligible,
    credits_and_experience_route: isCreditsRouteEligible,
    agent_and_casting_profile_route: isAgentRouteEligible,
    adjacent_performance_income_route: isAdjacentIncomeEligible,
  };
  const rawEvaluations: ActorRouteEvaluation[] = routeIds.map((id) => {
    const eligible = eligibilityFns[id](s);
    return {
      id,
      displayTitle: ROUTE_TITLES[id],
      eligible,
      affordability: affordabilityFor(id),
      rankingScore: eligible ? baseScore(id) + priorityBonus(id, s) : -1,
      blockersAndChecks: eligible ? routeBlockers(id) : [],
      immediateAction: routeImmediate(id),
      evidenceNote: EVIDENCE_NOTES[id],
    };
  });

  // 2. Scope gate: under-18 → conservative bridging outcome, no routes.
  if (s.performerScope === "under_18_or_child_performer") {
    const gated = rawEvaluations.map((r) => ({ ...r, eligible: false }));
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "Child and young performer routes are out of scope for v1. Speak to a licensed child performance chaperone service or your local authority child performance team.",
      ],
      immediateAction:
        "Contact your local authority child performance / child employment team for licensing, chaperoning and safeguarding guidance before pursuing any acting work.",
      evidenceNotes: [
        "Under-18 acting work is governed by child performance licensing rules — separate from adult professional routes.",
      ],
      routeEvaluations: gated,
      missingSignals: [],
      mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
      showCourseCaution: false,
    };
  }

  // If `not_sure`, treat as adult but suppress agent + paid-course routes.
  const suppressAgentAndPaidCourse = s.performerScope === "not_sure";

  // 3. International qualification + degree/formal-training in play → verification.
  const degreeStructurallyRelevant =
    hasLevel3ForDegree(s) || includesPriority(s, "formal_training");
  if (
    s.qualificationOrigin === "international" &&
    degreeStructurallyRelevant
  ) {
    const mayOpenLater: ActorRouteId[] = [];
    if (rawEvaluations.find((r) => r.id === "university_drama_degree")?.eligible) {
      mayOpenLater.push("university_drama_degree");
    }
    if (rawEvaluations.find((r) => r.id === "formal_actor_training")?.eligible) {
      mayOpenLater.push("formal_actor_training");
    }
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "A university drama degree or formal training route needs a UK equivalence check on your international qualification before it can be compared. Equivalence is a check, not a training route.",
      ],
      immediateAction:
        "Check your qualification equivalence with UK ENIC, then compare drama-school or degree entry requirements.",
      evidenceNotes: [
        "UK ENIC issues Statements of Comparability that map international qualifications to UK levels.",
      ],
      routeEvaluations: rawEvaluations,
      missingSignals: [],
      mayOpenLaterRouteIds: mayOpenLater,
      isInternationalVerification: true,
      showCourseCaution: shouldShowCourseCaution(
        s,
        new Set(mayOpenLater),
      ),
    };
  }

  // 4. Apply scope suppression (not_sure).
  const suppressed = new Set<ActorRouteId>();
  if (suppressAgentAndPaidCourse) {
    suppressed.add("agent_and_casting_profile_route");
    suppressed.add("formal_actor_training");
    suppressed.add("university_drama_degree");
  }

  // 5. Unknown qualification blocking degree comparison → degree becomes
  //    may_open_later but other routes continue.
  const mayOpenLater: ActorRouteId[] = [];
  const degreeEval = rawEvaluations.find((r) => r.id === "university_drama_degree")!;
  if (
    (s.highestQualification === "none" ||
      s.highestQualification === "gcse" ||
      s.highestQualification === "unknown") &&
    !degreeEval.eligible
  ) {
    mayOpenLater.push("university_drama_degree");
    // Remove degree from recommendable set for this run.
    suppressed.add("university_drama_degree");
  }

  const evaluations: ActorRouteEvaluation[] = rawEvaluations.map((r) => {
    if (suppressed.has(r.id)) {
      return { ...r, eligible: false, rankingScore: -1, blockersAndChecks: [] };
    }
    return r;
  });

  const eligible = evaluations.filter((r) => r.eligible);
  const eligibleIds = new Set(eligible.map((r) => r.id));

  // 6. Complete-beginner adult with no eligible routes → bridging_required.
  if (
    eligible.length === 0 ||
    (isCompleteBeginnerAdult(s) &&
      !eligibleIds.has("portfolio_audition_materials_route") &&
      !eligibleIds.has("credits_and_experience_route") &&
      !eligibleIds.has("adjacent_performance_income_route") &&
      !eligibleIds.has("formal_actor_training"))
  ) {
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "Right now the strongest next step is building foundations — training, materials or credits — rather than pursuing a specific route as the primary outcome.",
      ],
      immediateAction:
        "Focus on one foundation-building step first (short course, headshot + showreel, or a student/fringe credit) before comparing named routes.",
      evidenceNotes: [
        "Acting has no statutory qualification gate and no promised route to paid work. Foundations build the evidence needed for later routes.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
      mayOpenLaterRouteIds: mayOpenLater,
      isInternationalVerification: false,
      showCourseCaution: shouldShowCourseCaution(s, eligibleIds),
    };
  }

  // 7. route_recommended — pick primary/backup deterministically.
  const ranked = pickPrimaryAndBackup(eligible, s);
  const best = ranked[0];
  const alternatives = ranked.slice(1);

  const considerations: string[] = [];
  if (isAdjacentIncomeEligible(s)) {
    considerations.push(
      "Acting income is irregular. Most working actors do other paid work between acting jobs.",
    );
  }
  if (suppressAgentAndPaidCourse) {
    considerations.push(
      "You selected `not sure` on scope — agent, casting-platform and paid-course routes are held back until you confirm you're exploring adult professional-acting routes.",
    );
  }
  if (mayOpenLater.includes("university_drama_degree")) {
    considerations.push(
      "A drama degree route may open later once a Level 3 qualification or access route is in place.",
    );
  }

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alternatives.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations,
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [
      ...ranked,
      ...evaluations.filter((e) => !ranked.includes(e)),
    ],
    missingSignals: [],
    mayOpenLaterRouteIds: mayOpenLater,
    isInternationalVerification: false,
    showCourseCaution: shouldShowCourseCaution(s, eligibleIds),
  };
};

const pickPrimaryAndBackup = (
  eligible: ActorRouteEvaluation[],
  s: ActorSignals,
): ActorRouteEvaluation[] => {
  const sorted = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
  // Cap to primary + up to 2 backups.
  const _ = s; // signals used for scoring already
  return sorted.slice(0, 3);
};

const baseInsufficient = (
  missing: string[],
  blockers: string[],
  action: string,
  evaluations: ActorRouteEvaluation[] = [],
): ActorEngineOutput => ({
  status: "insufficient_information",
  recommendedRouteId: null,
  alternativeRouteIds: [],
  affordabilityNotes: [],
  considerations: [],
  blockersAndChecks: blockers,
  immediateAction: action,
  evidenceNotes: [],
  routeEvaluations: evaluations,
  missingSignals: missing,
  mayOpenLaterRouteIds: [],
  isInternationalVerification: false,
  showCourseCaution: false,
});
