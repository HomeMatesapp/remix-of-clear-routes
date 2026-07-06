// Electrician deterministic route engine — v1.
//
// Runtime-neutral: no React, no browser or Deno globals. The Deno edge
// function ships a minimal mirror at supabase/functions/reality-check/_electrician.ts
// re-exporting the same core so behaviour cannot drift.
//
// Contract (documented in the plan):
//   - Eligibility is deterministic and independent of budget and priorities.
//   - Priorities may reorder eligible routes only. They cannot promote an
//     ineligible route.
//   - Budget never changes readiness or eligibility. It affects affordability
//     which may reduce (but not remove) an eligible route's ranking.
//   - Working conditions produce considerations only.
//   - Free text never affects eligibility.
//   - Older / international / unknown-level qualifications route to
//     `qualification_verification_required`.
//   - Missing critical signals route to `insufficient_information`.
//   - No eligible route routes to `bridging_required`.
//
// Outcome precedence (evaluated in order):
//   1. qualification_verification_required
//   2. insufficient_information
//   3. route eligibility
//   4. bridging_required (when no eligible route)
//   5. route_recommended

import type { ElectricianSignals } from "../questionnaire/signals";

export type ElectricianRouteId =
  | "apprenticeship"
  | "college_then_workplace_experience"
  | "experienced_worker_route";

export type ElectricianOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export interface AffordabilityReport {
  affordable: boolean;
  notes: string[];
}

