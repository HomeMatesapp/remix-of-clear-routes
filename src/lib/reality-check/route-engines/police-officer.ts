// Police Officer deterministic route engine — v1.
//
// Runtime-neutral. Deno mirror at supabase/functions/reality-check/_police_officer.ts
// kept identical via shared/reality-check/police-officer-cases.json.
//
// Contract (per Design Brief v4):
//   - Six real route/path IDs. `qualification_verification_required` is a
//     status, never a route ID. No fake `qualification_equivalence_check` id.
//   - Gate order (top-down):
//       1. missing critical signals → insufficient_information
//       2. startingPoint == former_police_officer → verification (rejoiner)
//       3. highestQualification == international → verification (no card ID
//          fabrication; equivalence lives in blockers/evidence)
//       4. highestQualification == unknown OR englishMathsStatus == not_sure
//          → insufficient_information
//       5. English/maths gap OR (gcse/none AND !hasLevel3OrEquivalent)
//          → bridging_required
//       6. otherwise evaluate route predicates → route_recommended
//   - PCEP / PCDA require englishMathsMet AND hasLevel3OrEquivalent.
//     GCSE alone never makes PCEP or PCDA directly recommendable.
//   - Professional Policing Degree route requires a_level_or_level_3 +
//     full_time_study_possible + degree_first/not_sure preference.
//   - DHEP is not primary just because the user holds a Professional
//     Policing Degree.
//   - `checks_before_applying` never affects eligibility.
//   - Detective / specialist-entry routes: not implemented, not surfaced.
//   - England & Wales only; scope note is enforced in the questionnaire
//     scopeNote and the adapter methodology copy.

import type {
  PoliceOfficerHighestQualification,
  PoliceOfficerPublicServiceExperience,
  PoliceOfficerSignals,
} from "../questionnaire/signals";

export type PoliceOfficerRouteId =
  | "police_constable_entry_programme"
  | "police_constable_degree_apprenticeship"
  | "degree_holder_entry_programme"
  | "professional_policing_degree_then_apply"
  | "feeder_public_service_route"
  | "police_rejoiner_route";

