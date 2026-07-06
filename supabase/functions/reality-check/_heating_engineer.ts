// Deno mirror of the Heating Engineer engine. The full rule table is
// duplicated here because Deno can't reach into ../../../src; parity is
// enforced by shared fixtures at
// /shared/reality-check/heating-engineer-cases.json.

import { buildModularPayload } from "./_modular_payload.ts";
import { heatingEngineerFlavor } from "./_heating_engineer_flavor.ts";


type RouteId =
  | "apprenticeship"
  | "college_then_workplace_experience"
  | "experienced_worker_route";

type Status =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

interface Signals {
  startingPoint: string | null;
  hasHeatingExperience: boolean;
  hasGasExperience: boolean;
  hasPlumbingExperience: boolean;
  hasBuildingServicesExperience: boolean;
  hasElectricalControlsExperience: boolean;
  hasRelatedTradeExperience: boolean;
  heatingQualificationLevel: string | null;
  mathsEnglishStatus: string | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: string | null;
  travelRange: string | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
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
}

const TITLES: Record<RouteId, string> = {
  apprenticeship: "Heating and building-services apprenticeship",
  college_then_workplace_experience: "College qualification followed by workplace experience",
  experienced_worker_route: "Experienced-worker assessment route",
};

const EVIDENCE: Record<RouteId, string> = {
  apprenticeship:
    "Standards such as Plumbing and Domestic Heating Technician (Level 3) or Building Services Engineering Craftsperson apprenticeships; typical duration 3–4 years; paid. Gas Safe registration is separate and comes after further assessment.",
  college_then_workplace_experience:
    "College Level 2/3 qualifications in plumbing / heating / building services followed by NVQ requiring evidenced on-site work.",
  experienced_worker_route:
    "Experienced Worker Assessment routes require substantial evidenced heating / plumbing / building-services work history. Gas Safe status is a separate legal register and must be verified independently.",
};

const patIncludes = (pats: string[], ...anyOf: string[]) => pats.some((p) => anyOf.includes(p));

const EXP_WORKER_QUALS = new Set([
  "level_2",
  "level_3",
  "gas_or_gas_safe_claimed",
  "heat_pump_or_low_carbon",
]);

const hasExpWorkerExperience = (s: Signals) =>
  s.hasHeatingExperience ||
  s.hasGasExperience ||
  s.hasPlumbingExperience ||
  s.hasBuildingServicesExperience;

const isApprenticeshipEligible = (s: Signals) =>
  s.availableTrainingPatterns.length > 0 &&
  patIncludes(s.availableTrainingPatterns, "full_time_work_based", "full_time_college", "one_or_two_weekdays");

const isCollegeRouteEligible = (s: Signals) =>
  patIncludes(
    s.availableTrainingPatterns,
    "full_time_college",
    "one_or_two_weekdays",
    "weekday_evenings",
    "mixed_day_evening",
  );

const isExperiencedWorkerEligible = (s: Signals) =>
  hasExpWorkerExperience(s) &&
  s.heatingQualificationLevel !== null &&
  EXP_WORKER_QUALS.has(s.heatingQualificationLevel);

const evaluateAffordability = (id: RouteId, s: Signals) => {
  const b = s.trainingBudgetBand;
  if (id === "apprenticeship") {
    return {
      affordable: true,
      notes: ["Apprenticeships are paid roles — you earn while training and course fees are covered."],
    };
  }
  if (id === "college_then_workplace_experience") {
    const notes = [
      "College course fees vary; funding may be available depending on age, prior qualifications and region — always check with the provider.",
    ];
    if (b === "free_only" || b === "up_to_500") {
      return {
        affordable: false,
        notes: [...notes, "Your stated budget is likely below typical self-funded college fees for this route."],
      };
    }
    return { affordable: true, notes };
  }
  const notes = [
    "Experienced-worker assessment fees are usually in the low thousands and normally self-funded. Any subsequent Gas Safe registration involves additional ACS assessment and registration fees.",
  ];
  if (b === "free_only" || b === "up_to_500" || b === "500_to_2000") {
    return {
      affordable: false,
      notes: [
        ...notes,
        "Your stated budget may not cover typical assessment costs — confirm current fees with an approved assessment centre.",
      ],
    };
  }
  return { affordable: true, notes };
};

const baseScore = (id: RouteId, s: Signals) => {
  if (id === "apprenticeship") {
    return 100
      + (s.startingPoint === "still_at_school" ? 10 : 0)
      + (s.startingPoint === "recently_left_education" ? 8 : 0)
      + (s.startingPoint === "career_changer" ? 4 : 0);
  }
  if (id === "college_then_workplace_experience") {
    return 80 + (s.hasRelatedTradeExperience ? 5 : 0) + (s.startingPoint === "career_changer" ? 6 : 0);
  }
  return 60 + (hasExpWorkerExperience(s) ? 20 : 0);
};

