// Deno mirror of src/lib/reality-check/route-engines/police-officer.ts.
// Parity is enforced by shared/reality-check/police-officer-cases.json.

import { policeOfficerFlavor } from "./_police_officer_flavor.ts";
import type { ModularPayload, ModularRouteCard } from "./_modular_payload.ts";
import { buildModularPayload } from "./_modular_payload.ts";

type RouteId =
  | "police_constable_entry_programme"
  | "police_constable_degree_apprenticeship"
  | "degree_holder_entry_programme"
  | "professional_policing_degree_then_apply"
  | "feeder_public_service_route"
  | "police_rejoiner_route";

type Status =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

interface Signals {
  startingPoint: string | null;
  highestQualification: string | null;
  englishMathsStatus: string | null;
  currentPublicServiceExperience: string | null;
  routePreference: string | null;
  studyPatternAvailable: string | null;
  regionAvailability: string | null;
  checks_before_applying: string[];
  priority: string | null;
}

interface RouteEval {
  id: RouteId;
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
  recommendedRouteId: RouteId | null;
  alternativeRouteIds: RouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: RouteEval[];
  missingSignals: string[];
  verificationPrimaryRouteId: RouteId | null;
  mayOpenLaterRouteIds: RouteId[];
  isInternationalVerification: boolean;
}

const TITLES: Record<RouteId, string> = {
  police_constable_entry_programme: "Police Constable Entry Programme (PCEP) / direct force application",
  police_constable_degree_apprenticeship: "Police Constable Degree Apprenticeship (PCDA)",
  degree_holder_entry_programme: "Degree Holder Entry Programme (DHEP)",
  professional_policing_degree_then_apply: "Professional Policing Degree, then apply",
  feeder_public_service_route: "Build eligibility via a public-service feeder role",
  police_rejoiner_route: "Police rejoiner — force-specific check",
};

const EVIDENCE: Record<RouteId, string> = {
  police_constable_entry_programme: "PCEP / direct application requires Level 3 or force-accepted equivalent.",
  police_constable_degree_apprenticeship: "PCDA is a paid degree apprenticeship. Force decides availability.",
  degree_holder_entry_programme: "DHEP is offered by some forces for degree holders.",
  professional_policing_degree_then_apply: "Self-funded pre-join degree, then separate force application.",
  feeder_public_service_route: "Force decides what counts as equivalent experience.",
  police_rejoiner_route: "Rejoiner criteria are set by each force.",
};

const AFF: Record<RouteId, string> = {
  police_constable_entry_programme: "Paid role from day one — training is force-funded.",
  police_constable_degree_apprenticeship: "Paid — employer-funded via the apprenticeship levy.",
  degree_holder_entry_programme: "Paid role from day one — training on the job.",
  professional_policing_degree_then_apply: "Self-funded degree — check student finance eligibility.",
  feeder_public_service_route: "Feeder roles may be paid or volunteer — confirm with the employer.",
  police_rejoiner_route: "Paid role from day one.",
};

export const ENGLAND_WALES_SCOPE_NOTE =
  "This checker is for police constable routes in England and Wales. Police Scotland and PSNI have separate recruitment routes and are out of scope for v1. Detective and specialist-entry routes are also out of scope for v1.";

const LEVEL_3_QUALS = new Set([
  "a_level_or_level_3",
  "professional_policing_degree",
  "bachelors_any_subject",
  "masters_plus",
]);
const LEVEL_3_EXP = new Set([
  "pcso",
  "special_constable",
  "armed_forces",
  "prison_border_security_or_emergency_services",
  "other_relevant_public_service",
]);

const hasLevel3OrEquivalent = (s: Signals) =>
  (s.highestQualification !== null && LEVEL_3_QUALS.has(s.highestQualification)) ||
  (s.currentPublicServiceExperience !== null &&
    LEVEL_3_EXP.has(s.currentPublicServiceExperience));

const hasDegree = (s: Signals) =>
  s.highestQualification === "bachelors_any_subject" ||
  s.highestQualification === "masters_plus";

const englishMathsMet = (s: Signals) =>
  s.englishMathsStatus === "english_and_maths_met";

const isPCEP = (s: Signals) =>
  englishMathsMet(s) && hasLevel3OrEquivalent(s) &&
  (
    s.routePreference === "fastest_application_route" ||
    s.routePreference === "not_sure" ||
    s.studyPatternAvailable === "work_based_training_preferred" ||
    s.studyPatternAvailable === "need_to_keep_earning" ||
    s.studyPatternAvailable === "flexible"
  );

