// Plumber deterministic route engine — v1.
//
// Structure mirrors the Electrician engine and honours the same contract:
//   - Eligibility is deterministic and independent of budget and priorities.
//   - Priorities may reorder eligible routes only.
//   - Budget never changes readiness or eligibility.
//   - Working conditions produce considerations only.
//   - Free text never affects eligibility.
//   - Older / international / unknown-level qualifications route to
//     `qualification_verification_required`.
//   - Missing critical signals route to `insufficient_information`.
//   - No eligible route routes to `bridging_required`.

import type { PlumberSignals } from "../questionnaire/signals";

export type PlumberRouteId =
  | "apprenticeship"
  | "college_then_workplace_experience"
  | "experienced_worker_route";

export type PlumberOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export interface AffordabilityReport {
  affordable: boolean;
  notes: string[];
}

export interface RouteEvaluation {
  id: PlumberRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: AffordabilityReport;
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface PlumberEngineInput {
  signals: PlumberSignals;
  region?: string | null;
  serviceLevel?: string | null;
  role?: { role_slug?: string; role_name?: string } | null;
}

export interface PlumberEngineOutput {
  status: PlumberOutcomeStatus;
  recommendedRouteId: PlumberRouteId | null;
  alternativeRouteIds: PlumberRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: RouteEvaluation[];
  missingSignals: string[];
}

const ROUTE_TITLES: Record<PlumberRouteId, string> = {
  apprenticeship: "Plumbing and domestic heating apprenticeship",
  college_then_workplace_experience: "College qualification followed by workplace experience",
  experienced_worker_route: "Experienced-worker assessment route",
};

const EVIDENCE_NOTES: Record<PlumberRouteId, string> = {
  apprenticeship:
    "Level 3 Plumbing and Domestic Heating Technician apprenticeship standard; typical duration 3–4 years; paid.",
  college_then_workplace_experience:
    "City & Guilds 6035 (or equivalent) at Level 2/3 followed by NVQ Level 3 requiring evidenced on-site work.",
  experienced_worker_route:
    "Experienced Worker Assessment routes require substantial evidenced plumbing work history.",
};

const patternIncludes = (patterns: string[], ...anyOf: string[]): boolean =>
  patterns.some((p) => anyOf.includes(p));

const isApprenticeshipEligible = (s: PlumberSignals): boolean => {
  if (!s.availableTrainingPatterns.length) return false;
  return patternIncludes(
    s.availableTrainingPatterns,
    "full_time_work_based",
    "full_time_college",
    "one_or_two_weekdays",
  );
};

const isCollegeRouteEligible = (s: PlumberSignals): boolean =>
  patternIncludes(
    s.availableTrainingPatterns,
    "full_time_college",
    "one_or_two_weekdays",
    "weekday_evenings",
    "mixed_day_evening",
  );

const isExperiencedWorkerEligible = (s: PlumberSignals): boolean => {
  if (!s.hasPlumbingExperience) return false;
  return s.plumbingQualificationLevel === "level_2"
      || s.plumbingQualificationLevel === "level_3"
      || s.plumbingQualificationLevel === "gas_heating";
};

const evaluateAffordability = (
  routeId: PlumberRouteId,
  s: PlumberSignals,
): AffordabilityReport => {
  const budget = s.trainingBudgetBand;
  switch (routeId) {
    case "apprenticeship":
      return {
        affordable: true,
        notes: [
          "Apprenticeships are paid roles — you earn while training and course fees are covered.",
        ],
      };
    case "college_then_workplace_experience": {
      const notes = [
        "College course fees vary; funding may be available depending on age, prior qualifications and region — always check with the provider.",
      ];
      if (budget === "free_only" || budget === "up_to_500") {
        return {
          affordable: false,
          notes: [
            ...notes,
            "Your stated budget is likely below typical self-funded college fees for this route.",
          ],
        };
      }
      return { affordable: true, notes };
    }
    case "experienced_worker_route": {
      const notes = [
        "Experienced-worker assessment fees are usually in the low thousands and normally self-funded.",
      ];
      if (budget === "free_only" || budget === "up_to_500" || budget === "500_to_2000") {
        return {
          affordable: false,
          notes: [
            ...notes,
            "Your stated budget may not cover typical assessment costs — confirm current fees with an approved assessment centre.",
          ],
        };
      }
      return { affordable: true, notes };
    }
  }
};

const baseScore = (routeId: PlumberRouteId, s: PlumberSignals): number => {
  switch (routeId) {
    case "apprenticeship":
      return 100
        + (s.startingPoint === "still_at_school" ? 10 : 0)
        + (s.startingPoint === "recently_left_education" ? 8 : 0)
        + (s.startingPoint === "career_changer" ? 4 : 0);
    case "college_then_workplace_experience":
      return 80
        + (s.hasRelatedTradeExperience ? 5 : 0)
        + (s.startingPoint === "career_changer" ? 6 : 0);
    case "experienced_worker_route":
      return 60 + (s.hasPlumbingExperience ? 20 : 0);
  }
};

const priorityBonus = (routeId: PlumberRouteId, priorities: string[]): number => {
  if (priorities.includes("not_sure_yet")) return 0;
  let bonus = 0;
  const w = 12;
  for (const p of priorities) {
    if (p === "earn_while_training" && routeId === "apprenticeship") bonus += w;
    if (p === "practical_experience" && routeId === "apprenticeship") bonus += w;
    if (p === "low_cost" && routeId === "apprenticeship") bonus += w;
    if (p === "strongest_employment" && routeId === "apprenticeship") bonus += 6;
    if (p === "recognised_qualification" && routeId === "college_then_workplace_experience") bonus += 15;
    if (p === "fit_around_commitments" && routeId === "college_then_workplace_experience") bonus += 8;
    if (p === "qualify_quickly" && routeId === "experienced_worker_route") bonus += w;
  }
  return bonus;
};

const affordabilityAdjustment = (aff: AffordabilityReport): number =>
  aff.affordable ? 0 : -20;

const routeBlockersAndChecks = (routeId: PlumberRouteId, s: PlumberSignals): string[] => {
  const out: string[] = [];
  if (routeId === "apprenticeship") {
    if (s.mathsEnglishStatus === "neither") {
      out.push(
        "Most plumbing apprenticeship providers require English and maths at level 2 (GCSE grade 4/C) or Functional Skills; you may need to complete these alongside or before starting.",
      );
    }
    if (s.mathsEnglishStatus === "international") {
      out.push(
        "Providers will need to see how your international qualifications map to English and maths at Level 2 — check with the training provider or UK ENIC.",
      );
    }
    if (s.travelRange === "local_no_car") {
      out.push(
        "Plumbing apprenticeship placements can span a wide area — check whether local employers hire apprentices you can reach without a car.",
      );
    }
  }
  if (routeId === "college_then_workplace_experience") {
    if (s.mathsEnglishStatus === "neither") {
      out.push(
        "Many colleges expect Level 2 maths and English for enrolment on Level 3 plumbing courses.",
      );
    }
    out.push(
      "The NVQ Level 3 that follows the classroom course requires evidence of real on-site plumbing work — plan how you'll access that placement.",
    );
  }
  if (routeId === "experienced_worker_route") {
    if (s.plumbingQualificationLevel === "gas_heating") {
      // Gas/heating/building-services qualifications are adjacent to
      // plumbing but are NOT automatically treated as equivalent to a
      // plumbing qualification. The engine already requires evidenced
      // plumbing experience to consider this route eligible; here we
      // surface the verification step explicitly.
      out.push(
        "Your gas, heating or building-services qualification may be relevant to the experienced-worker route but is not automatically equivalent to a plumbing qualification — confirm with an approved plumbing assessment centre how it maps to the current requirements.",
      );
    }
    out.push(
      "You will need to evidence substantial recent plumbing work — check the current assessment portfolio requirements with an approved centre.",
    );
  }
  return out;
};

const routeImmediateAction = (routeId: PlumberRouteId): string => {
  switch (routeId) {
    case "apprenticeship":
      return "Search current plumbing apprenticeship vacancies on the government's Find an Apprenticeship service and note the entry requirements for two employers you'd realistically apply to.";
    case "college_then_workplace_experience":
      return "Look up City & Guilds 6035 (or equivalent) Level 2 plumbing courses at colleges within your travel range and note their next intake and entry requirements.";
    case "experienced_worker_route":
      return "Request the current experienced-worker assessment guidance from an approved plumbing assessment centre and start listing the plumbing work you can evidence.";
  }
};

const CONDITION_MESSAGES: Record<string, string> = {
  confined_spaces:
    "You noted working in confined spaces as something to check. Plumbing work often involves lofts, cupboards and plant rooms — ask employers about the mix of work involved.",
  lifting_bending:
    "You noted regular lifting, bending or kneeling as something to check. Ask a working plumber about typical physical demands on the routes you're considering.",
  domestic_or_plant_rooms:
    "You noted working in bathrooms, kitchens, lofts or plant rooms as something to check. These are typical plumbing environments — a taster day can give you a realistic picture before committing.",
  emergency_callouts:
    "You noted emergency callouts or irregular hours as something to check. Some plumbing roles include on-call rotas; others don't — confirm what a typical week looks like for the employers you're considering.",
  travel_between_customers:
    "You noted travelling between customer sites as something to check. Domestic plumbing usually involves regular travel between customers — confirm expected travel time and vehicle arrangements.",
  need_more_info:
    "You said you need more information about the working conditions — a taster day, work experience, or a call with an approved training provider can give you a realistic picture before committing.",
};

const buildConsiderations = (s: PlumberSignals): string[] =>
  s.workingConditionsToCheck
    .filter((c) => c !== "none")
    .map((c) => CONDITION_MESSAGES[c])
    .filter((m): m is string => !!m);

const VERIFICATION_LEVELS = new Set(["older_unknown", "international", "unknown_level"]);

const CRITICAL_SIGNALS_MISSING = (s: PlumberSignals): string[] => {
  const missing: string[] = [];
  if (!s.startingPoint) missing.push("starting_point");
  if (!s.plumbingQualificationLevel) missing.push("plumbing_qualification");
  if (!s.mathsEnglishStatus) missing.push("maths_english_status");
  if (!s.availableTrainingPatterns.length) missing.push("training_availability");
  return missing;
};

export const runPlumberEngine = (input: PlumberEngineInput): PlumberEngineOutput => {
  const { signals: s } = input;
  const considerations = buildConsiderations(s);

  if (
    s.plumbingQualificationLevel &&
    VERIFICATION_LEVELS.has(s.plumbingQualificationLevel)
  ) {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        "We can't safely classify your existing plumbing qualification without verification. Older UK qualifications may be superseded, and international qualifications need mapping to current UK requirements.",
      ],
      immediateAction:
        "Ask an approved plumbing training provider or awarding-body assessment centre (e.g. City & Guilds / EAL) to review your existing qualification and confirm what it maps to in the current UK system.",
      evidenceNotes: [
        "UK plumbing qualifications are set by awarding bodies including City & Guilds and EAL; equivalency is decided by them, not by self-report.",
      ],
      routeEvaluations: [],
      missingSignals: [],
    };
  }

  const missing = CRITICAL_SIGNALS_MISSING(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        `We need answers on: ${missing.join(", ")} before we can suggest a specific route.`,
      ],
      immediateAction:
        "Go back and complete the outstanding questions so we can identify the strongest structural route.",
      evidenceNotes: [],
      routeEvaluations: [],
      missingSignals: missing,
    };
  }

  const routeIds: PlumberRouteId[] = [
    "apprenticeship",
    "college_then_workplace_experience",
    "experienced_worker_route",
  ];

  const eligibilityFns: Record<PlumberRouteId, (s: PlumberSignals) => boolean> = {
    apprenticeship: isApprenticeshipEligible,
    college_then_workplace_experience: isCollegeRouteEligible,
    experienced_worker_route: isExperiencedWorkerEligible,
  };

  const evaluations: RouteEvaluation[] = routeIds.map((id) => {
    const eligible = eligibilityFns[id](s);
    const affordability = evaluateAffordability(id, s);
    const score = eligible
      ? baseScore(id, s) + priorityBonus(id, s.routePriorities) + affordabilityAdjustment(affordability)
      : -1;
    return {
      id,
      displayTitle: ROUTE_TITLES[id],
      eligible,
      affordability,
      rankingScore: score,
      blockersAndChecks: eligible ? routeBlockersAndChecks(id, s) : [],
      immediateAction: routeImmediateAction(id),
      evidenceNote: EVIDENCE_NOTES[id],
    };
  });

  const eligible = evaluations.filter((e) => e.eligible);

  if (eligible.length === 0) {
    const bridgingAction =
      !s.availableTrainingPatterns.length
        ? "Identify at least one training pattern you could commit to for a year, then come back — most routes need some regular weekday or evening availability."
        : s.availableTrainingPatterns.every((p) => p === "weekends" || p === "availability_varies" || p === "not_sure_yet")
        ? "Weekend-only or highly variable availability rules out most current plumbing training patterns. Explore whether you could restructure to include some weekday hours, or start with a short introductory course."
        : "Contact an approved plumbing training provider and ask which single next step would open the routes closest to your situation.";

    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        "Given your current situation, none of the standard training routes are directly open right now — a bridging step is needed first.",
      ],
      immediateAction: bridgingAction,
      evidenceNotes: [
        "Bridging steps commonly used: short introductory plumbing courses; Functional Skills to plug English/maths gaps; changes to availability that unlock apprenticeship applications.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
    };
  }

  const ranked = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
  const best = ranked[0];
  const alternatives = ranked.slice(1);

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alternatives.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations,
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [...ranked, ...evaluations.filter((e) => !e.eligible)],
    missingSignals: [],
  };
};

export const ROUTE_DISPLAY_TITLES = ROUTE_TITLES;
