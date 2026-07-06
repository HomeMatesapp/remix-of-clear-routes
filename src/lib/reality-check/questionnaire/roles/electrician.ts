// Electrician-specific questions + config.
//
// Two questions live here: electrical_qualification (with a conditional
// qualification-name field) and the Electrician working-conditions options.
// Everything else is composed from universal + skilled-trades + shared
// qualifications definitions.

import type { Question, RoleConfig } from "../types";
import { extractElectricianSignals } from "../signals";
import {
  startingPointQuestion,
  trainingBudgetQuestion,
  travelRangeQuestion,
  routePrioritiesQuestion,
} from "../universal";
import {
  relevantExperienceQuestion,
  workingConditionsQuestion,
  trainingAvailabilityQuestion,
} from "../families/skilled-trades";
import { mathsEnglishQuestion } from "../families/qualifications";

export const electricalQualificationQuestion: Question = {
  id: "electrical_qualification",
  phase: "qualifications",
  title: "Do you already have an electrical qualification?",
  whyWeAsk:
    "Some routes are designed for complete beginners, while others build on qualifications or experience you already have. We will not assume that an older or international qualification is equivalent without further checking.",
  controlType: "single_select",
  options: [
    { value: "none",              label: "No electrical qualification" },
    { value: "foundation",        label: "An introductory or foundation qualification" },
    { value: "level_2",           label: "A Level 2 electrical qualification or equivalent" },
    { value: "level_3",           label: "A Level 3 electrical qualification or equivalent" },
    { value: "older_unknown",     label: "An older electrical qualification" },
    { value: "international",     label: "A qualification from outside the UK" },
    { value: "unknown_level",     label: "I have one, but I'm not sure what level it is" },
    { value: "not_sure",          label: "I'm not sure" },
  ],
  conditionalField: {
    showWhenValueIn: [
      "foundation",
      "level_2",
      "level_3",
      "older_unknown",
      "international",
      "unknown_level",
    ],
    label: "What is the qualification called?",
    placeholder: "e.g. City & Guilds 2365 Level 2",
    hint: "We'll show this on your review but won't treat it as verified — verification happens later.",
  },
};

// Re-exported so existing tests that import from ./roles/electrician keep
// working after mathsEnglishQuestion moved to the shared qualifications
// family.
export { mathsEnglishQuestion };

export const electricianConfig: RoleConfig = {
  roleSlug: "electrician",
  family: "skilled-trades",
  engineId: "electrician-v1",
  questionnaireVersion: "electrician-v1",
  questions: [
    startingPointQuestion,
    relevantExperienceQuestion,
    electricalQualificationQuestion,
    mathsEnglishQuestion,
    trainingAvailabilityQuestion,
    trainingBudgetQuestion,
    travelRangeQuestion,
    workingConditionsQuestion,
    routePrioritiesQuestion,
  ],
  requestBodyKey: "electricianSignals",
  extractSignals: extractElectricianSignals,
};