const isPCDA = (s: Signals) =>
  englishMathsMet(s) && hasLevel3OrEquivalent(s) && !hasDegree(s) &&
  (
    s.routePreference === "earn_while_training" ||
    s.priority === "avoid_student_debt" ||
    s.priority === "keep_earning_while_training" ||
    s.studyPatternAvailable === "work_based_training_preferred" ||
    s.studyPatternAvailable === "need_to_keep_earning"
  );

const isDHEP = (s: Signals) =>
  englishMathsMet(s) && hasDegree(s) &&
  s.highestQualification !== "professional_policing_degree" &&
  (
    s.routePreference === "fastest_application_route" ||
    s.routePreference === "not_sure" ||
    s.priority === "graduate_as_fast_as_possible"
  );

const isProfDegree = (s: Signals) =>
  englishMathsMet(s) &&
  s.highestQualification === "a_level_or_level_3" &&
  s.studyPatternAvailable === "full_time_study_possible" &&
  (s.routePreference === "degree_first" || s.routePreference === "not_sure") &&
  (s.priority === "structured_academic_route" || s.priority === "not_sure");

const isFeeder = (s: Signals) =>
  englishMathsMet(s) &&
  s.highestQualification !== "international" &&
  s.highestQualification !== "unknown" &&
  (
    (!hasLevel3OrEquivalent(s) && s.highestQualification === "gcse") ||
    (s.currentPublicServiceExperience === "none" &&
      (s.startingPoint === "school_leaver" || s.startingPoint === "career_changer"))
  );

const isRejoiner = (s: Signals) => s.startingPoint === "former_police_officer";

const baseScore = (id: RouteId): number => {
  switch (id) {
    case "police_constable_entry_programme": return 92;
    case "police_constable_degree_apprenticeship": return 94;
    case "degree_holder_entry_programme": return 96;
    case "professional_policing_degree_then_apply": return 88;
    case "feeder_public_service_route": return 80;
    case "police_rejoiner_route": return 100;
  }
};

const priorityBonus = (id: RouteId, s: Signals): number => {
  let b = 0;
  if (s.priority === "avoid_student_debt" || s.priority === "keep_earning_while_training") {
    if (id === "police_constable_degree_apprenticeship") b += 12;
    if (id === "police_constable_entry_programme") b += 6;
  }
  if (s.priority === "graduate_as_fast_as_possible") {
    if (id === "degree_holder_entry_programme") b += 10;
    if (id === "police_constable_entry_programme") b += 6;
  }
  if (s.priority === "structured_academic_route" && id === "professional_policing_degree_then_apply") b += 12;
  if (s.routePreference === "earn_while_training" && id === "police_constable_degree_apprenticeship") b += 10;
  if (s.routePreference === "degree_first" && id === "professional_policing_degree_then_apply") b += 10;
  if (s.routePreference === "fastest_application_route") {
    if (id === "police_constable_entry_programme") b += 6;
    if (id === "degree_holder_entry_programme") b += 6;
  }
  return b;
};