const priorityBonus = (id: RouteId, priorities: string[]) => {
  if (priorities.includes("not_sure_yet")) return 0;
  let bonus = 0;
  const w = 12;
  for (const p of priorities) {
    if (p === "earn_while_training" && id === "apprenticeship") bonus += w;
    if (p === "practical_experience" && id === "apprenticeship") bonus += w;
    if (p === "low_cost" && id === "apprenticeship") bonus += w;
    if (p === "strongest_employment" && id === "apprenticeship") bonus += 6;
    if (p === "recognised_qualification" && id === "college_then_workplace_experience") bonus += 15;
    if (p === "fit_around_commitments" && id === "college_then_workplace_experience") bonus += 8;
    if (p === "qualify_quickly" && id === "experienced_worker_route") bonus += w;
  }
  return bonus;
};

const routeBlockers = (id: RouteId, s: Signals): string[] => {
  const out: string[] = [];
  if (id === "apprenticeship") {
    if (s.mathsEnglishStatus === "neither") {
      out.push(
        "Most heating and building-services apprenticeship providers require English and maths at level 2 (GCSE grade 4/C) or Functional Skills; you may need to complete these alongside or before starting.",
      );
    }
    if (s.mathsEnglishStatus === "international") {
      out.push(
        "Providers will need to see how your international qualifications map to English and maths at Level 2 — check with the training provider or UK ENIC.",
      );
    }
    if (s.travelRange === "local_no_car") {
      out.push(
        "Heating apprenticeship placements can span a wide area — check whether local employers hire apprentices you can reach without a car.",
      );
    }
  }
  if (id === "college_then_workplace_experience") {
    if (s.mathsEnglishStatus === "neither") {
      out.push("Many colleges expect Level 2 maths and English for enrolment on Level 3 heating or building-services courses.");
    }
    out.push(
      "The NVQ that follows the classroom course requires evidence of real on-site heating or building-services work — plan how you'll access that placement.",
    );
  }
  if (id === "experienced_worker_route") {
    if (s.heatingQualificationLevel === "gas_or_gas_safe_claimed") {
      out.push(
        "A gas qualification or Gas Safe registration needs verifying separately — Gas Safe is a legal register maintained by the Gas Safe Register and cannot be inferred from your answers. Confirm your current registration status and any ACS certificates directly.",
      );
    }
    if (s.heatingQualificationLevel === "heat_pump_or_low_carbon") {
      out.push(
        "A heat pump or low-carbon heating qualification is structurally relevant but does not imply gas authorisation or Gas Safe registration — confirm with an approved assessment centre how it maps to the specific route you want.",
      );
    }
    if (s.heatingQualificationLevel === "level_2" || s.heatingQualificationLevel === "level_3") {
      out.push(
        "Your existing Level 2/3 qualification may cover heating, plumbing or building services — confirm with an approved heating or building-services assessment centre exactly how it maps to the current requirements.",
      );
    }
    out.push(
      "You will need to evidence substantial recent heating, gas, plumbing or building-services work — check the current assessment portfolio requirements with an approved centre.",
    );
  }
  return out;
};

const routeImmediate = (id: RouteId) =>
  id === "apprenticeship"
    ? "Search current heating, plumbing and building-services apprenticeship vacancies on the government's Find an Apprenticeship service and note the entry requirements for two employers you'd realistically apply to."
    : id === "college_then_workplace_experience"
    ? "Look up Level 2 plumbing / heating / building-services courses at colleges within your travel range and note their next intake and entry requirements."
    : "Request the current experienced-worker assessment guidance from an approved heating or building-services assessment centre and start listing the work you can evidence. If your goal includes gas work, contact the Gas Safe Register separately to confirm what registration will require.";

const CONDITION_MESSAGES: Record<string, string> = {
  safety_critical_systems:
    "You noted working with safety-critical heating or gas systems as something to check. Heating and gas work is regulated — ask employers and providers what supervision, assessments and registrations sit around the specific systems you'd work on.",
  confined_or_plant_rooms:
    "You noted working in confined spaces, lofts or plant rooms as something to check. Heating work regularly involves these environments — ask employers about the typical mix of work.",
  lifting_bending:
    "You noted regular lifting, bending or kneeling as something to check. Ask a working heating engineer about typical physical demands on the routes you're considering.",
  customer_sites:
    "You noted working in homes, commercial buildings or occupied customer sites as something to check. Most heating work involves customer contact — a taster day or shadowing can give you a realistic picture.",
  emergency_callouts:
    "You noted emergency callouts or irregular hours as something to check. Some heating roles include on-call rotas; others don't — confirm what a typical week looks like for the employers you're considering.",
  travel_between_customers:
    "You noted travelling between customer sites as something to check. Domestic heating usually involves regular travel — confirm expected travel time and vehicle arrangements.",
  need_more_info:
    "You said you need more information about the working conditions — a taster day, work experience, or a call with an approved training provider can give you a realistic picture before committing.",
};

