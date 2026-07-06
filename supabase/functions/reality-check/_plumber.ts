// Deno mirror of the Plumber engine. Kept intentionally minimal — the
// full rule table is duplicated here (Deno can't reach into ../../../src)
// but parity is enforced by the shared fixtures at
// /shared/reality-check/plumber-cases.json which both the Vitest and Deno
// tests load and run.

type PlumberRouteId =
  | "apprenticeship"
  | "college_then_workplace_experience"
  | "experienced_worker_route";

type PlumberOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

interface Signals {
  startingPoint: string | null;
  hasPlumbingExperience: boolean;
  hasRelatedTradeExperience: boolean;
  plumbingQualificationLevel: string | null;
  mathsEnglishStatus: string | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: string | null;
  travelRange: string | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

interface RouteEval {
  id: PlumberRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: { affordable: boolean; notes: string[] };
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

export interface EngineOutput {
  status: PlumberOutcomeStatus;
  recommendedRouteId: PlumberRouteId | null;
  alternativeRouteIds: PlumberRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: RouteEval[];
  missingSignals: string[];
}

const TITLES: Record<PlumberRouteId, string> = {
  apprenticeship: "Plumbing and domestic heating apprenticeship",
  college_then_workplace_experience: "College qualification followed by workplace experience",
  experienced_worker_route: "Experienced-worker assessment route",
};

const EVIDENCE: Record<PlumberRouteId, string> = {
  apprenticeship: "Level 3 Plumbing and Domestic Heating Technician apprenticeship standard; typical duration 3–4 years; paid.",
  college_then_workplace_experience:
    "City & Guilds 6035 (or equivalent) at Level 2/3 followed by NVQ Level 3 requiring evidenced on-site work.",
  experienced_worker_route:
    "Experienced Worker Assessment routes require substantial evidenced plumbing work history.",
};

const patIncludes = (pats: string[], ...anyOf: string[]) => pats.some((p) => anyOf.includes(p));

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
  s.hasPlumbingExperience &&
  (s.plumbingQualificationLevel === "level_2" ||
    s.plumbingQualificationLevel === "level_3" ||
    s.plumbingQualificationLevel === "gas_heating");

const evaluateAffordability = (id: PlumberRouteId, s: Signals) => {
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
  const notes = ["Experienced-worker assessment fees are usually in the low thousands and normally self-funded."];
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

const baseScore = (id: PlumberRouteId, s: Signals) => {
  if (id === "apprenticeship") {
    return 100
      + (s.startingPoint === "still_at_school" ? 10 : 0)
      + (s.startingPoint === "recently_left_education" ? 8 : 0)
      + (s.startingPoint === "career_changer" ? 4 : 0);
  }
  if (id === "college_then_workplace_experience") {
    return 80 + (s.hasRelatedTradeExperience ? 5 : 0) + (s.startingPoint === "career_changer" ? 6 : 0);
  }
  return 60 + (s.hasPlumbingExperience ? 20 : 0);
};

const priorityBonus = (id: PlumberRouteId, priorities: string[]) => {
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

const routeBlockers = (id: PlumberRouteId, s: Signals): string[] => {
  const out: string[] = [];
  if (id === "apprenticeship") {
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
  if (id === "college_then_workplace_experience") {
    if (s.mathsEnglishStatus === "neither") {
      out.push("Many colleges expect Level 2 maths and English for enrolment on Level 3 plumbing courses.");
    }
    out.push(
      "The NVQ Level 3 that follows the classroom course requires evidence of real on-site plumbing work — plan how you'll access that placement.",
    );
  }
  if (id === "experienced_worker_route") {
    if (s.plumbingQualificationLevel === "gas_heating") {
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

const routeImmediate = (id: PlumberRouteId) =>
  id === "apprenticeship"
    ? "Search current plumbing apprenticeship vacancies on the government's Find an Apprenticeship service and note the entry requirements for two employers you'd realistically apply to."
    : id === "college_then_workplace_experience"
    ? "Look up City & Guilds 6035 (or equivalent) Level 2 plumbing courses at colleges within your travel range and note their next intake and entry requirements."
    : "Request the current experienced-worker assessment guidance from an approved plumbing assessment centre and start listing the plumbing work you can evidence.";

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

const buildConsiderations = (s: Signals) =>
  s.workingConditionsToCheck.filter((c) => c !== "none").map((c) => CONDITION_MESSAGES[c]).filter((m): m is string => !!m);

const VERIFICATION = new Set(["older_unknown", "international", "unknown_level"]);

const missingCritical = (s: Signals): string[] => {
  const m: string[] = [];
  if (!s.startingPoint) m.push("starting_point");
  if (!s.plumbingQualificationLevel) m.push("plumbing_qualification");
  if (!s.mathsEnglishStatus) m.push("maths_english_status");
  if (!s.availableTrainingPatterns.length) m.push("training_availability");
  return m;
};

export function runPlumberEngine(input: { signals: Signals }): EngineOutput {
  const s = input.signals;
  const considerations = buildConsiderations(s);

  if (s.plumbingQualificationLevel && VERIFICATION.has(s.plumbingQualificationLevel)) {
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

  const ids: PlumberRouteId[] = ["apprenticeship", "college_then_workplace_experience", "experienced_worker_route"];
  const eligFns: Record<PlumberRouteId, (s: Signals) => boolean> = {
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
      immediateAction: action,
      evidenceNotes: [
        "Bridging steps commonly used: short introductory plumbing courses; Functional Skills to plug English/maths gaps; changes to availability that unlock apprenticeship applications.",
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

export function buildPlumberResult(input: { signals: Signals }) {
  const out = runPlumberEngine(input);
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
          "This appears to be the strongest structural route from what you told us. Local availability of specific employers and courses needs to be checked separately.",
        whyThisFits: [
          bestEval.affordability.affordable
            ? "This route appears structurally suitable for you based on your answers."
            : "This route is structurally the strongest fit for you; note the affordability caveats below.",
        ],
        estimatedTime:
          bestEval.id === "apprenticeship" ? "Typically 3–4 years"
          : bestEval.id === "college_then_workplace_experience"
          ? "Typically 2–4 years, plus time to build evidenced site work"
          : "Depends on the volume of evidenced work you already have",
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
    title: "A long, expensive private course before confirming the destination qualification",
    whyRisky:
      "Some private plumbing courses do not lead to the industry-recognised qualifications (e.g. Level 3 NVQ) that let you work as a fully qualified plumber — check the endpoint qualification before paying.",
    whenItMightWork:
      "Only when the provider is transparent about the qualification you'll hold at the end and how it maps to City & Guilds / EAL recognition and the Level 3 NVQ pathway.",
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
  };
}