export type PoliceOfficerOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export interface PoliceOfficerRouteEvaluation {
  id: PoliceOfficerRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: { affordable: boolean; notes: string[] };
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface PoliceOfficerEngineOutput {
  status: PoliceOfficerOutcomeStatus;
  recommendedRouteId: PoliceOfficerRouteId | null;
  alternativeRouteIds: PoliceOfficerRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: PoliceOfficerRouteEvaluation[];
  missingSignals: string[];
  verificationPrimaryRouteId: PoliceOfficerRouteId | null;
  mayOpenLaterRouteIds: PoliceOfficerRouteId[];
  /** True when the verification path is international-qualification —
   *  the adapter must render NO route card (equivalence is a check, not a
   *  route). Nurse-parity `verificationPrimaryRouteId` is null in this
   *  case. */
  isInternationalVerification: boolean;
}

export interface PoliceOfficerEngineInput {
  signals: PoliceOfficerSignals;
  region?: string | null;
  serviceLevel?: string | null;
  role?: { role_slug?: string; role_name?: string } | null;
}

export const ROUTE_TITLES: Record<PoliceOfficerRouteId, string> = {
  police_constable_entry_programme:
    "Police Constable Entry Programme (PCEP) / direct force application",
  police_constable_degree_apprenticeship:
    "Police Constable Degree Apprenticeship (PCDA)",
  degree_holder_entry_programme:
    "Degree Holder Entry Programme (DHEP)",
  professional_policing_degree_then_apply:
    "Professional Policing Degree, then apply",
  feeder_public_service_route:
    "Build eligibility via a public-service feeder role",
  police_rejoiner_route:
    "Police rejoiner — force-specific check",
};

const EVIDENCE_NOTES: Record<PoliceOfficerRouteId, string> = {
  police_constable_entry_programme:
    "PCEP / direct application requires a UK Level 3 or force-accepted equivalent experience. Each force runs its own recruitment cycle.",
  police_constable_degree_apprenticeship:
    "PCDA is an employer-led degree apprenticeship — you earn a wage while training. Availability varies by force and cohort.",
  degree_holder_entry_programme:
    "DHEP is for degree holders where the force offers the route. Not every force runs DHEP every cycle.",
  professional_policing_degree_then_apply:
    "The Professional Policing Degree is a self-funded pre-join degree. You still apply to a force separately after graduating.",
  feeder_public_service_route:
    "Time in a Special Constable, PCSO or comparable public-service role can build experience some forces accept as equivalent. Force decides what counts — this is not an automatic progression.",
  police_rejoiner_route:
    "Rejoiner criteria are set by each force. Prior service, length of break and current fitness are all force decisions.",
};

// ── Helpers (fully parenthesised, named) ────────────────────────────────────

const LEVEL_3_QUALIFICATIONS: ReadonlySet<PoliceOfficerHighestQualification> =
  new Set([
    "a_level_or_level_3",
    "professional_policing_degree",
    "bachelors_any_subject",
    "masters_plus",
  ]);

const LEVEL_3_EQUIVALENT_EXPERIENCE: ReadonlySet<PoliceOfficerPublicServiceExperience> =
  new Set([
    "pcso",
    "special_constable",
    "armed_forces",
    "prison_border_security_or_emergency_services",
    "other_relevant_public_service",
  ]);

export const hasLevel3OrEquivalent = (s: PoliceOfficerSignals): boolean =>
  (s.highestQualification !== null &&
    LEVEL_3_QUALIFICATIONS.has(s.highestQualification)) ||
  (s.currentPublicServiceExperience !== null &&
    LEVEL_3_EQUIVALENT_EXPERIENCE.has(s.currentPublicServiceExperience));

export const hasDegree = (s: PoliceOfficerSignals): boolean =>
  s.highestQualification === "bachelors_any_subject" ||
  s.highestQualification === "masters_plus";

export const englishMathsMet = (s: PoliceOfficerSignals): boolean =>
  s.englishMathsStatus === "english_and_maths_met";

// ── Eligibility predicates (per §6, fully parenthesised) ────────────────────

const isPCEPEligible = (s: PoliceOfficerSignals): boolean =>
  englishMathsMet(s) &&
  hasLevel3OrEquivalent(s) &&
  (
    s.routePreference === "fastest_application_route" ||
    s.routePreference === "not_sure" ||
    s.studyPatternAvailable === "work_based_training_preferred" ||
    s.studyPatternAvailable === "need_to_keep_earning" ||
    s.studyPatternAvailable === "flexible"
  );

const isPCDAEligible = (s: PoliceOfficerSignals): boolean =>
  englishMathsMet(s) &&
  hasLevel3OrEquivalent(s) &&
  !hasDegree(s) &&
  (
    s.routePreference === "earn_while_training" ||
    s.priority === "avoid_student_debt" ||
    s.priority === "keep_earning_while_training" ||
    s.studyPatternAvailable === "work_based_training_preferred" ||
    s.studyPatternAvailable === "need_to_keep_earning"
  );

const isDHEPEligible = (s: PoliceOfficerSignals): boolean =>
  englishMathsMet(s) &&
  hasDegree(s) &&
  s.highestQualification !== "professional_policing_degree" &&
  (
    s.routePreference === "fastest_application_route" ||
    s.routePreference === "not_sure" ||
    s.priority === "graduate_as_fast_as_possible"
  );

const isProfessionalPolicingDegreeRouteEligible = (
  s: PoliceOfficerSignals,
): boolean =>
  englishMathsMet(s) &&
  s.highestQualification === "a_level_or_level_3" &&
  s.studyPatternAvailable === "full_time_study_possible" &&
  (s.routePreference === "degree_first" || s.routePreference === "not_sure") &&
  (s.priority === "structured_academic_route" || s.priority === "not_sure");

const isFeederRouteEligible = (s: PoliceOfficerSignals): boolean =>
  englishMathsMet(s) &&
  s.highestQualification !== "international" &&
  s.highestQualification !== "unknown" &&
  (
    (!hasLevel3OrEquivalent(s) && s.highestQualification === "gcse") ||
    (s.currentPublicServiceExperience === "none" &&
      (s.startingPoint === "school_leaver" ||
        s.startingPoint === "career_changer"))
  );

const isRejoinerEligible = (s: PoliceOfficerSignals): boolean =>
  s.startingPoint === "former_police_officer";

// ── Affordability ──────────────────────────────────────────────────────────

const AFFORDABILITY_NOTES: Record<PoliceOfficerRouteId, string> = {
  police_constable_entry_programme:
    "PCEP / direct application is a paid role from day one — training is delivered by the force.",
  police_constable_degree_apprenticeship:
    "PCDA is paid — you earn a wage; tuition is employer-funded via the apprenticeship levy.",
  degree_holder_entry_programme:
    "DHEP is a paid entry role — training is delivered on the job.",
  professional_policing_degree_then_apply:
    "Self-funded degree — check student finance eligibility with the specific university.",
  feeder_public_service_route:
    "Feeder roles (Special Constable, PCSO, armed forces) may be paid, volunteer or a mix — check with the recruiting employer.",
  police_rejoiner_route:
    "Rejoiner routes are paid roles from day one — force decides the training top-up required.",
};

const affordabilityFor = (id: PoliceOfficerRouteId) => ({
  affordable: true,
  notes: [AFFORDABILITY_NOTES[id]],
});

// ── Ranking ─────────────────────────────────────────────────────────────────

const baseScore = (id: PoliceOfficerRouteId): number => {
  switch (id) {
    case "police_constable_entry_programme":         return 92;
    case "police_constable_degree_apprenticeship":   return 94;
    case "degree_holder_entry_programme":            return 96;
    case "professional_policing_degree_then_apply":  return 88;
    case "feeder_public_service_route":              return 80;
    case "police_rejoiner_route":                    return 100;
  }
};

const priorityBonus = (
  id: PoliceOfficerRouteId,
  s: PoliceOfficerSignals,
): number => {
  let b = 0;
  if (s.priority === "avoid_student_debt" || s.priority === "keep_earning_while_training") {
    if (id === "police_constable_degree_apprenticeship") b += 12;
    if (id === "police_constable_entry_programme") b += 6;
  }
  if (s.priority === "graduate_as_fast_as_possible") {
    if (id === "degree_holder_entry_programme") b += 10;
    if (id === "police_constable_entry_programme") b += 6;
  }
  if (s.priority === "structured_academic_route") {
    if (id === "professional_policing_degree_then_apply") b += 12;
  }
  if (s.routePreference === "earn_while_training") {
    if (id === "police_constable_degree_apprenticeship") b += 10;
  }
  if (s.routePreference === "degree_first") {
    if (id === "professional_policing_degree_then_apply") b += 10;
  }
  if (s.routePreference === "fastest_application_route") {
    if (id === "police_constable_entry_programme") b += 6;
    if (id === "degree_holder_entry_programme") b += 6;
  }
  return b;
};

// ── Blockers / immediate action ─────────────────────────────────────────────

const routeBlockers = (id: PoliceOfficerRouteId): string[] => {
  switch (id) {
    case "police_constable_entry_programme":
      return [
        "PCEP / direct application requires a UK Level 3 or force-accepted equivalent. Confirm with the force which qualifications and experience they accept.",
        "Final eligibility is confirmed by the individual force during recruitment. Vetting, fitness and medical standards are checked at that stage.",
      ];
    case "police_constable_degree_apprenticeship":
      return [
        "PCDA requires a UK Level 3 or force-accepted equivalent and an active PCDA cohort at your chosen force. Check current openings before assuming availability.",
        "Final eligibility is confirmed by the individual force during recruitment. Vetting, fitness and medical standards are checked at that stage.",
      ];
    case "degree_holder_entry_programme":
      return [
        "DHEP is offered by some but not all forces. Confirm the force runs a DHEP cohort you can apply to.",
        "Final eligibility is confirmed by the individual force during recruitment. Vetting, fitness and medical standards are checked at that stage.",
      ];
    case "professional_policing_degree_then_apply":
      return [
        "The Professional Policing Degree is a pre-join self-funded degree. You still need to apply to a force separately after graduating.",
        "Confirm the specific degree is on the College of Policing recognised pre-join list before enrolling.",
      ];
    case "feeder_public_service_route":
      return [
        "Time in a Special Constable, PCSO or comparable public-service role can build the kind of experience some forces accept as equivalent to Level 3. It is not an automatic route into a constable role — forces decide what counts.",
      ];
    case "police_rejoiner_route":
      return [
        "Rejoiner criteria are set by each force. You'll need to check directly with the recruiting force whether your prior service and length of break qualify you for a rejoiner route.",
      ];
  }
};

const routeImmediate = (id: PoliceOfficerRouteId): string => {
  switch (id) {
    case "police_constable_entry_programme":
      return "Check the Joining the Police PCEP / direct application page and shortlist two forces recruiting now.";
    case "police_constable_degree_apprenticeship":
      return "Check the Joining the Police PCDA page and confirm which forces are running a PCDA cohort you can apply to.";
    case "degree_holder_entry_programme":
      return "Check the Joining the Police DHEP page and confirm two forces near you are running a DHEP cohort.";
    case "professional_policing_degree_then_apply":
      return "Shortlist two Professional Policing Degree providers from the College of Policing recognised list and confirm entry requirements.";
    case "feeder_public_service_route":
      return "Apply for a Special Constable or PCSO role with a force in your region as a first move — treat it as experience-building, not an automatic route.";
    case "police_rejoiner_route":
      return "Contact the recruiting force's rejoiner team directly and ask which routes are open based on your prior service and length of break.";
  }
};

// ── Critical missing signals ────────────────────────────────────────────────

const CRITICAL_MISSING = (s: PoliceOfficerSignals): string[] => {
  const m: string[] = [];
  if (!s.startingPoint) m.push("starting_point");
  if (!s.highestQualification) m.push("highest_qualification");
  if (!s.englishMathsStatus) m.push("english_maths_status");
  if (!s.currentPublicServiceExperience) m.push("current_public_service_experience");
  if (!s.routePreference) m.push("route_preference");
  if (!s.studyPatternAvailable) m.push("study_pattern_available");
  return m;
};

// ── Main entry point ────────────────────────────────────────────────────────

export const runPoliceOfficerEngine = (
  input: PoliceOfficerEngineInput,
): PoliceOfficerEngineOutput => {
  const s = input.signals;

  // 1. Missing critical signals.
  const missing = CRITICAL_MISSING(s);
  if (missing.length > 0) {
    return baseInsufficient(missing, [
      `We need answers on: ${missing.join(", ")} before we can compare police constable routes.`,
    ], "Go back and complete the outstanding questions so we can compare structural routes for you.");
  }

  // Evaluate all six routes up-front for route landscape visibility.
  const routeIds: PoliceOfficerRouteId[] = [
    "police_constable_entry_programme",
    "police_constable_degree_apprenticeship",
    "degree_holder_entry_programme",
    "professional_policing_degree_then_apply",
    "feeder_public_service_route",
    "police_rejoiner_route",
  ];
  const eligibilityFns: Record<
    PoliceOfficerRouteId,
    (s: PoliceOfficerSignals) => boolean
  > = {
    police_constable_entry_programme: isPCEPEligible,
    police_constable_degree_apprenticeship: isPCDAEligible,
    degree_holder_entry_programme: isDHEPEligible,
    professional_policing_degree_then_apply: isProfessionalPolicingDegreeRouteEligible,
    feeder_public_service_route: isFeederRouteEligible,
    police_rejoiner_route: isRejoinerEligible,
  };
  const evaluations: PoliceOfficerRouteEvaluation[] = routeIds.map((id) => {
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

  // 2. Former officer → verification (rejoiner). Takes precedence.
  if (s.startingPoint === "former_police_officer") {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "You were previously a UK police officer. Rejoiner criteria are set by each force — that check comes before any training route.",
      ],
      immediateAction:
        "Contact the recruiting force's rejoiner team directly and ask which routes are open based on your prior service and length of break.",
      evidenceNotes: [
        "Rejoiner criteria are force-specific. Prior service, length of break and current fitness are all decided by the recruiting force.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
      verificationPrimaryRouteId: "police_rejoiner_route",
      mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  // 3. International qualification → verification. NO route card fabricated.
  //    Equivalence lives in blockers/evidence. Plausible routes may appear
  //    only as may_open_later (§7 card-kind table).
  if (s.highestQualification === "international") {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "UK forces need to see how your qualification maps to a UK Level 3 or equivalent before a police constable route can be compared. Qualification equivalence is a check, not a training route.",
      ],
      immediateAction:
        "Check your qualification equivalence with UK ENIC, then contact the recruiting force to confirm which routes are open to you.",
      evidenceNotes: [
        "UK ENIC issues Statements of Comparability that map international qualifications to UK levels. The recruiting force decides which routes are open to you on the basis of the check.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
      verificationPrimaryRouteId: null,
      mayOpenLaterRouteIds: [],
      isInternationalVerification: true,
    };
  }

  // 4. Unknown qualification OR englishMathsStatus == not_sure →
  //    insufficient_information.
  if (s.highestQualification === "unknown") {
    return baseInsufficient(
      ["highest_qualification"],
      ["We need your highest qualification level before comparing police constable routes."],
      "Confirm your highest completed qualification and update your answer.",
      evaluations,
    );
  }
  if (s.englishMathsStatus === "not_sure") {
    return baseInsufficient(
      ["english_maths_status"],
      ["We need to know whether you have English and maths at GCSE grade 4/C or equivalent before comparing police constable routes."],
      "Confirm your English and maths position and update your answer.",
      evaluations,
    );
  }

  // 5. Bridging — English/maths gap OR (gcse/none AND no L3 equivalent).
  const englishMathsGap =
    s.englishMathsStatus === "neither_met" ||
    s.englishMathsStatus === "one_missing";
  const lowQualNoEquivalent =
    (s.highestQualification === "none" || s.highestQualification === "gcse") &&
    !hasLevel3OrEquivalent(s);
  if (englishMathsGap || lowQualNoEquivalent) {
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        englishMathsGap
          ? "You'll need GCSE English and maths at grade 4/C (or an accepted equivalent) before comparing police constable routes."
          : "You'll need a UK Level 3 (e.g. A-levels) or force-accepted equivalent experience before PCEP, PCDA or a degree route becomes directly recommendable.",
      ],
      immediateAction: englishMathsGap
        ? "Enrol on a Functional Skills or GCSE course to close the English/maths gap, then re-run this checker."
        : "Consider a Level 3 route (e.g. A-levels, T Level, BTEC) or apply for a Special Constable / PCSO role as an experience-building first move.",
      evidenceNotes: [
        "Level 3 or force-accepted equivalent experience is a common entry expectation for PCEP and PCDA. Each force publishes its own eligibility criteria.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
      verificationPrimaryRouteId: null,
      mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  // 6. route_recommended — pick primary/backup deterministically.
  const eligible = evaluations.filter(
    (r) =>
      r.eligible &&
      // Rejoiner is verification-only; never a recommended card.
      r.id !== "police_rejoiner_route" &&
      // Feeder is may_open_later territory, not a primary recommended card
      // once the user is already past bridging.
      r.id !== "feeder_public_service_route",
  );

  if (eligible.length === 0) {
    // Fall back to bridging semantics if no direct route resolves.
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "None of the standard police constable routes are directly open from your current answers — a bridging step or route-preference change is needed first.",
      ],
      immediateAction:
        "Revisit your route preference or study-pattern answer, or consider a Special Constable / PCSO first move.",
      evidenceNotes: [],
      routeEvaluations: evaluations,
      missingSignals: [],
      verificationPrimaryRouteId: null,
      mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  const ranked = pickPrimaryAndBackup(eligible, s);
  const best = ranked[0];
  const alternatives = ranked.slice(1);

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alternatives.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations: [],
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [
      ...ranked,
      ...evaluations.filter((e) => !ranked.includes(e)),
    ],
    missingSignals: [],
    verificationPrimaryRouteId: null,
    mayOpenLaterRouteIds: [],
    isInternationalVerification: false,
  };
};

const pickPrimaryAndBackup = (
  eligible: PoliceOfficerRouteEvaluation[],
  s: PoliceOfficerSignals,
): PoliceOfficerRouteEvaluation[] => {
  const byId = new Map(eligible.map((r) => [r.id, r] as const));
  const pcep = byId.get("police_constable_entry_programme");
  const pcda = byId.get("police_constable_degree_apprenticeship");
  const dhep = byId.get("degree_holder_entry_programme");
  const prof = byId.get("professional_policing_degree_then_apply");

  const order = (ids: (PoliceOfficerRouteId | undefined)[]) =>
    ids
      .map((id) => (id ? byId.get(id) : undefined))
      .filter((r): r is PoliceOfficerRouteEvaluation => r !== undefined);

  // 1. Degree holder → DHEP primary.
  if (hasDegree(s) && dhep) {
    return order([
      "degree_holder_entry_programme",
      "police_constable_entry_programme",
    ]);
  }
  // 2. Earn-while-training preference → PCDA primary.
  if (
    (s.routePreference === "earn_while_training" ||
      s.priority === "avoid_student_debt" ||
      s.priority === "keep_earning_while_training") &&
    pcda
  ) {
    return order([
      "police_constable_degree_apprenticeship",
      "police_constable_entry_programme",
    ]);
  }
  // 3. Degree-first preference + full-time study → Professional Policing Degree.
  if (
    s.routePreference === "degree_first" &&
    s.studyPatternAvailable === "full_time_study_possible" &&
    prof
  ) {
    return order([
      "professional_policing_degree_then_apply",
      "police_constable_entry_programme",
    ]);
  }
  // 4. Default → PCEP primary, PCDA backup if available.
  if (pcep) {
    return order([
      "police_constable_entry_programme",
      "police_constable_degree_apprenticeship",
    ]);
  }
  // Fallback: highest-ranked eligible route.
  return [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
};

const baseInsufficient = (
  missing: string[],
  blockers: string[],
  action: string,
  evaluations: PoliceOfficerRouteEvaluation[] = [],
): PoliceOfficerEngineOutput => ({
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
  verificationPrimaryRouteId: null,
  mayOpenLaterRouteIds: [],
  isInternationalVerification: false,
});
