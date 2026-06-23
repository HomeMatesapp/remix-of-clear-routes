// Centralised registry of evidence sources used by Reality-check.
//
// Every figure, demand signal or pathway claim shown to a user must trace
// back to an entry in this file. Updating a `lastChecked` date here updates
// it everywhere the citation is rendered. Do not hard-code citations in
// individual components or pages.

import type { RealityCheckAnswers, RealityCheckResult, RoleContext } from "./types";

export type SourceCategory =
  | "salary"
  | "demand"
  | "pathway"
  | "apprenticeship"
  | "local"
  | "ai_impact"
  | "regulation";

export interface SourceEntry {
  id: string;
  /** Publishing organisation (e.g. "Office for National Statistics"). */
  organisation: string;
  /** Dataset or publication title. */
  title: string;
  /** Year or period the data covers (e.g. "2024", "2023/24"). */
  period: string;
  /** ISO date the Clear Routes team last checked the source. */
  lastChecked: string;
  /** Public URL to the source. */
  url: string;
  /** Short plain-English note about how Clear Routes uses this source. */
  usage: string;
  category: SourceCategory;
}

// ── Registry ────────────────────────────────────────────────────────────────

export const SOURCES: Readonly<Record<string, SourceEntry>> = Object.freeze({
  ons_ashe: {
    id: "ons_ashe",
    organisation: "Office for National Statistics",
    title: "Annual Survey of Hours and Earnings (ASHE)",
    period: "2024",
    lastChecked: "2026-06-01",
    url: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/annualsurveyofhoursandearnings/2024",
    usage: "Median UK earnings by occupation, used to anchor salary ranges shown on role pages.",
    category: "salary",
  },
  lmi_for_all: {
    id: "lmi_for_all",
    organisation: "LMI for All (Department for Education)",
    title: "Labour Market Information API",
    period: "2024/25",
    lastChecked: "2026-06-01",
    url: "https://www.lmiforall.org.uk/",
    usage: "Occupation-level demand and growth signals used to describe how competitive a route is.",
    category: "demand",
  },
  ifate: {
    id: "ifate",
    organisation: "Institute for Apprenticeships & Technical Education",
    title: "Apprenticeship standards",
    period: "Current",
    lastChecked: "2026-06-01",
    url: "https://www.instituteforapprenticeships.org/",
    usage: "Official apprenticeship standards, durations and entry expectations referenced in route pathways.",
    category: "apprenticeship",
  },
  find_apprenticeship: {
    id: "find_apprenticeship",
    organisation: "Department for Education",
    title: "Find an apprenticeship",
    period: "Live service",
    lastChecked: "2026-06-01",
    url: "https://www.gov.uk/apply-apprenticeship",
    usage: "Where users are sent to check live apprenticeship vacancies in their area before applying.",
    category: "apprenticeship",
  },
  ucas: {
    id: "ucas",
    organisation: "UCAS",
    title: "Course search and entry requirements",
    period: "Current cycle",
    lastChecked: "2026-06-01",
    url: "https://www.ucas.com/",
    usage: "Used to point users at university entry requirements rather than asserting them ourselves.",
    category: "pathway",
  },
  discover_uni: {
    id: "discover_uni",
    organisation: "Office for Students",
    title: "Discover Uni",
    period: "2024",
    lastChecked: "2026-06-01",
    url: "https://discoveruni.gov.uk/",
    usage: "Course-level continuation, satisfaction and graduate outcome data referenced when comparing degree routes.",
    category: "pathway",
  },
  nhs_careers: {
    id: "nhs_careers",
    organisation: "NHS Health Careers",
    title: "Role entry routes",
    period: "Current",
    lastChecked: "2026-06-01",
    url: "https://www.healthcareers.nhs.uk/",
    usage: "Authoritative entry routes for regulated NHS roles such as Nursing, Midwifery and Paramedic.",
    category: "pathway",
  },
  nmc: {
    id: "nmc",
    organisation: "Nursing and Midwifery Council",
    title: "Approved education standards",
    period: "Current",
    lastChecked: "2026-06-01",
    url: "https://www.nmc.org.uk/education/",
    usage: "Regulator's rules on what qualifications lead to nurse/midwife registration.",
    category: "regulation",
  },
  national_careers: {
    id: "national_careers",
    organisation: "National Careers Service",
    title: "Job profiles",
    period: "Current",
    lastChecked: "2026-06-01",
    url: "https://nationalcareers.service.gov.uk/",
    usage: "General role descriptions and typical entry routes cross-checked when writing pathway summaries.",
    category: "pathway",
  },
  ons_vacancies: {
    id: "ons_vacancies",
    organisation: "Office for National Statistics",
    title: "Vacancies and jobs in the UK",
    period: "Latest quarterly release",
    lastChecked: "2026-06-01",
    url: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/bulletins/vacanciesandjobsintheuk/latest",
    usage: "National vacancy trends used to describe overall labour market direction. Not used for live local counts.",
    category: "demand",
  },
});

