// Software Engineer deterministic route engine — v1.
//
// Runtime-neutral. Deno mirror at
// supabase/functions/reality-check/_software_engineer.ts is kept identical by
// the shared fixture at shared/reality-check/software-engineer-cases.json.
//
// Contract (identical to the trades engines, restated so this file is self-
// contained):
//   - Eligibility is deterministic and independent of budget and priorities.
//   - Priorities may reorder eligible routes only. They cannot promote an
//     ineligible route.
//   - Budget never changes eligibility. It affects affordability notes and
//     may reduce (but not remove) an eligible route's ranking score.
//   - Free text NEVER affects eligibility. `portfolioUrl` is stripped from
//     the eligibility input by `toEligibilityInput` before evaluation, and
//     the engine's public entry point re-strips it as defence in depth.
//   - International / unknown-level qualifications route to
//     `qualification_verification_required` ONLY when no other route can be
//     recommended safely (per v3 brief §5.2). masters_plus + unknown subject
//     is downgraded on the conversion MSc route but does not block other
//     eligible routes.
//   - Missing critical signals route to `insufficient_information`.
//   - No eligible route routes to `bridging_required`.
//   - `bridging_beginner` is NEVER a routeId — it is only ever an outcome.
//
// Outcome precedence:
//   1. qualification_verification_required (only when no other route is safe)
//   2. insufficient_information
//   3. route eligibility → route_recommended
//   4. bridging_required

import type { SoftwareEngineerSignals } from "../questionnaire/signals";

export type SoftwareEngineerRouteId =
  | "self_taught_portfolio"
  | "bootcamp_intensive"
  | "degree_computer_science"
  | "degree_conversion_msc"
  | "apprenticeship_digital"
  | "junior_role_with_training";

export type SoftwareEngineerOutcomeStatus =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

export interface AffordabilityReport {
  affordable: boolean;
  notes: string[];
}

export interface SoftwareEngineerRouteEvaluation {
  id: SoftwareEngineerRouteId;
  displayTitle: string;
  eligible: boolean;
  affordability: AffordabilityReport;
  rankingScore: number;
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNote: string;
}

/** The engine core operates on this stripped input — portfolioUrl removed. */
export type SoftwareEngineerEligibilitySignals = Omit<
  SoftwareEngineerSignals,
  "portfolioUrl"
>;

export interface SoftwareEngineerEngineInput {
  signals: SoftwareEngineerSignals;
  region?: string | null;
  serviceLevel?: string | null;
  role?: { role_slug?: string; role_name?: string } | null;
}

export interface SoftwareEngineerEngineOutput {
  status: SoftwareEngineerOutcomeStatus;
  recommendedRouteId: SoftwareEngineerRouteId | null;
  alternativeRouteIds: SoftwareEngineerRouteId[];
  affordabilityNotes: string[];
  considerations: string[];
  blockersAndChecks: string[];
  immediateAction: string;
  evidenceNotes: string[];
  routeEvaluations: SoftwareEngineerRouteEvaluation[];
  missingSignals: string[];
}

export const ROUTE_TITLES: Record<SoftwareEngineerRouteId, string> = {
  self_taught_portfolio: "Self-taught + portfolio",
  bootcamp_intensive: "Intensive coding bootcamp",
  degree_computer_science: "Computer Science degree",
  degree_conversion_msc: "Postgraduate conversion (MSc CS)",
  apprenticeship_digital: "Digital apprenticeship",
  junior_role_with_training: "Junior / adjacent role → developer",
};

const EVIDENCE_NOTES: Record<SoftwareEngineerRouteId, string> = {
  self_taught_portfolio:
    "Employers judge portfolio-led candidates on evidence. Aim for 2–3 deployed projects with source code and clear READMEs.",
  bootcamp_intensive:
    "Intensive coding courses vary widely. Government-funded Skills Bootcamps and private bootcamps have very different eligibility, costs and outcomes — check both before committing.",
  degree_computer_science:
    "UK undergraduate tuition fee loans are currently in the £9.5k–£9.8k range per year (varies by year and provider). Placement year materially changes graduate outcomes.",
  degree_conversion_msc:
    "Conversion MScs (~12 months, typically £9k–£15k tuition plus living costs) are designed for graduates whose first degree is not in computing.",
  apprenticeship_digital:
    "Digital apprenticeships are employer-led. Options include Level 4 software development standards and Level 6 degree-level routes (Digital and Technology Solutions Professional — Software Engineer). Availability varies by employer and region.",
  junior_role_with_training:
    "Adjacent-tech roles (QA, IT support, data ops) or existing in-work coders often progress to engineer in 12–24 months.",
};