const buildConsiderations = (s: Signals) =>
  s.workingConditionsToCheck.filter((c) => c !== "none").map((c) => CONDITION_MESSAGES[c]).filter((m): m is string => !!m);

const VERIFICATION = new Set(["older_unknown", "international", "unknown_level"]);

const missingCritical = (s: Signals): string[] => {
  const m: string[] = [];
  if (!s.startingPoint) m.push("starting_point");
  if (!s.heatingQualificationLevel) m.push("heating_qualification");
  if (!s.mathsEnglishStatus) m.push("maths_english_status");
  if (!s.availableTrainingPatterns.length) m.push("training_availability");
  return m;
};

export function runHeatingEngineerEngine(input: { signals: Signals }): EngineOutput {
  const s = input.signals;
  const considerations = buildConsiderations(s);

  if (s.heatingQualificationLevel && VERIFICATION.has(s.heatingQualificationLevel)) {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        "We can't safely classify your existing heating, gas or building-services qualification without verification. Older UK qualifications may be superseded, and international qualifications need mapping to current UK requirements.",
      ],
      immediateAction:
        "Ask an approved heating or building-services training provider or awarding-body assessment centre to review your existing qualification and confirm what it maps to in the current UK system. If gas work is involved, contact the Gas Safe Register separately.",
      evidenceNotes: [
        "UK heating and gas qualifications are set by awarding bodies and assessment centres; equivalency is decided by them, not by self-report. Gas Safe registration is legally separate again.",
      ],
      routeEvaluations: [],
      missingSignals: [],
    };
  }

  const missing = missingCritical(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [`We need answers on: ${missing.join(", ")} before we can suggest a specific route.`],
      immediateAction: "Go back and complete the outstanding questions so we can identify the strongest structural route.",
      evidenceNotes: [],
      routeEvaluations: [],
      missingSignals: missing,
    };
  }

  const ids: RouteId[] = ["apprenticeship", "college_then_workplace_experience", "experienced_worker_route"];
  const eligFns: Record<RouteId, (s: Signals) => boolean> = {
    apprenticeship: isApprenticeshipEligible,
    college_then_workplace_experience: isCollegeRouteEligible,
    experienced_worker_route: isExperiencedWorkerEligible,
  };
  const evals: RouteEval[] = ids.map((id) => {
    const eligible = eligFns[id](s);
    const affordability = evaluateAffordability(id, s);
    const score = eligible
      ? baseScore(id, s) + priorityBonus(id, s.routePriorities) + (affordability.affordable ? 0 : -20)
      : -1;
    return {
      id,
      displayTitle: TITLES[id],
      eligible,
      affordability,
      rankingScore: score,
      blockersAndChecks: eligible ? routeBlockers(id, s) : [],
      immediateAction: routeImmediate(id),
      evidenceNote: EVIDENCE[id],
    };
  });

  const eligible = evals.filter((e) => e.eligible);

  if (eligible.length === 0) {
    const action =
      !s.availableTrainingPatterns.length
        ? "Identify at least one training pattern you could commit to for a year, then come back — most routes need some regular weekday or evening availability."
        : s.availableTrainingPatterns.every((p) => p === "weekends" || p === "availability_varies" || p === "not_sure_yet")
        ? "Weekend-only or highly variable availability rules out most current heating training patterns. Explore whether you could restructure to include some weekday hours, or start with a short introductory course."
        : "Contact an approved heating or building-services training provider and ask which single next step would open the routes closest to your situation.";
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations,
      blockersAndChecks: [
        "Given your current situation, none of the standard training routes are directly open right now — a bridging step is needed first.",
      ],
      immediateAction: action,
      evidenceNotes: [
        "Bridging steps commonly used: short introductory heating or plumbing courses; Functional Skills to plug English/maths gaps; changes to availability that unlock apprenticeship applications.",
      ],
      routeEvaluations: evals,
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
    routeEvaluations: [...ranked, ...evals.filter((e) => !e.eligible)],
    missingSignals: [],
  };
}

