// Signal extraction for the Electrician engine.
//
// Deterministic mapping from raw answer values to structured signals. Free
// text is captured for display but NEVER used as an eligibility signal.

import type { AnswerMap, InlineTextMap } from "./types";

export type ElectricianStartingPoint =
  | "still_at_school"
  | "recently_left_education"
  | "career_changer"
  | "construction_or_trade"
  | "some_electrical_work"
  | "returning_after_break"
  | "none_fit"
  | "not_sure_yet";

export type ElectricianQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export type MathsEnglishStatus =
  | "both"
  | "maths_only"
  | "english_only"
  | "neither"
  | "international"
  | "not_sure";

export type TrainingBudgetBand =
  | "free_only"
  | "up_to_500"
  | "500_to_2000"
  | "over_2000"
  | "depends"
  | "not_sure";

export type TravelRange =
  | "local_no_car"
  | "up_to_30"
  | "up_to_60"
  | "wider_area"
  | "can_relocate"
  | "depends"
  | "not_sure";

export interface ElectricianSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasElectricalExperience: boolean;
  hasRelatedTradeExperience: boolean;
  electricalQualificationLevel: ElectricianQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const extractElectricianSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): ElectricianSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasElectricalExperience: experience.includes("electrical_work"),
    hasRelatedTradeExperience:
      experience.includes("construction_or_trade") ||
      experience.includes("engineering_technical"),
    electricalQualificationLevel:
      asString(answers.electrical_qualification) as ElectricianQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Plumber ──────────────────────────────────────────────────────────────────

export type PlumberQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "gas_heating"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export interface PlumberSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasPlumbingExperience: boolean;
  hasRelatedTradeExperience: boolean;
  plumbingQualificationLevel: PlumberQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

export const extractPlumberSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): PlumberSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasPlumbingExperience: experience.includes("plumbing_work"),
    hasRelatedTradeExperience:
      experience.includes("gas_or_heating") ||
      experience.includes("construction_or_trade") ||
      experience.includes("engineering_technical"),
    plumbingQualificationLevel:
      asString(answers.plumbing_qualification) as PlumberQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Heating Engineer (slug: hvac-engineer) ───────────────────────────────────

export type HeatingEngineerQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "gas_or_gas_safe_claimed"
  | "heat_pump_or_low_carbon"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export interface HeatingEngineerSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasHeatingExperience: boolean;
  hasGasExperience: boolean;
  hasPlumbingExperience: boolean;
  hasBuildingServicesExperience: boolean;
  hasElectricalControlsExperience: boolean;
  hasRelatedTradeExperience: boolean;
  heatingQualificationLevel: HeatingEngineerQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

export const extractHeatingEngineerSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): HeatingEngineerSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasHeatingExperience: experience.includes("heating_install_service"),
    hasGasExperience: experience.includes("gas_appliance_or_systems"),
    hasPlumbingExperience: experience.includes("plumbing_or_domestic_heat"),
    hasBuildingServicesExperience: experience.includes("building_services_hvac"),
    hasElectricalControlsExperience: experience.includes("electrical_controls"),
    hasRelatedTradeExperience:
      experience.includes("construction_or_trade") ||
      experience.includes("practical_projects"),
    heatingQualificationLevel:
      asString(answers.heating_qualification) as HeatingEngineerQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Software Engineer (slug: software-engineer) ──────────────────────────────
//
// portfolioUrl is captured for display in Review ONLY. The engine's eligibility
// input strips it before evaluation (see route-engines/software-engineer.ts →
// stripPortfolioUrl). The extractor keeps it here so the wizard can render it.

export type SoftwareEngineerStartingPoint =
  | "still_at_school"
  | "recently_left_education"
  | "career_changer"
  | "adjacent_tech_role"
  | "already_coding_at_work"
  | "returning_after_break"
  | "none_fit"
  | "not_sure_yet";

export type SoftwareEngineerHighestQualification =
  | "none"
  | "gcse"
  | "a_level"
  | "l3_vocational"
  | "bachelors_cs"
  | "bachelors_non_cs"
  | "masters_plus"
  | "international"
  | "unknown";