// ── Portfolio URL safety ─────────────────────────────────────────────────────

/**
 * Strip `portfolioUrl` before eligibility evaluation. Called by the public
 * `runSoftwareEngineerEngine` entry point and exported so tests can assert
 * the invariant directly.
 */
export const toEligibilityInput = (
  s: SoftwareEngineerSignals,
): SoftwareEngineerEligibilitySignals => {
  const { portfolioUrl: _drop, ...rest } = s;
  void _drop;
  return rest;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const learningTimeAtLeast = (
  v: SoftwareEngineerSignals["learningTimeHoursPerWeek"],
  min: "5_15" | "15_30" | "30_plus",
): boolean => {
  const order = ["lt5", "5_15", "15_30", "30_plus"] as const;
  if (!v) return false;
  return order.indexOf(v) >= order.indexOf(min);
};

const codingAtLeast = (
  v: SoftwareEngineerSignals["codingExperience"],
  min:
    | "hobbyist"
    | "self_taught_6m_plus"
    | "bootcamp_grad"
    | "paid_experience",
): boolean => {
  const order = [
    "none",
    "hobbyist",
    "self_taught_6m_plus",
    "bootcamp_grad",
    "paid_experience",
  ] as const;
  if (!v) return false;
  return order.indexOf(v) >= order.indexOf(min);
};

const hasProjectEvidence = (
  v: SoftwareEngineerSignals["portfolioState"],
): boolean =>
  v === "personal_projects" || v === "deployed" || v === "open_source";

// ── Eligibility rules ────────────────────────────────────────────────────────

const isSelfTaughtEligible = (s: SoftwareEngineerEligibilitySignals): boolean =>
  learningTimeAtLeast(s.learningTimeHoursPerWeek, "5_15") &&
  (hasProjectEvidence(s.portfolioState) ||
    codingAtLeast(s.codingExperience, "self_taught_6m_plus"));

// Bootcamp: budget is NEVER a hard gate (v3 brief §5.1).
const isBootcampEligible = (s: SoftwareEngineerEligibilitySignals): boolean =>
  learningTimeAtLeast(s.learningTimeHoursPerWeek, "15_30");

// Degree CS: directly eligible only from Level 3.
// GCSE / no-qualification users are NOT directly eligible; they may see the
// route via bridging copy but never as a recommended route this run.
const isDegreeCsEligible = (s: SoftwareEngineerEligibilitySignals): boolean =>
  s.mathsEnglishStatus === "both" &&
  (s.highestQualification === "a_level" ||
    s.highestQualification === "l3_vocational");

// Conversion MSc: bachelors_non_cs OR masters_plus + non_computing.
// Explicitly NOT eligible for bachelors_cs.
const isConversionMscEligible = (
  s: SoftwareEngineerEligibilitySignals,
): boolean => {
  if (s.highestQualification === "bachelors_non_cs") return true;
  if (
    s.highestQualification === "masters_plus" &&
    s.mastersSubject === "non_computing"
  ) {
    return true;
  }
  return false;
};

// Apprenticeship: needs maths/English, on-site presence, and at least one
// evidence-of-interest signal so a total beginner with zero engagement
// bridges rather than being handed apprenticeship as the recommendation.
// "Evidence of interest" = ANY of: non-null coding experience above none,
// any portfolio state above none, or a starting point that implies prior
// engagement with tech (adjacent role / already coding at work).
const isApprenticeshipEligible = (
  s: SoftwareEngineerEligibilitySignals,
): boolean => {
  if (s.mathsEnglishStatus !== "both") return false;
  if (s.locationFlexibility === "remote_only") return false;
  const evidenceOfInterest =
    s.startingPoint === "adjacent_tech_role" ||
    s.startingPoint === "already_coding_at_work" ||
    (s.codingExperience !== null && s.codingExperience !== "none") ||
    (s.portfolioState !== null && s.portfolioState !== "none");
  return evidenceOfInterest;
};

const isJuniorRoleEligible = (
  s: SoftwareEngineerEligibilitySignals,
): boolean =>
  s.startingPoint === "adjacent_tech_role" ||
  s.startingPoint === "already_coding_at_work" ||
  (codingAtLeast(s.codingExperience, "hobbyist") &&
    hasProjectEvidence(s.portfolioState));

// ── Affordability ────────────────────────────────────────────────────────────

const evaluateAffordability = (
  id: SoftwareEngineerRouteId,
  s: SoftwareEngineerEligibilitySignals,
): AffordabilityReport => {
  const b = s.trainingBudgetGbp;
  switch (id) {
    case "self_taught_portfolio":
      return {
        affordable: true,
        notes: [
          "Self-taught study has minimal direct cost — plan for a laptop, internet and possibly paid learning platforms.",
        ],
      };
    case "bootcamp_intensive": {
      if (b === "10k_plus") {
        return {
          affordable: true,
          notes: [
            "Your budget covers most private bootcamps — still check the full cost including any assessment or extension fees.",
          ],
        };
      }
      if (b === "2k_10k") {
        return {
          affordable: true,
          notes: [
            "Many private bootcamps sit above this range; check total cost, outcomes methodology, refund terms and independent evidence before paying.",
          ],
        };
      }
      // 0 or 0_2k
      return {
        affordable: false,
        notes: [
          "An intensive course may be structurally possible, but your budget means you would need to find a funded Skills Bootcamp, employer-funded option, or a provider with acceptable payment terms.",
        ],
      };
    }
    case "degree_computer_science": {
      const notes = [
        "UK undergraduate tuition fee loans are currently in the £9.5k–£9.8k range per year (varies by year and provider); living costs are separate.",
      ];
      if (b === "0" || b === "0_2k") {
        return {
          affordable: true,
          notes: [
            ...notes,
            "Tuition is typically financed via student finance rather than up-front — your stated up-front budget does not rule this out.",
          ],
        };
      }
      return { affordable: true, notes };
    }
    case "degree_conversion_msc": {
      const notes = [
        "Conversion MSc tuition typically £9,000–£15,000 for 12 months, plus living costs; some Masters loans available.",
      ];
      if (b === "0" || b === "0_2k") {
        return {
          affordable: false,
          notes: [
            ...notes,
            "Your stated budget is likely below typical conversion MSc costs unless you rely on a postgraduate loan.",
          ],
        };
      }
      return { affordable: true, notes };
    }
    case "apprenticeship_digital":
      return {
        affordable: true,
        notes: [
          "Apprenticeships are paid — you earn a wage and course fees are covered by the employer/government.",
        ],
      };
    case "junior_role_with_training":
      return {
        affordable: true,
        notes: [
          "Paid employment; any employer-funded training is on top of your salary.",
        ],
      };
  }
};

// ── Ranking ──────────────────────────────────────────────────────────────────

const baseScore = (
  id: SoftwareEngineerRouteId,
  s: SoftwareEngineerEligibilitySignals,
): number => {
  switch (id) {
    case "self_taught_portfolio":
      return 80 + (hasProjectEvidence(s.portfolioState) ? 10 : 0);
    case "bootcamp_intensive":
      return 85 + (learningTimeAtLeast(s.learningTimeHoursPerWeek, "30_plus") ? 5 : 0);
    case "degree_computer_science":
      return 90;
    case "degree_conversion_msc":
      return 88;
    case "apprenticeship_digital":
      return 92;
    case "junior_role_with_training":
      return s.startingPoint === "already_coding_at_work" ? 96 : 90;
  }
};

const PRIORITY_BONUS: Partial<
  Record<string, Partial<Record<SoftwareEngineerRouteId, number>>>
> = {
  speed: { bootcamp_intensive: 12, junior_role_with_training: 10 },
  low_cost: {
    apprenticeship_digital: 12,
    self_taught_portfolio: 12,
    junior_role_with_training: 8,
  },
  job_security: { degree_computer_science: 12, apprenticeship_digital: 10 },
  employer_training: {
    apprenticeship_digital: 12,
    junior_role_with_training: 8,
  },
  creative: { self_taught_portfolio: 10, bootcamp_intensive: 6 },
  high_pay: { degree_computer_science: 8, degree_conversion_msc: 8 },
};

const priorityBonus = (
  id: SoftwareEngineerRouteId,
  priorities: string[],
): number => {
  let bonus = 0;
  for (const p of priorities) {
    const row = PRIORITY_BONUS[p];
    if (!row) continue;
    bonus += row[id] ?? 0;
  }
  return bonus;
};

const affordabilityAdjustment = (
  id: SoftwareEngineerRouteId,
  a: AffordabilityReport,
  s: SoftwareEngineerEligibilitySignals,
): number => {
  if (!a.affordable) return -20;
  // Soft demote: 2k_10k bootcamp per v3 brief affordability table.
  if (id === "bootcamp_intensive" && s.trainingBudgetGbp === "2k_10k") return -1;
  return 0;
};

// ── Blockers / checks ────────────────────────────────────────────────────────

const routeBlockers = (
  id: SoftwareEngineerRouteId,
  s: SoftwareEngineerEligibilitySignals,
): string[] => {
  const out: string[] = [];
  switch (id) {
    case "self_taught_portfolio":
      out.push(
        "No formal gate — employers judge you on evidence. Aim for 2–3 deployed projects with source code and a clear README.",
      );
      if (s.portfolioState === "tutorials_only") {
        out.push(
          "Tutorial-only work is not portfolio evidence. Your first bridging step is a small, deployed project of your own.",
        );
      }
      break;
    case "bootcamp_intensive":
      out.push(
        "Intensive coding courses vary widely. If it is a private bootcamp, check the total cost, outcomes methodology, refund terms and independent evidence before paying.",
      );
      out.push(
        "If it is a government-funded Skills Bootcamp, check eligibility (usually 19+), provider location and format, and what job-interview or employer-support commitments are included.",
      );
      break;
    case "degree_computer_science":
      out.push(
        "Confirm current tuition, entry requirements and placement-year availability with the specific university before applying.",
      );
      if (s.mathsEnglishStatus !== "both") {
        out.push(
          "Most CS degrees expect maths at Level 2 minimum; some expect A-level maths — check the course entry requirements.",
        );
      }
      break;
    case "degree_conversion_msc":
      out.push(
        "This route is designed for graduates whose first degree is not Computer Science. If you already hold a CS degree, look at junior-role, apprenticeship or direct-application routes instead.",
      );
      if (s.mastersSubject === "unknown") {
        out.push(
          "Confirm whether your existing degree/masters is computing-related before considering a conversion MSc — this affects whether the route is right for you.",
        );
      }
      break;
    case "apprenticeship_digital":
      out.push(
        "Digital apprenticeships are employer-led. Entry requirements, availability and format vary by employer and provider — Level 4 software development standards and Level 6 degree-level routes (Digital and Technology Solutions Professional — Software Engineer) have different expectations. Places may be scarce and location-dependent.",
      );
      break;
    case "junior_role_with_training":
      out.push(
        "Realistic for adjacent-tech roles (QA, support, data ops) or existing in-work coders. Progression to engineer typically 12–24 months and depends on the employer's development plan.",
      );
      break;
  }
  return out;
};

const routeImmediate = (
  id: SoftwareEngineerRouteId,
  s: SoftwareEngineerEligibilitySignals,
): string => {
  switch (id) {
    case "self_taught_portfolio":
      return "Pick one small project idea you can deploy in 4–6 weeks, and commit to a public repo you'll iterate on weekly.";
    case "bootcamp_intensive":
      return "Compare one funded Skills Bootcamp and one private bootcamp on cost, cohort length, outcomes methodology and refund terms before paying anything.";
    case "degree_computer_science":
      return "Shortlist three universities via UCAS, check their current entry requirements and placement-year options, and note application deadlines.";
    case "degree_conversion_msc":
      return "Shortlist two conversion MSc programmes, confirm they accept non-computing graduates, and check whether a postgraduate loan covers the tuition band.";
    case "apprenticeship_digital":
      return "Search 'Find an apprenticeship' for Level 4 software development and Level 6 Digital and Technology Solutions Professional (Software Engineer) vacancies in your region.";
    case "junior_role_with_training":
      return s.startingPoint === "already_coding_at_work"
        ? "Ask your line manager about formalising a development-focused progression plan; document the coding work you already do."
        : "Look for QA, IT support or data-ops roles at companies that hire developers internally; use those roles as your bridge.";
  }
};

// ── Outcome precedence ───────────────────────────────────────────────────────

const CRITICAL_MISSING = (
  s: SoftwareEngineerEligibilitySignals,
): string[] => {
  const missing: string[] = [];
  if (!s.startingPoint) missing.push("starting_point");
  if (!s.codingExperience) missing.push("coding_experience");
  if (!s.learningTimeHoursPerWeek) missing.push("learning_time_available");
  if (!s.highestQualification) missing.push("highest_qualification");
  if (!s.mathsEnglishStatus) missing.push("maths_english_status");
  return missing;
};

// Verification-only path: fired ONLY when the qualification cannot be
// classified and no other route is safe to recommend. We compute route
// eligibility first, then decide whether verification is the only useful
// outcome. Per v3 brief §5.2, masters_plus + unknown does NOT trigger this
// on its own — it demotes conversion MSc but leaves other routes alone.
const isBlockingVerification = (
  s: SoftwareEngineerEligibilitySignals,
): boolean =>
  s.highestQualification === "international" ||
  s.highestQualification === "unknown";

export const runSoftwareEngineerEngine = (
  input: SoftwareEngineerEngineInput,
): SoftwareEngineerEngineOutput => {
  // Defence in depth: strip portfolioUrl even though it should already be
  // gone from the eligibility path.
  const s = toEligibilityInput(input.signals);

  // 1. Missing critical signals → insufficient_information.
  const missing = CRITICAL_MISSING(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
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

  // 2. Evaluate route eligibility (independent of budget and priorities).
  const routeIds: SoftwareEngineerRouteId[] = [
    "self_taught_portfolio",
    "bootcamp_intensive",
    "degree_computer_science",
    "degree_conversion_msc",
    "apprenticeship_digital",
    "junior_role_with_training",
  ];

  const eligibilityFns: Record<
    SoftwareEngineerRouteId,
    (s: SoftwareEngineerEligibilitySignals) => boolean
  > = {
    self_taught_portfolio: isSelfTaughtEligible,
    bootcamp_intensive: isBootcampEligible,
    degree_computer_science: isDegreeCsEligible,
    degree_conversion_msc: isConversionMscEligible,
    apprenticeship_digital: isApprenticeshipEligible,
    junior_role_with_training: isJuniorRoleEligible,
  };

  const evaluations: SoftwareEngineerRouteEvaluation[] = routeIds.map((id) => {
    const eligible = eligibilityFns[id](s);
    const affordability = evaluateAffordability(id, s);
    const score = eligible
      ? baseScore(id, s) +
        priorityBonus(id, s.routePriorities) +
        affordabilityAdjustment(id, affordability, s)
      : -1;
    return {
      id,
      displayTitle: ROUTE_TITLES[id],
      eligible,
      affordability,
      rankingScore: score,
      blockersAndChecks: eligible ? routeBlockers(id, s) : [],
      immediateAction: routeImmediate(id, s),
      evidenceNote: EVIDENCE_NOTES[id],
    };
  });

  const eligible = evaluations.filter((e) => e.eligible);

  // 3. Verification-only path fires when the qualification is unclassifiable
  //    AND no other route can be recommended safely.
  if (isBlockingVerification(s) && eligible.length === 0) {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "We can't safely place your existing qualification on a route without verification. A UK ENIC Statement of Comparability (or your provider's official mapping) is the standard evidence.",
      ],
      immediateAction:
        "Request a UK ENIC Statement of Comparability, or ask your original provider for an official UK-equivalence mapping, before choosing a route.",
      evidenceNotes: [
        "UK ENIC is the UK's designated national agency for the recognition and comparison of international qualifications.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
    };
  }

  // 4. No eligible route → bridging_required.
  if (eligible.length === 0) {
    const bridgingAction =
      !hasProjectEvidence(s.portfolioState) &&
      !codingAtLeast(s.codingExperience, "hobbyist")
        ? "Reach at least 5 hours/week of study and complete one small deployable project, then re-run this checker."
        : s.highestQualification === "none" ||
            s.highestQualification === "gcse"
          ? "You would typically need Level 3 qualifications (e.g. A-levels or equivalent) to open the degree route. Check specific course entry requirements before committing."
          : "Bring one more signal into your profile — either more evidence of work or more available learning time — and re-run this checker.";
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [
        "Given your current situation, none of the standard software-engineering routes are directly open right now — a bridging step is needed first.",
      ],
      immediateAction: bridgingAction,
      evidenceNotes: [
        "Common bridging steps: reach a first deployed project; get to 5+ hours/week of consistent study; secure GCSE English and maths; complete a Level 3 qualification to open the degree route.",
      ],
      routeEvaluations: evaluations,
      missingSignals: [],
    };
  }

  // 5. Rank eligible routes.
  const ranked = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
  const best = ranked[0];
  const alternatives = ranked.slice(1);

  const blockersAndChecks: string[] = [...best.blockersAndChecks];
  // Surface the conversion-MSc subject-verification check as a top-level
  // check when it's a live concern, even if it's not the recommended route.
  if (
    s.highestQualification === "masters_plus" &&
    s.mastersSubject === "unknown"
  ) {
    blockersAndChecks.push(
      "Confirm whether your existing degree/masters is computing-related before considering a conversion MSc.",
    );
  }

  return {
    status: "route_recommended",
    recommendedRouteId: best.id,
    alternativeRouteIds: alternatives.map((r) => r.id),
    affordabilityNotes: ranked.flatMap((r) => r.affordability.notes),
    considerations: [],
    blockersAndChecks,
    immediateAction: best.immediateAction,
    evidenceNotes: ranked.map((r) => r.evidenceNote),
    routeEvaluations: [
      ...ranked,
      ...evaluations.filter((e) => !e.eligible),
    ],
    missingSignals: [],
  };
};