// ── Selection logic ─────────────────────────────────────────────────────────

// Map a role to the regulation-specific sources we should always cite for it.
function roleRegulationSources(role: RoleContext): SourceEntry[] {
  const name = (role.role_name ?? "").toLowerCase();
  const out: SourceEntry[] = [];
  if (/(nurse|midwif)/.test(name)) {
    out.push(SOURCES.nhs_careers, SOURCES.nmc);
  } else if (/(paramedic|therapist|radiograph|pharmacist|dentist|doctor|gp|midwif)/.test(name)) {
    out.push(SOURCES.nhs_careers);
  }
  return out;
}

/**
 * Pick the sources that genuinely informed a given Reality-check result.
 * Returns a stable, de-duplicated list ordered by category.
 */
export function getSourcesForResult(
  role: RoleContext,
  answers: RealityCheckAnswers,
  result: RealityCheckResult | null | undefined,
): SourceEntry[] {
  const ids = new Set<string>();

  // Pathway is always relevant — we recommend a route.
  ids.add(SOURCES.national_careers.id);
  ids.add(SOURCES.ucas.id);

  // Salary is shown whenever we have any salary anchor on the role.
  if (role.salary_entry || role.salary_experienced || role.salary_senior) {
    ids.add(SOURCES.ons_ashe.id);
  }

  // Demand / competition signals.
  if (role.demand || role.competition_level) {
    ids.add(SOURCES.lmi_for_all.id);
    ids.add(SOURCES.ons_vacancies.id);
  }

  // Apprenticeship-shaped routes.
  const bestTitle = (result?.bestRoute?.title ?? "").toLowerCase();
  const backupTitle = (result?.backupRoute?.title ?? "").toLowerCase();
  if (
    bestTitle.includes("apprentice") ||
    backupTitle.includes("apprentice") ||
    answers.incomeNeed === "need_income"
  ) {
    ids.add(SOURCES.ifate.id);
    ids.add(SOURCES.find_apprenticeship.id);
  }

  // Degree-shaped routes referenced.
  if (bestTitle.includes("degree") || bestTitle.includes("university") || backupTitle.includes("degree")) {
    ids.add(SOURCES.discover_uni.id);
  }

  // Regulator sources for regulated roles.
  for (const s of roleRegulationSources(role)) ids.add(s.id);

  const order: SourceCategory[] = [
    "regulation",
    "pathway",
    "apprenticeship",
    "salary",
    "demand",
    "local",
    "ai_impact",
  ];
  return Array.from(ids)
    .map((id) => SOURCES[id])
    .filter((s): s is SourceEntry => Boolean(s))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/**
 * Has any source we would cite become older than `months` since lastChecked?
 * Used to surface a soft "review pending" notice rather than hiding data.
 */
export function hasOutdatedSources(
  sources: SourceEntry[],
  asOf: Date = new Date(),
  months = 12,
): boolean {
  const cutoff = new Date(asOf);
  cutoff.setMonth(cutoff.getMonth() - months);
  return sources.some((s) => {
    const d = new Date(s.lastChecked);
    return Number.isFinite(d.getTime()) && d < cutoff;
  });
}

// ── "Why this result?" — explain which answers influenced the verdict ───────

export interface InfluencingAnswer {
  label: string;
  value: string;
  /** Short, cautious explanation of how this answer shaped the result. */
  influence: string;
}

const ANSWER_INFLUENCES = {
  startingPoint: "Used to pick which pathway text to weight most heavily.",
  englishMaths: "Affects whether a bridging step (e.g. functional skills) is suggested before a regulated route.",
  scienceSubjects: "Affects whether science-based routes are flagged as needing a top-up.",
  qualificationLevel: "Sets the realistic starting point for time-to-entry estimates.",
  englishComfort: "May add a recommendation to plan for English-language support.",
  incomeNeed: "A strong need to earn while training pushes salaried routes (e.g. apprenticeships) up.",
  weeklyHours: "Low weekly hours reduce confidence in full-time study routes.",
  budget: "Limited budget pushes employer-funded or low-cost routes up.",
  area: "Used to describe local realism in approximate terms only — not live vacancy data.",
  commuteFlex: "Affects whether remote or relocation-friendly routes are preferred.",
  relevantBackground: "Helps judge whether 'adjacent' or 'graduate' routes are realistic given prior experience.",
} as const;

const startingPointLabel: Record<string, string> = {
  school_leaver: "School leaver",
  graduate: "Graduate",
  career_changer: "Career changer",
  adjacent: "Adjacent / related experience",
  no_background: "No background",
};
const incomeNeedLabel: Record<string, string> = {
  need_income: "Needs income while training",
  full_time_study: "Can study full-time",
  part_time_ok: "Part-time income is okay",
};
const weeklyHoursLabel: Record<string, string> = {
  "0_5": "0–5 hours per week",
  "5_10": "5–10 hours per week",
  "10_20": "10–20 hours per week",
  "20_plus": "20+ hours per week",
};
const budgetLabel: Record<string, string> = {
  zero: "£0 budget",
  under_500: "Under £500 budget",
  "500_2000": "£500–£2,000 budget",
  "2000_plus": "£2,000+ budget",
};
const commuteFlexLabel: Record<string, string> = {
  "30_min": "Up to 30 min commute",
  "60_min": "Up to 60 min commute",
  can_relocate: "Can relocate",
  remote_only: "Remote / online only",
};
const englishMathsLabel: Record<string, string> = {
  both: "Has English and maths",
  english_only: "Has English only",
  maths_only: "Has maths only",
  no: "No English or maths yet",
  not_sure: "Not sure about English / maths",
  international: "International equivalent",
};

export function getInfluencingAnswers(a: RealityCheckAnswers): InfluencingAnswer[] {
  const out: InfluencingAnswer[] = [];
  if (a.startingPoint) {
    out.push({
      label: "Starting point",
      value: startingPointLabel[a.startingPoint] ?? a.startingPoint,
      influence: ANSWER_INFLUENCES.startingPoint,
    });
  }
  if (a.relevantBackground?.trim()) {
    out.push({
      label: "Relevant background",
      value: a.relevantBackground.trim(),
      influence: ANSWER_INFLUENCES.relevantBackground,
    });
  }
  if (a.englishMaths) {
    out.push({
      label: "English & maths",
      value: englishMathsLabel[a.englishMaths] ?? a.englishMaths,
      influence: ANSWER_INFLUENCES.englishMaths,
    });
  }
  if (a.incomeNeed) {
    out.push({
      label: "Income need",
      value: incomeNeedLabel[a.incomeNeed] ?? a.incomeNeed,
      influence: ANSWER_INFLUENCES.incomeNeed,
    });
  }
  if (a.weeklyHours) {
    out.push({
      label: "Weekly hours",
      value: weeklyHoursLabel[a.weeklyHours] ?? a.weeklyHours,
      influence: ANSWER_INFLUENCES.weeklyHours,
    });
  }
  if (a.budget) {
    out.push({
      label: "Budget",
      value: budgetLabel[a.budget] ?? a.budget,
      influence: ANSWER_INFLUENCES.budget,
    });
  }
  if (a.area?.trim()) {
    out.push({
      label: "Area",
      value: a.area.trim(),
      influence: ANSWER_INFLUENCES.area,
    });
  }
  if (a.commuteFlex) {
    out.push({
      label: "Commute / relocation",
      value: commuteFlexLabel[a.commuteFlex] ?? a.commuteFlex,
      influence: ANSWER_INFLUENCES.commuteFlex,
    });
  }
  return out;
}

/**
 * Items the user should verify independently before acting on the result.
 * Deliberately cautious: we never assert eligibility or guaranteed outcomes.
 */
export function getThingsToVerify(role: RoleContext, answers: RealityCheckAnswers): string[] {
  const items: string[] = [
    "Confirm current entry requirements with the course, employer or regulator directly — they change.",
    "Check live vacancies in your area before assuming a route is open locally.",
  ];
  const name = (role.role_name ?? "").toLowerCase();
  if (/(nurse|midwif|paramedic|therapist|pharmacist|dentist|doctor)/.test(name)) {
    items.push("Confirm the course is approved by the relevant UK regulator (e.g. NMC, HCPC, GMC, GPhC).");
  }
  if (answers.englishMaths === "no" || answers.englishMaths === "not_sure") {
    items.push("Check whether the route requires GCSE English and maths (or an accepted equivalent) before applying.");
  }
  if (answers.budget === "zero" || answers.budget === "under_500") {
    items.push("Check funding eligibility (student finance, advanced learner loan, employer funding) before committing.");
  }
  return items;
}
