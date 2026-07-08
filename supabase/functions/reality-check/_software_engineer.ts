// Deno mirror of src/lib/reality-check/route-engines/software-engineer.ts.
// Parity is enforced by shared/reality-check/software-engineer-cases.json which
// both this file and the Vitest suite load.

import { buildModularPayload } from "./_modular_payload.ts";
import { softwareEngineerFlavor } from "./_software_engineer_flavor.ts";

type RouteId =
  | "self_taught_portfolio"
  | "bootcamp_intensive"
  | "degree_computer_science"
  | "degree_conversion_msc"
  | "apprenticeship_digital"
  | "junior_role_with_training";

type Status =
  | "route_recommended"
  | "qualification_verification_required"
  | "bridging_required"
  | "insufficient_information";

interface Signals {
  startingPoint: string | null;
  codingExperience: string | null;
  portfolioState: string | null;
  portfolioUrl?: string;
  highestQualification: string | null;
  mastersSubject?: string;
  mathsEnglishStatus: string | null;
  learningTimeHoursPerWeek: string | null;
  trainingBudgetGbp: string | null;
  locationFlexibility: string | null;
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
  self_taught_portfolio: "Self-taught + portfolio",
  bootcamp_intensive: "Intensive coding bootcamp",
  degree_computer_science: "Computer Science degree",
  degree_conversion_msc: "Postgraduate conversion (MSc CS)",
  apprenticeship_digital: "Digital apprenticeship",
  junior_role_with_training: "Junior / adjacent role → developer",
};

