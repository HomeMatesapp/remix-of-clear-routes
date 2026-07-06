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