export interface RouteEvaluation {
  id: ElectricianRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: AffordabilityReport;
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface ElectricianEngineInput {
  signals: ElectricianSignals;
  region?: string | null;
  serviceLevel?: string | null;
  role?: { role_slug?: string; role_name?: string } | null;
}

export interface ElectricianEngineOutput {
  status: ElectricianOutcomeStatus;
  recommendedRouteId: ElectricianRouteId | null;
  alternativeRouteIds: ElectricianRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  // For debugging/tests only.
  routeEvaluations: RouteEvaluation[];
  missingSignals: string[];
}

// ── Route rule table ─────────────────────────────────────────────────────────

const ROUTE_TITLES: Record<ElectricianRouteId, string> = {
  apprenticeship: "Electrical installation apprenticeship",
  college_then_workplace_experience: "College qualification followed by workplace experience",
  experienced_worker_route: "Experienced-worker assessment route",
};

const EVIDENCE_NOTES: Record<ElectricianRouteId, string> = {
  apprenticeship:
    "Level 3 Electrotechnical apprenticeship standard; typical duration 3–4 years; paid.",
  college_then_workplace_experience:
    "City & Guilds 2365 (or equivalent) followed by NVQ Level 3 requiring evidenced on-site work.",
  experienced_worker_route:
    "Experienced Worker Assessment (EWA) requires substantial verified electrical work history.",
};

// Eligibility ---------------------------------------------------------------

const patternIncludes = (patterns: string[], ...anyOf: string[]): boolean =>
  patterns.some((p) => anyOf.includes(p));

// Apprenticeship: needs availability that supports a full-time work-based
// commitment (or at least significant weekday availability). Employer-set;
// entry not blocked by lack of prior electrical experience.
const isApprenticeshipEligible = (s: ElectricianSignals): boolean => {
  if (!s.availableTrainingPatterns.length) return false;
  return patternIncludes(
    s.availableTrainingPatterns,
    "full_time_work_based",
    "full_time_college",
    "one_or_two_weekdays",
  );
};

// College then workplace experience: needs at least part-time weekday or
// full-time college availability. Independent of prior experience.
const isCollegeRouteEligible = (s: ElectricianSignals): boolean => {
  return patternIncludes(
    s.availableTrainingPatterns,
    "full_time_college",
    "one_or_two_weekdays",
    "weekday_evenings",
    "mixed_day_evening",
  );
};

// Experienced worker: requires meaningful existing electrical work AND
// existing qualification of at least Level 2 or "unknown_level" that would
// verify. Older/international are handled by outcome precedence before this
// runs.
const isExperiencedWorkerEligible = (s: ElectricianSignals): boolean => {
  if (!s.hasElectricalExperience) return false;
  return s.electricalQualificationLevel === "level_2"
      || s.electricalQualificationLevel === "level_3";
};

// Affordability -------------------------------------------------------------

const evaluateAffordability = (
  routeId: ElectricianRouteId,
  s: ElectricianSignals,
): AffordabilityReport => {
  const budget = s.trainingBudgetBand;
  switch (routeId) {
    case "apprenticeship":
      // Apprenticeships pay a wage and are funded by the employer/government.
      return {
        affordable: true,
        notes: [
          "Apprenticeships are paid roles — you earn while training and course fees are covered.",
        ],
      };
    case "college_then_workplace_experience": {
      const notes: string[] = [
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
      const notes: string[] = [
        "Experienced-worker assessment fees are usually in the low thousands and normally self-funded.",
      ];
      if (budget === "free_only" || budget === "up_to_500" || budget === "500_to_2000") {
        return {
          affordable: false,
          notes: [
            ...notes,
            "Your stated budget may not cover typical EWA assessment costs — confirm current fees with an approved assessment centre.",
          ],
        };
      }
      return { affordable: true, notes };
    }
  }
};

// Ranking -------------------------------------------------------------------

// Base score reflects fit before priorities/affordability apply.
const baseScore = (
  routeId: ElectricianRouteId,
  s: ElectricianSignals,
): number => {
  switch (routeId) {
    case "apprenticeship":
      // Strongest general-purpose route for most starting points.
      return 100
        + (s.startingPoint === "still_at_school" ? 10 : 0)
        + (s.startingPoint === "recently_left_education" ? 8 : 0)
        + (s.startingPoint === "career_changer" ? 4 : 0);
    case "college_then_workplace_experience":
      return 80
        + (s.hasRelatedTradeExperience ? 5 : 0)
        + (s.startingPoint === "career_changer" ? 6 : 0);
    case "experienced_worker_route":
      return 60 + (s.hasElectricalExperience ? 20 : 0);
  }
};

const priorityBonus = (
  routeId: ElectricianRouteId,
  priorities: string[],
): number => {
  let bonus = 0;
  if (priorities.includes("not_sure_yet")) return 0;
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

// Blockers/checks -----------------------------------------------------------

const routeBlockersAndChecks = (
  routeId: ElectricianRouteId,
  s: ElectricianSignals,
): string[] => {
  const out: string[] = [];
  if (routeId === "apprenticeship") {
    if (s.mathsEnglishStatus === "neither") {
      out.push(
        "Most apprenticeship providers require English and maths at level 2 (GCSE grade 4/C) or Functional Skills; you may need to complete these alongside or before starting.",
      );
    }
    if (s.mathsEnglishStatus === "international") {
      out.push(
        "Providers will need to see how your international qualifications map to English and maths at Level 2 — check with the training provider or UK ENIC.",
      );
    }
    if (s.travelRange === "local_no_car") {
      out.push(
        "Apprenticeship placements can span a wide area — check whether local employers hire apprentices you can reach without a car.",
      );
    }
  }
  if (routeId === "college_then_workplace_experience") {
    if (s.mathsEnglishStatus === "neither") {
      out.push(
        "Many colleges expect Level 2 maths and English for enrolment on Level 3 electrical courses.",
      );
    }
    out.push(
      "The NVQ Level 3 that follows the classroom course requires evidence of real on-site electrical work — plan how you'll access that placement.",
    );
  }
  if (routeId === "experienced_worker_route") {
    out.push(
      "You will need to evidence substantial recent electrical work — check the current EWA portfolio requirements.",
    );
  }
  return out;
};

const routeImmediateAction = (routeId: ElectricianRouteId): string => {
  switch (routeId) {
    case "apprenticeship":
      return "Search current electrical apprenticeship vacancies on the government's Find an Apprenticeship service and note the entry requirements for two employers you'd realistically apply to.";
    case "college_then_workplace_experience":
      return "Look up City & Guilds 2365 Level 2 courses at colleges within your travel range and note their next intake and entry requirements.";
    case "experienced_worker_route":
      return "Request the current Experienced Worker Assessment guidance from an approved assessment centre and start listing the electrical work you can evidence.";
  }
};

// Considerations from working_conditions_to_check --------------------------

const CONDITION_MESSAGES: Record<string, string> = {
  working_at_height:
    "You noted working at height as something to check. This is common in installation and rewiring work but less central in some maintenance roles — compare the working conditions before committing.",
  confined_spaces:
    "You noted working in confined spaces as something to check. Some domestic and industrial work involves lofts, ducts or plant rooms — ask employers about the mix of work involved.",
  lifting_bending:
    "You noted regular lifting, bending or kneeling as something to check. Ask a working electrician about typical physical demands on the routes you're considering.",
  outdoor_or_dusty:
    "You noted noisy, dusty or outdoor environments as something to check. Site work often involves these; smaller domestic work can be quieter — compare before committing.",
  early_or_travel:
    "You noted early starts or travelling between sites as something to check. Site-based routes usually involve both — confirm what a typical week looks like for the employers you're considering.",
  need_more_info:
    "You said you need more information about the working conditions — a taster day, work experience, or a call with an approved training provider can give you a realistic picture before committing.",
};

const buildConsiderations = (s: ElectricianSignals): string[] => {
  const conditions = s.workingConditionsToCheck.filter((c) => c !== "none");
  return conditions
    .map((c) => CONDITION_MESSAGES[c])
    .filter((m): m is string => !!m);
};

// Outcome precedence -------------------------------------------------------

const VERIFICATION_LEVELS = new Set([
  "older_unknown",
  "international",
  "unknown_level",
]);

// Signals that must be present for the engine to reach a confident route
// decision. Deliberately narrow — budget, travel, priorities and working
// conditions never cause insufficient_information.
const CRITICAL_SIGNALS: readonly (keyof ElectricianSignals)[] = [
  "startingPoint",
  "electricalQualificationLevel",
  "mathsEnglishStatus",
  "availableTrainingPatterns",
];

const missingCriticalSignals = (s: ElectricianSignals): string[] => {
  const missing: string[] = [];
  if (!s.startingPoint) missing.push("starting_point");
  if (!s.electricalQualificationLevel) missing.push("electrical_qualification");
  if (!s.mathsEnglishStatus) missing.push("maths_english_status");
  if (!s.availableTrainingPatterns.length) missing.push("training_availability");
  return missing;
};

// Main entry point ---------------------------------------------------------

export const runElectricianEngine = (
  input: ElectricianEngineInput,
): ElectricianEngineOutput => {
  const { signals: s } = input;
  const considerations = buildConsiderations(s);

  // 1. Qualification cannot be classified → verification required.
  if (
    s.electricalQualificationLevel &&
    VERIFICATION_LEVELS.has(s.electricalQualificationLevel)
  ) {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        "We can't safely classify your existing electrical qualification without verification. Older UK qualifications may be superseded, and international qualifications need mapping to current UK requirements.",
      ],
      immediateAction:
        "Ask a JIB-approved training provider or an EAL/City & Guilds approved centre to review your existing qualification and confirm what it maps to in the current UK system.",
      evidenceNotes: [
        "UK Electrotechnical requirements are set by the Joint Industry Board (JIB) and awarding bodies EAL and City & Guilds; equivalency is decided by them, not by self-report.",
      ],
      routeEvaluations: [],
      missingSignals: [],
    };
  }

  // 2. Missing critical signals → insufficient information.
  const missing = missingCriticalSignals(s);
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

  // 3. Evaluate route eligibility (independent of budget and priorities).
  const routeIds: ElectricianRouteId[] = [
    "apprenticeship",
    "college_then_workplace_experience",
    "experienced_worker_route",
  ];

  const eligibilityFns: Record<ElectricianRouteId, (s: ElectricianSignals) => boolean> = {
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

  // 4. No eligible route → bridging required.
  if (eligible.length === 0) {
    const bridgingAction =
      !s.availableTrainingPatterns.length
        ? "Identify at least one training pattern you could commit to for a year, then come back — most routes need some regular weekday or evening availability."
        : s.availableTrainingPatterns.every((p) => p === "weekends" || p === "availability_varies" || p === "not_sure_yet")
        ? "Weekend-only or highly variable availability rules out most current electrical training patterns. Explore whether you could restructure to include some weekday hours, or start with a short introductory course."
        : "Contact an approved training provider (e.g. via the JIB) and ask which single next step would open the routes closest to your situation.";

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
        "Bridging steps commonly used: short introductory electrical courses; Functional Skills to plug English/maths gaps; changes to availability that unlock apprenticeship applications.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
    };
  }

  // 5. route_recommended — rank all eligible routes; affordability affects
  // rank but does not remove routes from the comparison.
  const ranked = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
  const best = ranked[0];
  const alternatives = ranked.slice(1);

  const affordabilityNotes = ranked.flatMap((r) => r.affordability.notes);
  const evidenceNotes = ranked.map((r) => r.evidenceNote);

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alternatives.map((r) => r.id),
    affordabilityNotes,
    considerations,
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes,
    // Include every evaluated route (eligible + ineligible) so tests and the
    // UI can inspect why routes were dropped. Ranked ordering places eligible
    // routes first.
    routeEvaluations: [...ranked, ...evaluations.filter((e) => !e.eligible)],
    missingSignals: [],
  };
};

export const ROUTE_DISPLAY_TITLES = ROUTE_TITLES;
