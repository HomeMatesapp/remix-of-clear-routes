// Human-readable labels for Reality-check answer enums.
// Kept for analytics, debugging, and answer-display use. The deterministic
// engine (Release 1) does not call into an LLM, so these labels are no longer
// strictly required for prompt safety, but the answers-to-labels test still
// runs against this module to prevent enum codes leaking into any future
// downstream consumer.

type Answers = {
  startingPoint: string | null;
  incomeNeed: string | null;
  weeklyHours: string | null;
  budget: string | null;
  area: string;
  commuteFlex: string | null;
  notes: string;
  relevantBackground?: string;
  englishMaths?: string | null;
  scienceSubjects?: string | null;
  qualificationLevel?: string | null;
  englishComfort?: string | null;
};

const STARTING_POINT_LABELS: Record<string, string> = {
  school_leaver:  "school leaver",
  graduate:       "graduate",
  career_changer: "career changer",
  adjacent:       "adjacent or related experience",
  no_background:  "no background",
};
const INCOME_NEED_LABELS: Record<string, string> = {
  need_income:      "needs income while training",
  full_time_study:  "can study full-time",
  part_time_ok:     "part-time income is okay",
};
const WEEKLY_HOURS_LABELS: Record<string, string> = {
  "0_5":     "0–5 hours per week",
  "5_10":    "5–10 hours per week",
  "10_20":   "10–20 hours per week",
  "20_plus": "20+ hours per week",
};
const BUDGET_LABELS: Record<string, string> = {
  zero:        "£0 budget",
  under_500:   "under £500 budget",
  "500_2000":  "£500–£2,000 budget",
  "2000_plus": "£2,000+ budget",
};
const COMMUTE_FLEX_LABELS: Record<string, string> = {
  "30_min":     "can commute up to 30 minutes",
  "60_min":     "can commute up to 60 minutes",
  can_relocate: "can relocate",
  remote_only:  "remote or online only",
};
const ENGLISH_MATHS_LABELS: Record<string, string> = {
  both:          "has GCSE English and maths (or equivalent)",
  english_only:  "has GCSE English only",
  maths_only:    "has GCSE maths only",
  no:            "does not have GCSE English or maths",
  not_sure:      "not sure about GCSE English and maths",
  international: "has an international equivalent for English and maths",
};
const SCIENCE_SUBJECTS_LABELS: Record<string, string> = {
  yes:           "has science or role-related subjects",
  some:          "has some related subjects",
  no:            "does not have science or role-related subjects",
  not_sure:      "not sure about science or role-related subjects",
  international: "has an international equivalent for science/related subjects",
};
const QUALIFICATION_LEVEL_LABELS: Record<string, string> = {
  level_2:       "GCSE / Level 2",
  level_3:       "A-level / BTEC / T Level / Level 3",
  access:        "Access course",
  undergrad:     "undergraduate degree",
  postgrad:      "postgraduate degree",
  professional:  "professional qualification",
  international: "international qualification",
  none:          "no formal qualifications",
  not_sure:      "not sure of highest qualification level",
};
const ENGLISH_COMFORT_LABELS: Record<string, string> = {
  yes:              "comfortable studying and working in English",
  mostly:           "mostly comfortable in English but may need some support",
  not_sure:         "not sure how comfortable they are studying and working in English",
  may_need_support: "may need English-language support",
};

const labelFor = (map: Record<string, string>, v: string | null | undefined): string =>
  v ? (map[v] ?? "(not given)") : "(not given)";

export const answersToLabels = (a: Answers) => ({
  startingPoint:      labelFor(STARTING_POINT_LABELS,      a.startingPoint),
  incomeNeed:         labelFor(INCOME_NEED_LABELS,         a.incomeNeed),
  weeklyHours:        labelFor(WEEKLY_HOURS_LABELS,        a.weeklyHours),
  budget:             labelFor(BUDGET_LABELS,              a.budget),
  commuteFlex:        labelFor(COMMUTE_FLEX_LABELS,        a.commuteFlex),
  englishMaths:       labelFor(ENGLISH_MATHS_LABELS,       a.englishMaths ?? null),
  scienceSubjects:    labelFor(SCIENCE_SUBJECTS_LABELS,    a.scienceSubjects ?? null),
  qualificationLevel: labelFor(QUALIFICATION_LEVEL_LABELS, a.qualificationLevel ?? null),
  englishComfort:     labelFor(ENGLISH_COMFORT_LABELS,     a.englishComfort ?? null),
});