export function buildHeatingEngineerResult(input: { signals: Signals }) {
  const out = runHeatingEngineerEngine(input);
  const readiness =
    out.status === "route_recommended" ? "ready_now"
    : out.status === "insufficient_information" ? "nearly_ready"
    : "needs_bridging";
  const overall =
    readiness === "ready_now" ? "Realistic"
    : readiness === "nearly_ready" ? "Realistic but hard"
    : "Long shot";

  const bestEval = out.recommendedRouteId ? out.routeEvaluations.find((r) => r.id === out.recommendedRouteId) : undefined;
  const altEval = out.alternativeRouteIds[0] ? out.routeEvaluations.find((r) => r.id === out.alternativeRouteIds[0]) : undefined;

  const bestRoute = bestEval
    ? {
        title: bestEval.displayTitle,
        summary:
          "This appears to be the strongest structural route from what you told us. Local availability of specific employers and courses, and any Gas Safe registration steps, need to be checked separately.",
        whyThisFits: [
          bestEval.affordability.affordable
            ? "This route appears structurally suitable for you based on your answers."
            : "This route is structurally the strongest fit for you; note the affordability caveats below.",
        ],
        estimatedTime:
          bestEval.id === "apprenticeship" ? "Typically 3–4 years"
          : bestEval.id === "college_then_workplace_experience"
          ? "Typically 2–4 years, plus time to build evidenced site work"
          : "Depends on the volume of evidenced work you already have and any further gas / low-carbon assessments needed",
        likelyCost: bestEval.affordability.affordable
          ? bestEval.id === "apprenticeship"
            ? "Paid — you earn a wage and fees are covered"
            : "Depends on the provider — confirm before committing"
          : "May exceed your stated budget — confirm current fees before committing",
        mainDifficulty: bestEval.blockersAndChecks[0] ?? "Confirm entry requirements with the specific provider or employer",
        confidence: "medium",
      }
    : {
        title:
          out.status === "qualification_verification_required"
            ? "Verification of your existing qualification is needed first"
            : out.status === "bridging_required"
            ? "A bridging step is needed before the standard routes open"
            : "We need a few more answers before recommending a route",
        summary:
          out.status === "qualification_verification_required"
            ? "We can't safely place your existing qualification without a formal check. This isn't a training route in itself — it's the step that unlocks one. Gas Safe registration, if relevant, is a separate legal step."
            : out.status === "bridging_required"
            ? "None of the standard training routes are directly open from your current situation. The step below is the bridging action, not a route in itself."
            : "Some critical answers are missing. Complete them and we'll suggest a specific route.",
        whyThisFits: [],
        estimatedTime: "Depends on the outcome of the step below",
        likelyCost: "Depends on the outcome of the step below",
        mainDifficulty: out.blockersAndChecks[0] ?? "",
        confidence: "low",
      };

  const backupRoute = altEval
    ? {
        title: altEval.displayTitle,
        summary:
          "A second structurally viable route from your answers. Compare it against the recommended route before committing.",
        tradeOff: altEval.affordability.affordable
          ? "Different timeline and delivery model — see the affordability and blockers notes."
          : "Structurally viable but likely exceeds your stated training budget.",
      }
    : {
        title: "No secondary route from your current answers",
        summary: "Only one route was structurally viable from what you told us.",
        tradeOff: "",
      };

  const routeToAvoid = {
    title: "A short private course that implies Gas Safe registration or a full heating-engineer role at the end",
    whyRisky:
      "Gas Safe registration is a legal register, not a course outcome — no training course alone makes you Gas Safe registered. Short private courses can leave you without the industry-recognised qualifications (e.g. Level 3 NVQ, ACS assessments) needed to work as a fully qualified heating engineer.",
    whenItMightWork:
      "Only when the provider is transparent about the qualification you'll hold at the end, how it maps to recognised awarding-body pathways, and what separate steps (NVQ, ACS, Gas Safe registration) are still required.",
  };

  const firstMoves = [out.immediateAction];
  if (altEval) firstMoves.push(`Compare the alternative route: ${altEval.immediateAction}`);
  firstMoves.push("Come back and rerun your Reality-check when your situation changes (availability, budget, qualifications).");

  return {
    readiness,
    readinessReason:
      out.status === "route_recommended"
        ? "Your answers point to at least one structurally suitable training route."
        : out.status === "qualification_verification_required"
        ? "Your existing qualification needs formal verification before we can place you on a route."
        : out.status === "bridging_required"
        ? "None of the standard routes are directly open from your current situation — a bridging step is needed first."
        : "We need a few more answers before we can suggest a specific route.",
    biggestBlocker: out.blockersAndChecks[0] ?? "No single structural blocker stood out from what you told us.",
    immediateAction: out.immediateAction,
    overallVerdict: overall,
    bestRoute,
    backupRoute,
    routeToAvoid,
    firstMoves: firstMoves.slice(0, 3),
    considerations: out.considerations.length ? out.considerations : undefined,
    modular: buildModularPayload<string>(out, heatingEngineerFlavor),
  };
}