export type SoftwareEngineerMastersSubject =
  | "computing"
  | "non_computing"
  | "unknown";

export type SoftwareEngineerCodingExperience =
  | "none"
  | "hobbyist"
  | "self_taught_6m_plus"
  | "bootcamp_grad"
  | "paid_experience";

export type SoftwareEngineerPortfolioState =
  | "none"
  | "tutorials_only"
  | "personal_projects"
  | "deployed"
  | "open_source";

export type SoftwareEngineerLearningTime =
  | "lt5"
  | "5_15"
  | "15_30"
  | "30_plus";

export type SoftwareEngineerTrainingBudget =
  | "0"
  | "0_2k"
  | "2k_10k"
  | "10k_plus";

export type SoftwareEngineerLocationFlexibility =
  | "remote_only"
  | "hybrid_region"
  | "relocate"
  | "london_only";

export interface SoftwareEngineerSignals {
  startingPoint: SoftwareEngineerStartingPoint | null;
  codingExperience: SoftwareEngineerCodingExperience | null;
  portfolioState: SoftwareEngineerPortfolioState | null;
  /** Display-only. Never used for eligibility or scoring. */
  portfolioUrl?: string;
  highestQualification: SoftwareEngineerHighestQualification | null;
  mastersSubject?: SoftwareEngineerMastersSubject;
  mathsEnglishStatus: MathsEnglishStatus | null;
  learningTimeHoursPerWeek: SoftwareEngineerLearningTime | null;
  trainingBudgetGbp: SoftwareEngineerTrainingBudget | null;
  locationFlexibility: SoftwareEngineerLocationFlexibility | null;
  routePriorities: string[];
}

const PORTFOLIO_STATES_ALLOWING_URL: ReadonlySet<SoftwareEngineerPortfolioState> =
  new Set(["personal_projects", "deployed", "open_source"]);

export const extractSoftwareEngineerSignals = (
  answers: AnswerMap,
  inline: InlineTextMap = {},
): SoftwareEngineerSignals => {
  const portfolioState = asString(answers.portfolio_state) as
    | SoftwareEngineerPortfolioState
    | null;

  // Portfolio URL clears whenever the state moves away from a state that
  // supports it. Enforced here (in the extractor) so the invariant holds even
  // if the UI reducer misses the transition — cheap defence in depth.
  let portfolioUrl: string | undefined;
  if (
    portfolioState &&
    PORTFOLIO_STATES_ALLOWING_URL.has(portfolioState)
  ) {
    const raw = inline.portfolio_state ?? inline.portfolio_url;
    if (typeof raw === "string" && raw.trim().length > 0) {
      portfolioUrl = raw.trim();
    }
  }

  const highest = asString(answers.highest_qualification) as
    | SoftwareEngineerHighestQualification
    | null;
  const mastersSubjectRaw = asString(answers.masters_subject) as
    | SoftwareEngineerMastersSubject
    | null;

  // Accept `digital_route_priorities` (new) and legacy `route_priorities` so
  // both question ids feed the same signal.
  const priorities = asArray(answers.digital_route_priorities).length
    ? asArray(answers.digital_route_priorities)
    : asArray(answers.route_priorities);

  return {
    startingPoint: asString(answers.starting_point) as
      | SoftwareEngineerStartingPoint
      | null,
    codingExperience: asString(answers.coding_experience) as
      | SoftwareEngineerCodingExperience
      | null,
    portfolioState,
    ...(portfolioUrl !== undefined ? { portfolioUrl } : {}),
    highestQualification: highest,
    ...(highest === "masters_plus" && mastersSubjectRaw
      ? { mastersSubject: mastersSubjectRaw }
      : {}),
    mathsEnglishStatus: asString(answers.maths_english_status) as
      | MathsEnglishStatus
      | null,
    learningTimeHoursPerWeek: asString(
      answers.learning_time_available,
    ) as SoftwareEngineerLearningTime | null,
    trainingBudgetGbp: asString(answers.training_budget) as
      | SoftwareEngineerTrainingBudget
      | null,
    locationFlexibility: asString(answers.location_flexibility) as
      | SoftwareEngineerLocationFlexibility
      | null,
    routePriorities: priorities,
  };
};