const EVIDENCE: Record<RouteId, string> = {
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

const stripPortfolioUrl = (s: Signals): Signals => {
  const { portfolioUrl: _drop, ...rest } = s;
  void _drop;
  return rest as Signals;
};

const LEARNING_ORDER = ["lt5", "5_15", "15_30", "30_plus"];
const CODING_ORDER = ["none", "hobbyist", "self_taught_6m_plus", "bootcamp_grad", "paid_experience"];

const learningTimeAtLeast = (v: string | null, min: string) =>
  v !== null && LEARNING_ORDER.indexOf(v) >= LEARNING_ORDER.indexOf(min);
const codingAtLeast = (v: string | null, min: string) =>
  v !== null && CODING_ORDER.indexOf(v) >= CODING_ORDER.indexOf(min);
const hasProjectEvidence = (v: string | null) =>
  v === "personal_projects" || v === "deployed" || v === "open_source";

const isSelfTaughtEligible = (s: Signals) =>
  learningTimeAtLeast(s.learningTimeHoursPerWeek, "5_15") &&
  (hasProjectEvidence(s.portfolioState) || codingAtLeast(s.codingExperience, "self_taught_6m_plus"));

const isBootcampEligible = (s: Signals) =>
  learningTimeAtLeast(s.learningTimeHoursPerWeek, "15_30");

const isDegreeCsEligible = (s: Signals) =>
  s.mathsEnglishStatus === "both" &&
  (s.highestQualification === "a_level" || s.highestQualification === "l3_vocational");

const isConversionMscEligible = (s: Signals) => {
  if (s.highestQualification === "bachelors_non_cs") return true;
  if (s.highestQualification === "masters_plus" && s.mastersSubject === "non_computing") return true;
  return false;
};

const isApprenticeshipEligible = (s: Signals) => {
  if (s.mathsEnglishStatus !== "both") return false;
  if (s.locationFlexibility === "remote_only") return false;
  return (
    s.startingPoint === "adjacent_tech_role" ||
    s.startingPoint === "already_coding_at_work" ||
    (s.codingExperience !== null && s.codingExperience !== "none") ||
    (s.portfolioState !== null && s.portfolioState !== "none")
  );
};

const isJuniorEligible = (s: Signals) =>
  s.startingPoint === "adjacent_tech_role" ||
  s.startingPoint === "already_coding_at_work" ||
  (codingAtLeast(s.codingExperience, "hobbyist") && hasProjectEvidence(s.portfolioState));

const affordability = (id: RouteId, s: Signals) => {
  const b = s.trainingBudgetGbp;
  if (id === "self_taught_portfolio") {
    return { affordable: true, notes: ["Self-taught study has minimal direct cost — plan for a laptop, internet and possibly paid learning platforms."] };
  }
  if (id === "bootcamp_intensive") {
    if (b === "10k_plus") return { affordable: true, notes: ["Your budget covers most private bootcamps — still check the full cost including any assessment or extension fees."] };
    if (b === "2k_10k") return { affordable: true, notes: ["Many private bootcamps sit above this range; check total cost, outcomes methodology, refund terms and independent evidence before paying."] };
    return { affordable: false, notes: ["An intensive course may be structurally possible, but your budget means you would need to find a funded Skills Bootcamp, employer-funded option, or a provider with acceptable payment terms."] };
  }
  if (id === "degree_computer_science") {
    const notes = ["UK undergraduate tuition fee loans are currently in the £9.5k–£9.8k range per year (varies by year and provider); living costs are separate."];
    if (b === "0" || b === "0_2k") return { affordable: true, notes: [...notes, "Tuition is typically financed via student finance rather than up-front — your stated up-front budget does not rule this out."] };
    return { affordable: true, notes };
  }
  if (id === "degree_conversion_msc") {
    const notes = ["Conversion MSc tuition typically £9,000–£15,000 for 12 months, plus living costs; some Masters loans available."];
    if (b === "0" || b === "0_2k") return { affordable: false, notes: [...notes, "Your stated budget is likely below typical conversion MSc costs unless you rely on a postgraduate loan."] };
    return { affordable: true, notes };
  }
  if (id === "apprenticeship_digital") {
    return { affordable: true, notes: ["Apprenticeships are paid — you earn a wage and course fees are covered by the employer/government."] };
  }
  return { affordable: true, notes: ["Paid employment; any employer-funded training is on top of your salary."] };
};

const baseScore = (id: RouteId, s: Signals): number => {
  if (id === "self_taught_portfolio") return 80 + (hasProjectEvidence(s.portfolioState) ? 10 : 0);
  if (id === "bootcamp_intensive") return 85 + (learningTimeAtLeast(s.learningTimeHoursPerWeek, "30_plus") ? 5 : 0);
  if (id === "degree_computer_science") return 90;
  if (id === "degree_conversion_msc") return 88;
  if (id === "apprenticeship_digital") return 92;
  return s.startingPoint === "already_coding_at_work" ? 96 : 90;
};

const PRIORITY_BONUS: Record<string, Partial<Record<RouteId, number>>> = {
  speed: { bootcamp_intensive: 12, junior_role_with_training: 10 },
  low_cost: { apprenticeship_digital: 12, self_taught_portfolio: 12, junior_role_with_training: 8 },
  job_security: { degree_computer_science: 12, apprenticeship_digital: 10 },
  employer_training: { apprenticeship_digital: 12, junior_role_with_training: 8 },
  creative: { self_taught_portfolio: 10, bootcamp_intensive: 6 },
  high_pay: { degree_computer_science: 8, degree_conversion_msc: 8 },
};

const priorityBonus = (id: RouteId, priorities: string[]) => {
  let b = 0;
  for (const p of priorities) b += PRIORITY_BONUS[p]?.[id] ?? 0;
  return b;
};

const affordabilityAdjust = (id: RouteId, a: { affordable: boolean }, s: Signals) => {
  if (!a.affordable) return -20;
  if (id === "bootcamp_intensive" && s.trainingBudgetGbp === "2k_10k") return -1;
  return 0;
};

const routeBlockers = (id: RouteId, s: Signals): string[] => {
  const out: string[] = [];
  if (id === "self_taught_portfolio") {
    out.push("No formal gate — employers judge you on evidence. Aim for 2–3 deployed projects with source code and a clear README.");
    if (s.portfolioState === "tutorials_only") out.push("Tutorial-only work is not portfolio evidence. Your first bridging step is a small, deployed project of your own.");
  } else if (id === "bootcamp_intensive") {
    out.push("Intensive coding courses vary widely. If it is a private bootcamp, check the total cost, outcomes methodology, refund terms and independent evidence before paying.");
    out.push("If it is a government-funded Skills Bootcamp, check eligibility (usually 19+), provider location and format, and what job-interview or employer-support commitments are included.");
  } else if (id === "degree_computer_science") {
    out.push("Confirm current tuition, entry requirements and placement-year availability with the specific university before applying.");
    if (s.mathsEnglishStatus !== "both") out.push("Most CS degrees expect maths at Level 2 minimum; some expect A-level maths — check the course entry requirements.");
  } else if (id === "degree_conversion_msc") {
    out.push("This route is designed for graduates whose first degree is not Computer Science. If you already hold a CS degree, look at junior-role, apprenticeship or direct-application routes instead.");
    if (s.mastersSubject === "unknown") out.push("Confirm whether your existing degree/masters is computing-related before considering a conversion MSc — this affects whether the route is right for you.");
  } else if (id === "apprenticeship_digital") {
    out.push("Digital apprenticeships are employer-led. Entry requirements, availability and format vary by employer and provider — Level 4 software development standards and Level 6 degree-level routes (Digital and Technology Solutions Professional — Software Engineer) have different expectations. Places may be scarce and location-dependent.");
  } else {
    out.push("Realistic for adjacent-tech roles (QA, support, data ops) or existing in-work coders. Progression to engineer typically 12–24 months and depends on the employer's development plan.");
  }
  return out;
};

const routeImmediate = (id: RouteId, s: Signals): string => {
  if (id === "self_taught_portfolio") return "Pick one small project idea you can deploy in 4–6 weeks, and commit to a public repo you'll iterate on weekly.";
  if (id === "bootcamp_intensive") return "Compare one funded Skills Bootcamp and one private bootcamp on cost, cohort length, outcomes methodology and refund terms before paying anything.";
  if (id === "degree_computer_science") return "Shortlist three universities via UCAS, check their current entry requirements and placement-year options, and note application deadlines.";
  if (id === "degree_conversion_msc") return "Shortlist two conversion MSc programmes, confirm they accept non-computing graduates, and check whether a postgraduate loan covers the tuition band.";
  if (id === "apprenticeship_digital") return "Search 'Find an apprenticeship' for Level 4 software development and Level 6 Digital and Technology Solutions Professional (Software Engineer) vacancies in your region.";
  return s.startingPoint === "already_coding_at_work"
    ? "Ask your line manager about formalising a development-focused progression plan; document the coding work you already do."
    : "Look for QA, IT support or data-ops roles at companies that hire developers internally; use those roles as your bridge.";
};

const missingCritical = (s: Signals): string[] => {
  const m: string[] = [];
  if (!s.startingPoint) m.push("starting_point");
  if (!s.codingExperience) m.push("coding_experience");
  if (!s.learningTimeHoursPerWeek) m.push("learning_time_available");
  if (!s.highestQualification) m.push("highest_qualification");
  if (!s.mathsEnglishStatus) m.push("maths_english_status");
  return m;
};

const isBlockingVerification = (s: Signals) =>
  s.highestQualification === "international" || s.highestQualification === "unknown";

export function runSoftwareEngineerEngine(input: { signals: Signals }): EngineOutput {
  const s = stripPortfolioUrl(input.signals);

  const missing = missingCritical(s);
  if (missing.length > 0) {
    return {
      status: "insufficient_information",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: [`We need answers on: ${missing.join(", ")} before we can suggest a specific route.`],
      immediateAction: "Go back and complete the outstanding questions so we can identify the strongest structural route.",
      evidenceNotes: [],
      routeEvaluations: [],
      missingSignals: missing,
    };
  }

  const ids: RouteId[] = [
    "self_taught_portfolio",
    "bootcamp_intensive",
    "degree_computer_science",
    "degree_conversion_msc",
    "apprenticeship_digital",
    "junior_role_with_training",
  ];
  const elig: Record<RouteId, (s: Signals) => boolean> = {
    self_taught_portfolio: isSelfTaughtEligible,
    bootcamp_intensive: isBootcampEligible,
    degree_computer_science: isDegreeCsEligible,
    degree_conversion_msc: isConversionMscEligible,
    apprenticeship_digital: isApprenticeshipEligible,
    junior_role_with_training: isJuniorEligible,
  };

  const evals: RouteEval[] = ids.map((id) => {
    const eligible = elig[id](s);
    const aff = affordability(id, s);
    const score = eligible ? baseScore(id, s) + priorityBonus(id, s.routePriorities) + affordabilityAdjust(id, aff, s) : -1;
    return {
      id,
      displayTitle: TITLES[id],
      eligible,
      affordability: aff,
      rankingScore: score,
      blockersAndChecks: eligible ? routeBlockers(id, s) : [],
      immediateAction: routeImmediate(id, s),
      evidenceNote: EVIDENCE[id],
    };
  });

  const eligible = evals.filter((e) => e.eligible);

  if (isBlockingVerification(s) && eligible.length === 0) {
    return {
      status: "qualification_verification_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: ["We can't safely place your existing qualification on a route without verification. A UK ENIC Statement of Comparability (or your provider's official mapping) is the standard evidence."],
      immediateAction: "Request a UK ENIC Statement of Comparability, or ask your original provider for an official UK-equivalence mapping, before choosing a route.",
      evidenceNotes: ["UK ENIC is the UK's designated national agency for the recognition and comparison of international qualifications."],
      routeEvaluations: evals,
      missingSignals: [],
    };
  }

  if (eligible.length === 0) {
    const bridging =
      !hasProjectEvidence(s.portfolioState) && !codingAtLeast(s.codingExperience, "hobbyist")
        ? "Reach at least 5 hours/week of study and complete one small deployable project, then re-run this checker."
        : s.highestQualification === "none" || s.highestQualification === "gcse"
          ? "You would typically need Level 3 qualifications (e.g. A-levels or equivalent) to open the degree route. Check specific course entry requirements before committing."
          : "Bring one more signal into your profile — either more evidence of work or more available learning time — and re-run this checker.";
    return {
      status: "bridging_required",
      recommendedRouteId: null,
      alternativeRouteIds: [],
      affordabilityNotes: [],
      considerations: [],
      blockersAndChecks: ["Given your current situation, none of the standard software-engineering routes are directly open right now — a bridging step is needed first."],
      immediateAction: bridging,
      evidenceNotes: ["Common bridging steps: reach a first deployed project; get to 5+ hours/week of consistent study; secure GCSE English and maths; complete a Level 3 qualification to open the degree route."],
      routeEvaluations: evals,
      missingSignals: [],
    };
  }

  const ranked = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
  const best = ranked[0];
  const alternatives = ranked.slice(1);
  const blockersAndChecks = [...best.blockersAndChecks];
  if (s.highestQualification === "masters_plus" && s.mastersSubject === "unknown") {
    blockersAndChecks.push("Confirm whether your existing degree/masters is computing-related before considering a conversion MSc.");
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
    routeEvaluations: [...ranked, ...evals.filter((e) => !e.eligible)],
    missingSignals: [],
  };
}

