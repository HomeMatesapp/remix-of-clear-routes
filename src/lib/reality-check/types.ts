// Shared types for the Reality-check route judgement engine.
// Server (edge function) and client (RealityCheckRoute UI) both import from here
// so the schema stays in one place.

export type StartingPoint =
  | "school_leaver"
  | "graduate"
  | "career_changer"
  | "adjacent"
  | "no_background";

export type IncomeNeed = "need_income" | "full_time_study" | "part_time_ok";

export type WeeklyHours = "0_5" | "5_10" | "10_20" | "20_plus";

export type Budget = "zero" | "under_500" | "500_2000" | "2000_plus";

export type CommuteFlex = "30_min" | "60_min" | "can_relocate" | "remote_only";

// Qualifications & study readiness — added so Reality-check can judge whether
// a user appears to meet likely basic entry requirements before recommending
// a route (e.g. GCSE English/maths for healthcare; subject background for STEM).
export type EnglishMaths =
  | "both"
  | "english_only"
  | "maths_only"
  | "no"
  | "not_sure"
  | "international";

export type ScienceSubjects =
  | "yes"
  | "some"
  | "no"
  | "not_sure"
  | "international";

export type QualificationLevel =
  | "level_2"
  | "level_3"
  | "access"
  | "undergrad"
  | "postgrad"
  | "professional"
  | "international"
  | "none"
  | "not_sure";

export type EnglishComfort =
  | "yes"
  | "mostly"
  | "not_sure"
  | "may_need_support";

export interface RealityCheckAnswers {
  startingPoint: StartingPoint | null;
  // Qualifications & background
  relevantBackground: string;
  englishMaths: EnglishMaths | null;
  scienceSubjects: ScienceSubjects | null;
  qualificationLevel: QualificationLevel | null;
  englishComfort: EnglishComfort | null;
  // Situation
  incomeNeed: IncomeNeed | null;
  weeklyHours: WeeklyHours | null;
  budget: Budget | null;
  area: string;
  commuteFlex: CommuteFlex | null;
  notes: string;
}

export const STARTING_POINTS: { value: StartingPoint; label: string }[] = [
  { value: "school_leaver",   label: "School leaver" },
  { value: "graduate",        label: "Graduate" },
  { value: "career_changer",  label: "Career changer" },
  { value: "adjacent",        label: "Adjacent / related experience" },
  { value: "no_background",   label: "No background" },
];

export const INCOME_NEEDS: { value: IncomeNeed; label: string }[] = [
  { value: "need_income",     label: "Yes, I need income" },
  { value: "full_time_study", label: "No, I can study full-time" },
  { value: "part_time_ok",    label: "Part-time income is okay" },
];

export const WEEKLY_HOURS: { value: WeeklyHours; label: string }[] = [
  { value: "0_5",     label: "0–5 hours" },
  { value: "5_10",    label: "5–10 hours" },
  { value: "10_20",   label: "10–20 hours" },
  { value: "20_plus", label: "20+ hours" },
];

export const BUDGETS: { value: Budget; label: string }[] = [
  { value: "zero",        label: "£0" },
  { value: "under_500",   label: "Under £500" },
  { value: "500_2000",    label: "£500–£2,000" },
  { value: "2000_plus",   label: "£2,000+" },
];

export const COMMUTE_FLEX: { value: CommuteFlex; label: string }[] = [
  { value: "30_min",       label: "30 minutes" },
  { value: "60_min",       label: "60 minutes" },
  { value: "can_relocate", label: "Can relocate" },
  { value: "remote_only",  label: "Remote / online only" },
];

export const ENGLISH_MATHS: { value: EnglishMaths; label: string }[] = [
  { value: "both",          label: "Yes — English and maths" },
  { value: "english_only",  label: "English only" },
  { value: "maths_only",    label: "Maths only" },
  { value: "no",            label: "No" },
  { value: "not_sure",      label: "Not sure" },
  { value: "international", label: "International equivalent" },
];

export const SCIENCE_SUBJECTS: { value: ScienceSubjects; label: string }[] = [
  { value: "yes",           label: "Yes — science / related subjects" },
  { value: "some",          label: "Some related subjects" },
  { value: "no",            label: "No" },
  { value: "not_sure",      label: "Not sure" },
  { value: "international", label: "International equivalent" },
];

export const QUALIFICATION_LEVELS: { value: QualificationLevel; label: string }[] = [
  { value: "level_2",       label: "GCSE / Level 2" },
  { value: "level_3",       label: "A-level / BTEC / T Level / Level 3" },
  { value: "access",        label: "Access course" },
  { value: "undergrad",     label: "Undergraduate degree" },
  { value: "postgrad",      label: "Postgraduate degree" },
  { value: "professional",  label: "Professional qualification" },
  { value: "international", label: "International qualification" },
  { value: "none",          label: "No formal qualifications" },
  { value: "not_sure",      label: "Not sure" },
];

export const ENGLISH_COMFORT: { value: EnglishComfort; label: string }[] = [
  { value: "yes",              label: "Yes" },
  { value: "mostly",           label: "Mostly, but I may need support" },
  { value: "not_sure",         label: "Not sure" },
  { value: "may_need_support", label: "I may need English-language support" },
];

export type OverallVerdict =
  | "Realistic"
  | "Realistic but hard"
  | "Long shot"
  | "Probably not for you";

export type Confidence = "high" | "medium" | "low";

export interface BestRoute {
  title: string;
  summary: string;
  whyThisFits: string[];
  estimatedTime: string;
  likelyCost: string;
  mainDifficulty: string;
  confidence: Confidence;
}

export interface BackupRoute {
  title: string;
  summary: string;
  tradeOff: string;
}

export interface RouteToAvoid {
  title: string;
  whyRisky: string;
  whenItMightWork: string;
}

export interface LocalRealism {
  rating: "strong" | "mixed" | "weak";
  summary: string;
  dependsOn: string[];
}

export interface RealityCheckResult {
  overallVerdict: OverallVerdict;
  bestRoute: BestRoute;
  backupRoute: BackupRoute;
  routeToAvoid: RouteToAvoid;
  localRealism: LocalRealism;
  firstMoves: string[];
}

// Subset of role context the engine needs. Keep narrow — the edge function
// receives only what's needed to judge the route.
export interface RoleContext {
  id?: string;
  role_slug?: string;
  role_name: string;
  short_description?: string | null;
  reality_check?: string | null;
  uncomfortable_truth?: string | null;
  opportunity_cost?: string | null;
  who_not_for?: string | null;
  career_regret_risk?: string | null;
  competition_level?: string | null;
  demand?: string | null;
  ai_impact_level?: string | null;
  salary_entry?: number | null;
  salary_experienced?: number | null;
  salary_senior?: number | null;
  pathway_school_leaver?: string | null;
  pathway_graduate?: string | null;
  pathway_adjacent?: string | null;
  pathway_no_background?: string | null;
  typical_backgrounds?: string | null;
  key_employers?: string[] | null;
}
