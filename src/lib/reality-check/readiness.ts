// Deterministic readiness engine — Release 1.
//
// Runtime-neutral module. No React, no browser globals, no Deno/Node-only APIs.
// Both the Reality-check edge function (Deno) and the UI / vitest (Node) consume
// this logic. The edge function ships a near-identical mirror at
// `supabase/functions/reality-check/_readiness.ts` — keep them in sync.
//
// Authority model:
//   - The classifier decides the four-state `readiness` from a small set of
//     explicit, testable rules over normalised answers + role context.
//   - The result-builder fills the rest of the RealityCheckResult shape from
//     controlled templates and the role's structured data only. No free-form
//     prose, no invented numbers, no provider names beyond `role.key_employers`.

import type {
  BestRoute,
  BackupRoute,
  RouteToAvoid,
  RealityCheckAnswers,
  RealityCheckResult,
  Readiness,
  RoleContext,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const has = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.trim().length >= 3;

const lowerName = (role: RoleContext): string => (role.role_name || "").toLowerCase();

export const isRegulatedClinical = (role: RoleContext): boolean =>
  /(nurse|midwif|paramedic|therapist|radiograph|pharmacist|dentist|doctor|physician|social worker)/.test(
    lowerName(role),
  );

export const isSciencePathRole = (role: RoleContext): boolean =>
  isRegulatedClinical(role) ||
  /(engineer|scientist|laboratory|biomed|chemist|physicist|veterinar|biolog|data analyst)/.test(
    lowerName(role),
  );

export const isTradeOrTechnicianRole = (role: RoleContext): boolean =>
  /(electrician|plumber|carpenter|joiner|bricklayer|mechanic|welder|roofer|plasterer|gas engineer|hgv driver|technician|builder|tiler|painter and decorator|dental nurse|pharmacy technician)/.test(
    lowerName(role),
  );

export const isTeachingRole = (role: RoleContext): boolean =>
  /(teacher|teaching|lecturer)/.test(lowerName(role));

export const isTechRole = (role: RoleContext): boolean =>
  /(software|developer|engineer|programmer|data|cyber|devops|machine learning|ml|analyst|architect|designer)/.test(
    lowerName(role),
  );

// ── Rule outputs ─────────────────────────────────────────────────────────────

export interface ReadinessRule {
  /** Stable rule id for tests + logs. */
  id: string;
  /** Human-readable explanation, used in `readinessReason` and `biggestBlocker`. */
  message: string;
}

export interface ReadinessJudgement {
  readiness: Readiness;
  /** All rules that fired. The first is treated as the primary blocker. */
  rules: ReadinessRule[];
}

// ── Classifier ───────────────────────────────────────────────────────────────

/**
 * Deterministic four-state classifier.
 *
 * Order matters: rules earlier in the list win when multiple fire.
 * Every rule has a stable id so tests can target it.
 */
export function classifyReadiness(
  answers: RealityCheckAnswers,
  role: RoleContext,
): ReadinessJudgement {
  const blockers: ReadinessRule[] = [];
  const concerns: ReadinessRule[] = [];

  const clinical = isRegulatedClinical(role);
  const science  = isSciencePathRole(role);
  const trade    = isTradeOrTechnicianRole(role);
  const teaching = isTeachingRole(role);

  const ql       = answers.qualificationLevel;
  const em       = answers.englishMaths;
  const sci      = answers.scienceSubjects;
  const bg       = answers.relevantBackground;
  const income   = answers.incomeNeed;
  const budget   = answers.budget;
  const hours    = answers.weeklyHours;
  const english  = answers.englishComfort;

  // ── Hard structural blockers (multiple = high-risk) ────────────────────────

  // 1. No GCSE English/maths for a regulated route → bridging is mandatory.
  if (clinical && (em === "no" || ql === "none")) {
    blockers.push({
      id: "blocker_no_gcse_clinical",
      message:
        "Most regulated healthcare routes require GCSE English and maths (or accepted equivalents) before training begins.",
    });
  }

  // 2. Teaching also requires English/maths.
  if (teaching && (em === "no" || ql === "none")) {
    blockers.push({
      id: "blocker_no_gcse_teaching",
      message:
        "Teacher training requires GCSE English, maths (and science for primary) at grade 4/C or above.",
    });
  }

  // 3. STEM/science role with no science subjects.
  if (science && !clinical && (sci === "no" && ql !== "undergrad" && ql !== "postgrad")) {
    blockers.push({
      id: "blocker_no_science_stem",
      message:
        "This route typically expects some science or quantitative subjects at Level 3 or above.",
    });
  }

  // 4. No formal qualifications + no background + non-trade route.
  if (ql === "none" && !has(bg) && !trade) {
    blockers.push({
      id: "blocker_no_quals_no_background",
      message:
        "Most entry routes need at least Level 2 qualifications or a clear track record of relevant work or study.",
    });
  }

  // 5. Money + time both tight + expensive non-funded route territory.
  if (
    (budget === "zero" || budget === "under_500") &&
    (hours === "0_5") &&
    income === "need_income"
  ) {
    blockers.push({
      id: "blocker_money_time_income",
      message:
        "With limited budget, very few weekly hours, and a need to earn, only paid (e.g. apprenticeship or assistant) routes are realistic right now.",
    });
  }

  // ── Bridging concerns (one or more = needs_bridging at minimum) ────────────

  if (clinical && em === "not_sure") {
    concerns.push({
      id: "bridge_unsure_gcse",
      message:
        "Confirm whether your English and maths qualifications meet the route's entry requirements before applying.",
    });
  }

  if (ql === "level_2" && (clinical || teaching || science)) {
    concerns.push({
      id: "bridge_level_2_only",
      message:
        "An Access to HE course or Level 3 qualification is usually the next step before degree-level training.",
    });
  }

  if (
    answers.startingPoint === "graduate" &&
    !has(bg) &&
    (clinical || teaching)
  ) {
    concerns.push({
      id: "bridge_unrelated_graduate",
      message:
        "A relevant top-up or pre-entry experience role (e.g. healthcare assistant, teaching assistant) is usually expected before training.",
    });
  }

  if (english === "may_need_support") {
    concerns.push({
      id: "bridge_english_support",
      message:
        "Planning for ESOL/IELTS or in-course language support is sensible before committing to a study-heavy route.",
    });
  }

  if (em === "english_only" || em === "maths_only") {
    concerns.push({
      id: "bridge_partial_gcse",
      message:
        "Functional Skills can fill the missing English/maths quickly and is accepted by many routes.",
    });
  }

  // ── Soft concerns (degrade readiness from ready_now → nearly_ready) ────────

  if ((budget === "zero" || budget === "under_500") && !trade && income !== "need_income") {
    concerns.push({
      id: "soft_budget_tight",
      message:
        "A tight training budget points you toward employer-funded, apprenticeship, or low-cost routes.",
    });
  }

  if (hours === "0_5" && income !== "need_income") {
    concerns.push({
      id: "soft_time_thin",
      message:
        "Very limited weekly hours will slow part-time study and may rule out full-time intensive routes.",
    });
  }

  // ── Decide readiness state ────────────────────────────────────────────────

  let readiness: Readiness;
  if (blockers.length >= 2) {
    readiness = "high_risk_now";
  } else if (blockers.length === 1) {
    readiness = "needs_bridging";
  } else if (concerns.length >= 1) {
    readiness = "nearly_ready";
  } else {
    readiness = "ready_now";
  }

  return {
    readiness,
    rules: [...blockers, ...concerns],
  };
}

// ── Result builder (controlled templates) ────────────────────────────────────

const PATHWAY_KEY_BY_STARTING_POINT: Record<string, "school_leaver" | "graduate" | "adjacent" | "no_background"> = {
  school_leaver:  "school_leaver",
  graduate:       "graduate",
  career_changer: "adjacent",
  adjacent:       "adjacent",
  no_background:  "no_background",
};

function preferredPathwayKey(a: RealityCheckAnswers) {
  if (!a.startingPoint) return null;
  return PATHWAY_KEY_BY_STARTING_POINT[a.startingPoint] ?? null;
}

function bestRouteTitle(
  answers: RealityCheckAnswers,
  role: RoleContext,
  readiness: Readiness,
): string {
  const key = preferredPathwayKey(answers);
  // If the user clearly needs paid training, prefer apprenticeship/assistant framing.
  if (answers.incomeNeed === "need_income") {
    if (isRegulatedClinical(role)) return "Healthcare assistant → apprenticeship or degree apprenticeship route";
    if (isTradeOrTechnicianRole(role)) return "Apprenticeship route";
    if (isTeachingRole(role)) return "Teaching assistant → salaried teacher training";
    return "Apprenticeship or paid trainee route";
  }
  if (readiness === "needs_bridging" || readiness === "high_risk_now") {
    if (isRegulatedClinical(role) || isTeachingRole(role)) return "Bridging step first, then approved training route";
    return "Bridging step first, then the main entry route";
  }
  if (key === "graduate") return "Graduate entry route";
  if (key === "school_leaver") return "School leaver / Level 3 entry route";
  if (key === "adjacent") return "Adjacent-experience route";
  return "Standard entry route";
}

function bestRouteWhy(
  answers: RealityCheckAnswers,
  rules: ReadinessRule[],
): string[] {
  const out: string[] = [];
  if (answers.incomeNeed === "need_income") {
    out.push("You need to earn while training, so paid/salaried routes are prioritised.");
  }
  if (answers.budget === "zero" || answers.budget === "under_500") {
    out.push("Your stated budget points to employer-funded or no-cost training.");
  }
  if (answers.weeklyHours === "20_plus" || answers.weeklyHours === "10_20") {
    out.push("You have enough weekly time to make steady progress on this route.");
  }
  if (rules.length === 0 && answers.qualificationLevel) {
    out.push("Your current qualifications align with typical entry expectations.");
  }
  return out.slice(0, 3);
}

function estimatedTimeFor(role: RoleContext, readiness: Readiness): string {
  if (readiness === "needs_bridging" || readiness === "high_risk_now") {
    return "Add 6–18 months for a bridging step before the main route";
  }
  if (isRegulatedClinical(role)) return "Typically 3 years (degree) or 4 years (degree apprenticeship)";
  if (isTeachingRole(role))     return "Typically 1 year (PGCE) or 2 years (salaried route)";
  if (isTradeOrTechnicianRole(role)) return "Typically 2–4 years (apprenticeship)";
  return "Depends on the route — confirm before applying";
}

function likelyCostFor(answers: RealityCheckAnswers): string {
  if (answers.incomeNeed === "need_income") return "Low — paid/salaried routes prioritised";
  if (answers.budget === "zero" || answers.budget === "under_500") return "Low — employer-funded or no-cost routes prioritised";
  return "Depends on the route — confirm fees and funding before applying";
}

function mainDifficultyFor(role: RoleContext, rules: ReadinessRule[]): string {
  if (rules[0]) return rules[0].message;
  if (isRegulatedClinical(role)) return "Clinical placements and shift patterns during training";
  if (isTeachingRole(role))     return "Placements and workload during the training year";
  if (isTradeOrTechnicianRole(role)) return "Securing an apprenticeship place — they're competitive";
  return "Sustained effort across the training period";
}

function buildBestRoute(
  answers: RealityCheckAnswers,
  role: RoleContext,
  judgement: ReadinessJudgement,
): BestRoute {
  const confidence: BestRoute["confidence"] =
    judgement.readiness === "ready_now" ? "high" :
    judgement.readiness === "nearly_ready" ? "medium" : "low";
  return {
    title: bestRouteTitle(answers, role, judgement.readiness),
    summary: judgement.readiness === "high_risk_now"
      ? "Build the basics first. The main route only makes sense once the blockers below are addressed."
      : judgement.readiness === "needs_bridging"
      ? "Take a bridging step first, then move on to the main entry route."
      : "This is the route with the best odds from your stated situation.",
    whyThisFits: bestRouteWhy(answers, judgement.rules),
    estimatedTime: estimatedTimeFor(role, judgement.readiness),
    likelyCost:    likelyCostFor(answers),
    mainDifficulty: mainDifficultyFor(role, judgement.rules),
    confidence,
  };
}

function buildBackupRoute(answers: RealityCheckAnswers, role: RoleContext): BackupRoute {
  if (isRegulatedClinical(role)) {
    return {
      title: answers.incomeNeed === "need_income"
        ? "Degree route via student finance"
        : "Healthcare assistant role first, train later",
      summary: answers.incomeNeed === "need_income"
        ? "Full-time study with student finance — slower-earning but a clear timeline."
        : "Start earning in a related role, build relevant experience, then apply for training.",
      tradeOff: answers.incomeNeed === "need_income"
        ? "Several years on a low income before salaried work begins."
        : "Adds 1–2 years before training but improves your application and confidence.",
    };
  }
  if (isTeachingRole(role)) {
    return {
      title: "PGCE with bursary (if eligible)",
      summary: "One-year postgraduate teacher training with government bursaries in shortage subjects.",
      tradeOff: "Limited income during the training year and intensive placements.",
    };
  }
  if (isTradeOrTechnicianRole(role)) {
    return {
      title: "Funded short course → assistant/trainee role",
      summary: "A funded Level 2 course can open trainee work that leads to a full apprenticeship.",
      tradeOff: "Slower progression to qualified status than a direct apprenticeship.",
    };
  }
  return {
    title: "Self-study + entry-level role",
    summary: "Build portfolio evidence and target trainee or junior roles.",
    tradeOff: "Slower and less structured than a formal training route.",
  };
}

function buildRouteToAvoid(answers: RealityCheckAnswers, role: RoleContext): RouteToAvoid {
  const tightMoney = answers.budget === "zero" || answers.budget === "under_500";
  if (isRegulatedClinical(role)) {
    return {
      title: "An unregulated private course that does not lead to UK registration",
      whyRisky: "Some private courses are not recognised by the UK regulator and will not let you practise.",
      whenItMightWork: "Only if it explicitly leads to a regulator-approved qualification — confirm before paying.",
    };
  }
  if (isTeachingRole(role)) {
    return {
      title: "Unaccredited online \"teach abroad\" certificates",
      whyRisky: "They don't lead to Qualified Teacher Status in the UK.",
      whenItMightWork: "Only if you specifically want to teach abroad and have checked the destination's requirements.",
    };
  }
  if (isTechRole(role)) {
    return {
      title: tightMoney ? "A self-funded bootcamp on credit" : "A short bootcamp as the entire route",
      whyRisky: tightMoney
        ? "Bootcamp fees on credit can mean repayments before employment, and many hiring teams now look beyond bootcamps alone."
        : "A bootcamp can be useful as one step, but rarely replaces structured experience for getting hired.",
      whenItMightWork: "If it is employer-funded, leads directly to a paid role, or you already have related experience.",
    };
  }
  return {
    title: "A long, expensive private course before checking employer demand",
    whyRisky: "Spending money on training before confirming real local demand often leads to a slow start or a pivot.",
    whenItMightWork: "If you've already spoken to employers in your area and they confirm they hire this route.",
  };
}

function buildImmediateAction(
  answers: RealityCheckAnswers,
  role: RoleContext,
  judgement: ReadinessJudgement,
): string {
  const firstBlocker = judgement.rules[0]?.id;
  if (firstBlocker === "blocker_no_gcse_clinical" || firstBlocker === "blocker_no_gcse_teaching") {
    return "Look up Functional Skills English and maths Level 2 with a local FE college this week.";
  }
  if (firstBlocker === "bridge_unsure_gcse") {
    return "Find one specific course or employer's listing and check exactly which English and maths qualifications they accept.";
  }
  if (firstBlocker === "bridge_level_2_only") {
    return "Check Access to Higher Education diplomas at colleges in your area.";
  }
  if (firstBlocker === "bridge_unrelated_graduate" && isRegulatedClinical(role)) {
    return "Apply for a healthcare assistant role at a local NHS trust to build relevant experience.";
  }
  if (firstBlocker === "bridge_unrelated_graduate" && isTeachingRole(role)) {
    return "Apply for a teaching assistant role at a school you could see yourself teaching at.";
  }
  if (firstBlocker === "blocker_money_time_income") {
    return "Search apprenticeship vacancies on the government's Find an Apprenticeship service.";
  }
  if (answers.incomeNeed === "need_income" && isTradeOrTechnicianRole(role)) {
    return "Search apprenticeship vacancies on the government's Find an Apprenticeship service.";
  }
  if (answers.incomeNeed === "need_income") {
    return "Search apprenticeship and trainee vacancies on the government's Find an Apprenticeship service.";
  }
  if (isRegulatedClinical(role)) return "Browse approved courses on the NHS Health Careers website.";
  if (isTeachingRole(role))      return "Browse routes into teaching on the Get Into Teaching website.";
  if (isTradeOrTechnicianRole(role)) return "Search apprenticeship vacancies on the government's Find an Apprenticeship service.";
  if (isTechRole(role))          return "Find one entry-level role spec online and list the gaps between it and your current skills.";
  return "Find a real job listing for this role and use its requirements as your study plan.";
}

function buildFirstMoves(
  answers: RealityCheckAnswers,
  role: RoleContext,
  judgement: ReadinessJudgement,
  immediate: string,
): string[] {
  const moves: string[] = [immediate];
  if (judgement.rules[1]) {
    moves.push(
      judgement.rules[1].id.startsWith("blocker_")
        ? "Map out a realistic timeline to address the second blocker before applying."
        : "Plan how you'll cover the second concern listed above in the next month.",
    );
  } else if (answers.region === "other_uk") {
    moves.push("Search for one local employer or training provider in your area and note their entry requirements.");
  } else {
    moves.push("Save one current job listing for this role so you can match your training plan to real requirements.");
  }
  moves.push("Come back and rerun your Reality-check when your situation changes (qualifications, budget, hours).");
  return moves.slice(0, 3);
}

const overallVerdictFromReadiness: Record<Readiness, RealityCheckResult["overallVerdict"]> = {
  ready_now:      "Realistic",
  nearly_ready:   "Realistic but hard",
  needs_bridging: "Long shot",
  high_risk_now:  "Probably not for you",
};

/**
 * Build the full Reality-check result deterministically from answers + role.
 * No LLM. No invented numbers. No invented organisations beyond `key_employers`.
 */
export function buildResult(
  answers: RealityCheckAnswers,
  role: RoleContext,
): RealityCheckResult {
  const judgement = classifyReadiness(answers, role);
  const bestRoute    = buildBestRoute(answers, role, judgement);
  const backupRoute  = buildBackupRoute(answers, role);
  const routeToAvoid = buildRouteToAvoid(answers, role);
  const immediate    = buildImmediateAction(answers, role, judgement);
  const firstMoves   = buildFirstMoves(answers, role, judgement, immediate);

  const blocker = judgement.rules[0]?.message
    ?? "No single structural blocker stood out from what you told us.";

  const reason =
    judgement.readiness === "ready_now"
      ? "Your stated situation lines up with this route's typical entry expectations."
      : judgement.readiness === "nearly_ready"
      ? "You're close — one or two things to plan around before committing."
      : judgement.readiness === "needs_bridging"
      ? "A clear bridging step is needed before this route's main entry point makes sense."
      : "Several structural blockers stand in the way of the main entry route right now.";

  return {
    readiness: judgement.readiness,
    readinessReason: reason,
    biggestBlocker: blocker,
    immediateAction: immediate,
    overallVerdict: overallVerdictFromReadiness[judgement.readiness],
    bestRoute,
    backupRoute,
    routeToAvoid,
    firstMoves,
  };
}