export function buildSoftwareEngineerResult(input: { signals: Signals }) {
  const out = runSoftwareEngineerEngine(input);
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
        summary: "This appears to be the strongest structural route from what you told us. Local availability of specific employers, cohorts and universities needs checking separately.",
        whyThisFits: [
          bestEval.affordability.affordable
            ? "This route appears structurally suitable for you based on your answers."
            : "This route is structurally the strongest fit for you; note the affordability caveats below.",
        ],
        estimatedTime: softwareEngineerFlavor.timeCaveats[bestEval.id] ?? "Depends on the provider",
        likelyCost: bestEval.affordability.affordable
          ? softwareEngineerFlavor.costCaveats[bestEval.id] ?? "Confirm current fees before committing"
          : "May exceed your stated budget — confirm current fees before committing",
        mainDifficulty: bestEval.blockersAndChecks[0] ?? "Confirm entry requirements with the specific provider or employer",
        confidence: "medium",
      }
    : {
        title:
          out.status === "qualification_verification_required" ? "Verification of your existing qualification is needed first"
          : out.status === "bridging_required" ? "A bridging step is needed before the standard routes open"
          : "We need a few more answers before recommending a route",
        summary:
          out.status === "qualification_verification_required" ? "We can't safely place your existing qualification without a formal check. This isn't a training route in itself — it's the step that unlocks one."
          : out.status === "bridging_required" ? "None of the standard training routes are directly open from your current situation. The step below is the bridging action, not a route in itself."
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
        summary: "A second structurally viable route from your answers. Compare it against the recommended route before committing.",
        tradeOff: altEval.affordability.affordable
          ? "Different timeline and delivery model — see the affordability and blockers notes."
          : "Structurally viable but likely exceeds your stated training budget.",
      }
    : { title: "No secondary route from your current answers", summary: "Only one route was structurally viable from what you told us.", tradeOff: "" };

  const readinessLabel: "ready_now" | "nearly_ready" | "needs_bridging" = readiness;
  const overallLabel: "Realistic" | "Realistic but hard" | "Long shot" = overall;

  return {
    readiness: readinessLabel,
    readinessReason:
      out.status === "route_recommended" ? "Your answers point to at least one structurally suitable software-engineering route."
      : out.status === "qualification_verification_required" ? "Your existing qualification needs formal verification before we can place you on a route."
      : out.status === "bridging_required" ? "None of the standard routes are directly open from your current situation — a bridging step is needed first."
      : "We need a few more answers before we can suggest a specific route.",
    biggestBlocker: out.blockersAndChecks[0] ?? "No single structural blocker stood out from what you told us.",
    immediateAction: out.immediateAction,
    overallVerdict: overallLabel,
    bestRoute,
    backupRoute,
    routeToAvoid: {
      title: "A high-cost private bootcamp with weak evidence of outcomes",
      whyRisky: "Some private bootcamps market strong job outcomes without independent audit. Paying £8,000–£12,000+ for a course that does not lead to a first developer role is one of the most expensive wrong turns in this route family.",
      whenItMightWork: "Only when the provider publishes an independently audited outcomes methodology, clear refund terms and direct references from recent graduates.",
    },
    firstMoves: [out.immediateAction, "Come back and rerun your Reality-check when your situation changes (portfolio, learning hours, qualifications)."].slice(0, 3),
    modular: buildModularPayload(out, softwareEngineerFlavor),
  };
}