const blockers = (id: RouteId): string[] => {
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

const immediate = (id: RouteId): string => {
  switch (id) {
    case "police_constable_entry_programme": return "Check the Joining the Police PCEP / direct application page and shortlist two forces recruiting now.";
    case "police_constable_degree_apprenticeship": return "Check the Joining the Police PCDA page and confirm which forces are running a PCDA cohort you can apply to.";
    case "degree_holder_entry_programme": return "Check the Joining the Police DHEP page and confirm two forces near you are running a DHEP cohort.";
    case "professional_policing_degree_then_apply": return "Shortlist two Professional Policing Degree providers from the College of Policing recognised list and confirm entry requirements.";
    case "feeder_public_service_route": return "Apply for a Special Constable or PCSO role with a force in your region as a first move — treat it as experience-building, not an automatic route.";
    case "police_rejoiner_route": return "Contact the recruiting force's rejoiner team directly and ask which routes are open based on your prior service and length of break.";
  }
};

const critical = (s: Signals): string[] => {
  const m: string[] = [];
  if (!s.startingPoint) m.push("starting_point");
  if (!s.highestQualification) m.push("highest_qualification");
  if (!s.englishMathsStatus) m.push("english_maths_status");
  if (!s.currentPublicServiceExperience) m.push("current_public_service_experience");
  if (!s.routePreference) m.push("route_preference");
  if (!s.studyPatternAvailable) m.push("study_pattern_available");
  return m;
};

export function runPoliceOfficerEngine(input: { signals: Signals }): EngineOutput {
  const s = input.signals;
  const missing = critical(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: [`We need answers on: ${missing.join(", ")} before we can compare police constable routes.`],
      immediateAction: "Go back and complete the outstanding questions so we can compare structural routes for you.",
      evidenceNotes: [], routeEvaluations: [], missingSignals: missing,
      verificationPrimaryRouteId: null, mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  const ids: RouteId[] = [
    "police_constable_entry_programme",
    "police_constable_degree_apprenticeship",
    "degree_holder_entry_programme",
    "professional_policing_degree_then_apply",
    "feeder_public_service_route",
    "police_rejoiner_route",
  ];
  const eligFns: Record<RouteId, (s: Signals) => boolean> = {
    police_constable_entry_programme: isPCEP,
    police_constable_degree_apprenticeship: isPCDA,
    degree_holder_entry_programme: isDHEP,
    professional_policing_degree_then_apply: isProfDegree,
    feeder_public_service_route: isFeeder,
    police_rejoiner_route: isRejoiner,
  };
  const evals: RouteEval[] = ids.map((id) => {
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

  if (s.startingPoint === "former_police_officer") {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["You were previously a UK police officer. Rejoiner criteria are set by each force — that check comes before any training route."],
      immediateAction: "Contact the recruiting force's rejoiner team directly and ask which routes are open based on your prior service and length of break.",
      evidenceNotes: ["Rejoiner criteria are force-specific. Prior service, length of break and current fitness are all decided by the recruiting force."],
      routeEvaluations: evals, missingSignals: [],
      verificationPrimaryRouteId: "police_rejoiner_route",
      mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  if (s.highestQualification === "international") {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["UK forces need to see how your qualification maps to a UK Level 3 or equivalent before a police constable route can be compared. Qualification equivalence is a check, not a training route."],
      immediateAction: "Check your qualification equivalence with UK ENIC, then contact the recruiting force to confirm which routes are open to you.",
      evidenceNotes: ["UK ENIC issues Statements of Comparability that map international qualifications to UK levels. The recruiting force decides which routes are open to you on the basis of the check."],
      routeEvaluations: evals, missingSignals: [],
      verificationPrimaryRouteId: null,
      mayOpenLaterRouteIds: [],
      isInternationalVerification: true,
    };
  }

  if (s.highestQualification === "unknown") {
    return {
      status: "insufficient_information",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["We need your highest qualification level before comparing police constable routes."],
      immediateAction: "Confirm your highest completed qualification and update your answer.",
      evidenceNotes: [], routeEvaluations: evals, missingSignals: ["highest_qualification"],
      verificationPrimaryRouteId: null, mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }
  if (s.englishMathsStatus === "not_sure") {
    return {
      status: "insufficient_information",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["We need to know whether you have English and maths at GCSE grade 4/C or equivalent before comparing police constable routes."],
      immediateAction: "Confirm your English and maths position and update your answer.",
      evidenceNotes: [], routeEvaluations: evals, missingSignals: ["english_maths_status"],
      verificationPrimaryRouteId: null, mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  const gap = s.englishMathsStatus === "neither_met" || s.englishMathsStatus === "one_missing";
  const lowQual = (s.highestQualification === "none" || s.highestQualification === "gcse") && !hasLevel3OrEquivalent(s);
  if (gap || lowQual) {
    return {
      status: "bridging_required",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: [
        gap
          ? "You'll need GCSE English and maths at grade 4/C (or an accepted equivalent) before comparing police constable routes."
          : "You'll need a UK Level 3 (e.g. A-levels) or force-accepted equivalent experience before PCEP, PCDA or a degree route becomes directly recommendable.",
      ],
      immediateAction: gap
        ? "Enrol on a Functional Skills or GCSE course to close the English/maths gap, then re-run this checker."
        : "Consider a Level 3 route (e.g. A-levels, T Level, BTEC) or apply for a Special Constable / PCSO role as an experience-building first move.",
      evidenceNotes: ["Level 3 or force-accepted equivalent experience is a common entry expectation for PCEP and PCDA. Each force publishes its own eligibility criteria."],
      routeEvaluations: evals, missingSignals: [],
      verificationPrimaryRouteId: null, mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  const eligible = evals.filter((r) =>
    r.eligible && r.id !== "police_rejoiner_route" && r.id !== "feeder_public_service_route",
  );
  if (eligible.length === 0) {
    return {
      status: "bridging_required",
      recommendedRouteId: null, alternativeRouteIds: [], affordabilityNotes: [], considerations: [],
      blockersAndChecks: ["None of the standard police constable routes are directly open from your current answers — a bridging step or route-preference change is needed first."],
      immediateAction: "Revisit your route preference or study-pattern answer, or consider a Special Constable / PCSO first move.",
      evidenceNotes: [], routeEvaluations: evals, missingSignals: [],
      verificationPrimaryRouteId: null, mayOpenLaterRouteIds: [],
      isInternationalVerification: false,
    };
  }

  const ranked = pickPrimaryAndBackup(eligible, s);
  const best = ranked[0];
  const alt = ranked.slice(1);
  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alt.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations: [],
    blockersAndChecks: best.blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [...ranked, ...evals.filter((e) => !ranked.includes(e))],
    missingSignals: [],
    verificationPrimaryRouteId: null,
    mayOpenLaterRouteIds: [],
    isInternationalVerification: false,
  };
}

function pickPrimaryAndBackup(eligible: RouteEval[], s: Signals): RouteEval[] {
  const byId = new Map(eligible.map((r) => [r.id, r] as const));
  const pcep = byId.get("police_constable_entry_programme");
  const pcda = byId.get("police_constable_degree_apprenticeship");
  const dhep = byId.get("degree_holder_entry_programme");
  const prof = byId.get("professional_policing_degree_then_apply");
  const order = (ids: (RouteId | undefined)[]): RouteEval[] =>
    ids.map((id) => (id ? byId.get(id) : undefined)).filter((r): r is RouteEval => r !== undefined);
  if (hasDegree(s) && dhep) return order(["degree_holder_entry_programme", "police_constable_entry_programme"]);
  if ((s.routePreference === "earn_while_training" || s.priority === "avoid_student_debt" || s.priority === "keep_earning_while_training") && pcda) {
    return order(["police_constable_degree_apprenticeship", "police_constable_entry_programme"]);
  }
  if (s.routePreference === "degree_first" && s.studyPatternAvailable === "full_time_study_possible" && prof) {
    return order(["professional_policing_degree_then_apply", "police_constable_entry_programme"]);
  }
  if (pcep) return order(["police_constable_entry_programme", "police_constable_degree_apprenticeship"]);
  return [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
}

function card(ev: RouteEval, kind: ModularRouteCard["kind"], fit: string): ModularRouteCard {
  return {
    kind, title: ev.displayTitle, fit,
    constraint: ev.blockersAndChecks[0] ?? "Confirm eligibility criteria with the recruiting force before applying.",
    checks: ev.blockersAndChecks.slice(0, 3),
    timeCaveat: policeOfficerFlavor.timeCaveats[ev.id],
    costCaveat: policeOfficerFlavor.costCaveats[ev.id],
    patternCaveat: policeOfficerFlavor.patternCaveats[ev.id],
    nextAction: ev.immediateAction,
    affordable: ev.affordability.affordable,
  };
}

function buildVerificationPayload(out: EngineOutput): ModularPayload {
  const routes: ModularRouteCard[] = [];
  if (!out.isInternationalVerification && out.verificationPrimaryRouteId) {
    const primary = out.routeEvaluations.find((r) => r.id === out.verificationPrimaryRouteId);
    if (primary) routes.push(card(primary, "investigate_after_check", policeOfficerFlavor.investigateAfterCheckFit));
  }
  for (const id of out.mayOpenLaterRouteIds) {
    const ev = out.routeEvaluations.find((r) => r.id === id);
    if (ev) routes.push(card(ev, "may_open_later", policeOfficerFlavor.mayOpenLaterFit));
  }
  return {
    status: "qualification_verification_required",
    headline: out.isInternationalVerification
      ? "Your qualification needs a formal equivalence check before any UK police constable route can be compared. Equivalence is a check, not a training route."
      : "A force-specific check is needed before a UK police constable route can be confirmed. Verification is a step, not a training route.",
    routes,
    checksBeforeCommitting: [...out.blockersAndChecks, ENGLAND_WALES_SCOPE_NOTE],
  };
}

function buildModularForPolice(out: EngineOutput): ModularPayload {
  if (out.status === "qualification_verification_required") return buildVerificationPayload(out);
  const base = buildModularPayload(out, policeOfficerFlavor);
  if (out.status === "insufficient_information") return base;
  return { ...base, checksBeforeCommitting: [...base.checksBeforeCommitting, ENGLAND_WALES_SCOPE_NOTE] };
}

export function buildPoliceOfficerResult(input: { signals: Signals }) {
  const out = runPoliceOfficerEngine(input);
  const readiness = out.status === "route_recommended" ? "ready_now"
    : out.status === "insufficient_information" ? "nearly_ready" : "needs_bridging";
  const overall = readiness === "ready_now" ? "Realistic"
    : readiness === "nearly_ready" ? "Realistic but hard" : "Long shot";
  const bestEval = out.recommendedRouteId ? out.routeEvaluations.find((r) => r.id === out.recommendedRouteId) : undefined;
  const altEval = out.alternativeRouteIds[0] ? out.routeEvaluations.find((r) => r.id === out.alternativeRouteIds[0]) : undefined;
  const bestRoute = bestEval
    ? {
        title: bestEval.displayTitle,
        summary: "This appears to be the strongest structural route from your answers. Final eligibility is decided by the recruiting force during recruitment.",
        whyThisFits: ["This route appears structurally relevant to your situation — it is not a promise of a police constable role."],
        estimatedTime: policeOfficerFlavor.timeCaveats[bestEval.id] ?? "Depends on the force",
        likelyCost: policeOfficerFlavor.costCaveats[bestEval.id] ?? "Confirm current costs with the force or provider before committing",
        mainDifficulty: bestEval.blockersAndChecks[0] ?? "Confirm eligibility criteria with the recruiting force before applying.",
        confidence: "medium",
      }
    : {
        title: out.status === "qualification_verification_required"
          ? "A formal check is needed before a UK police constable route can be confirmed"
          : out.status === "bridging_required"
            ? "A bridging step is needed before the standard police constable routes open"
            : "We need a few more answers before comparing police constable routes",
        summary: out.status === "qualification_verification_required"
          ? "The recruiting force (or UK ENIC for qualification equivalence) is the authority for this check. The step below is the next concrete action — it is not a training route in itself."
          : out.status === "bridging_required"
            ? "None of the standard police constable routes are directly open from your current situation. The step below is the bridging action, not a route."
            : "Some critical answers are missing. Complete them and we'll compare routes for you.",
        whyThisFits: [] as string[],
        estimatedTime: "Depends on the outcome of the step below",
        likelyCost: "Depends on the outcome of the step below",
        mainDifficulty: out.blockersAndChecks[0] ?? "",
        confidence: "low",
      };
  const backupRoute = altEval
    ? {
        title: altEval.displayTitle,
        summary: "A second structurally relevant route from your answers. Compare it against the recommended route and confirm the force is running it this cycle.",
        tradeOff: "Different timeline and delivery model — see the caveats and blockers notes.",
      }
    : { title: "No secondary route from your current answers", summary: "Only one route was structurally relevant from what you told us.", tradeOff: "" };
  return {
    readiness,
    readinessReason:
      out.status === "route_recommended"
        ? "Your answers point to at least one structurally relevant UK police constable route. Final eligibility is decided by the recruiting force."
        : out.status === "qualification_verification_required"
          ? out.isInternationalVerification
            ? "A qualification-equivalence check is needed before a UK police constable route can be compared."
            : "A force-specific check is needed before a UK police constable route can be confirmed."
          : out.status === "bridging_required"
            ? "None of the standard UK police constable routes are directly open from your current situation — a bridging step is needed first."
            : "We need a few more answers before we can compare police constable routes.",
    biggestBlocker: out.blockersAndChecks[0] ?? "No single structural blocker stood out from what you told us.",
    immediateAction: out.immediateAction,
    overallVerdict: overall,
    bestRoute, backupRoute,
    routeToAvoid: {
      title: "Applying without checking force-specific criteria",
      whyRisky: "Forces publish their own eligibility criteria, cohort dates and route availability. Applying to whichever force opens recruitment first — without checking their criteria — is the most common wasted application.",
      whenItMightWork: "Rarely. Even a strong candidate should read the recruiting force's own eligibility criteria and cohort availability before submitting an application.",
    },
    firstMoves: [out.immediateAction, "Check the recruiting force's own eligibility criteria and current cohort availability before applying."].slice(0, 3),
    modular: buildModularForPolice(out),
  };
}
