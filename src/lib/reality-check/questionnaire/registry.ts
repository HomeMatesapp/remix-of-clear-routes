// Resolve a RoleConfig by role slug. Slug is the ONLY primary key —
// display names are copy and may change.

import type { Question, ResolvedConfig, RoleConfig } from "./types";
import {
  startingPointQuestion,
  trainingBudgetQuestion,
  travelRangeQuestion,
  routePrioritiesQuestion,
} from "./universal";
import {
  relevantExperienceQuestion,
  workingConditionsQuestion,
  trainingAvailabilityQuestion,
} from "./families/skilled-trades";
import {
  electricalQualificationQuestion,
  mathsEnglishQuestion,
  electricianConfig,
} from "./roles/electrician";

const QUESTION_BANK: Record<string, Question> = {
  starting_point: startingPointQuestion,
  training_budget: trainingBudgetQuestion,
  travel_range: travelRangeQuestion,
  route_priorities: routePrioritiesQuestion,
  relevant_experience: relevantExperienceQuestion,
  working_conditions_to_check: workingConditionsQuestion,
  training_availability: trainingAvailabilityQuestion,
  electrical_qualification: electricalQualificationQuestion,
  maths_english_status: mathsEnglishQuestion,
};

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  [electricianConfig.roleSlug]: electricianConfig,
};

export const hasModularConfig = (roleSlug: string): boolean =>
  Object.prototype.hasOwnProperty.call(ROLE_CONFIGS, roleSlug);

export const resolveConfig = (roleSlug: string): ResolvedConfig | null => {
  const cfg = ROLE_CONFIGS[roleSlug];
  if (!cfg) return null;
  const questions = cfg.questionIds.map((id) => {
    const q = QUESTION_BANK[id];
    if (!q) throw new Error(`Unknown question id "${id}" in config for ${roleSlug}`);
    return q;
  });
  return { ...cfg, questions };
};

// Exposed for tests.
export const _internal = { QUESTION_BANK, ROLE_CONFIGS };
