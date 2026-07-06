// Plumber-specific questions + config.
//
// Second modular skilled-trades role. Reuses universal questions, the
// shared training-availability + maths/English questions, and defines
// plumbing-flavoured relevant_experience, working_conditions and the
// plumbing_qualification question.

import type { Question, RoleConfig } from "../types";
import { extractPlumberSignals } from "../signals";
import {
  startingPointQuestion,
  trainingBudgetQuestion,
  travelRangeQuestion,
  routePrioritiesQuestion,
} from "../universal";
import { trainingAvailabilityQuestion } from "../families/skilled-trades";
import { mathsEnglishQuestion } from "../families/qualifications";

// Plumber-flavoured relevant experience. Same question id as the electrician
// version but with plumbing-oriented options — configs no longer share a
// global bank.
export const plumberRelevantExperienceQuestion: Question = {
  id: "relevant_experience",
  phase: "starting_point",
  title: "What relevant experience do you already have?",
  helpText: "Select everything that applies.",
  whyWeAsk:
    "Relevant experience may help you choose a more suitable route, but it does not automatically count as a plumbing qualification.",
  controlType: "multi_select",
  options: [
    { value: "plumbing_work",         label: "Plumbing installation or maintenance" },
    { value: "gas_or_heating",        label: "Gas, heating or building-services work" },
    { value: "construction_or_trade", label: "Construction or another skilled trade" },
    { value: "engineering_technical", label: "Engineering, manufacturing or technical work" },
    { value: "practical_projects",    label: "Practical hands-on projects" },
    { value: "work_experience",       label: "Work experience or an industry placement" },
    { value: "no_experience",         label: "No directly relevant experience yet", exclusive: true },
    { value: "something_else",        label: "Something else" },
  ],
  conditionalField: {
    showWhenValueIn: ["something_else"],
    label: "Tell us briefly what experience you have.",
    placeholder: "e.g. helped a family friend replace a bathroom suite",
    hint: "We'll show this on your review but won't use it to decide your route.",
  },
};

export const plumbingQualificationQuestion: Question = {
  id: "plumbing_qualification",
  phase: "qualifications",
  title: "Do you already have a plumbing or building-services qualification?",
  whyWeAsk:
    "Some routes are designed for complete beginners, while others build on qualifications or experience you already have. We will not assume that an older or international qualification is equivalent without further checking.",
  controlType: "single_select",
  options: [
    { value: "none",          label: "No plumbing qualification" },
    { value: "foundation",    label: "An introductory or foundation qualification" },
    { value: "level_2",       label: "A Level 2 plumbing qualification or equivalent" },
    { value: "level_3",       label: "A Level 3 plumbing qualification or equivalent" },
    { value: "gas_heating",   label: "A gas, heating or building-services qualification" },
    { value: "older_unknown", label: "An older plumbing qualification" },
    { value: "international", label: "A qualification from outside the UK" },
    { value: "unknown_level", label: "I have one, but I'm not sure what level it is" },
    { value: "not_sure",      label: "I'm not sure" },
  ],
  conditionalField: {
    // Do NOT show the free-text field for "none" or "not_sure" — there is
    // nothing to name.
    showWhenValueIn: [
      "foundation",
      "level_2",
      "level_3",
      "gas_heating",
      "older_unknown",
      "international",
      "unknown_level",
    ],
    label: "What is the qualification called?",
    placeholder: "e.g. City & Guilds 6035 Level 2",
    hint: "We'll show this on your review but won't treat it as verified — verification happens later.",
  },
};

export const plumberWorkingConditionsQuestion: Question = {
  id: "working_conditions_to_check",
  phase: "practical_constraints",
  title: "Which parts of the day-to-day work would you want to check before committing?",
  helpText: "Select anything you would want to understand better.",
  whyWeAsk:
    "Plumbing roles can involve different environments and physical demands. This does not determine whether you can become a plumber — it helps identify what you should investigate before choosing a route.",
  controlType: "multi_select",
  options: [
    { value: "confined_spaces",           label: "Working in confined spaces" },
    { value: "lifting_bending",           label: "Regular lifting, bending or kneeling" },
    { value: "domestic_or_plant_rooms",   label: "Working in bathrooms, kitchens, lofts or plant rooms" },
    { value: "emergency_callouts",        label: "Emergency callouts or irregular hours" },
    { value: "travel_between_customers",  label: "Travelling between customer sites" },
    { value: "none",                      label: "None of these concern me", exclusive: true },
    { value: "need_more_info",            label: "I need more information about the working conditions", exclusive: true },
  ],
};

export const plumberConfig: RoleConfig = {
  roleSlug: "plumber",
  family: "skilled-trades",
  engineId: "plumber-v1",
  questionnaireVersion: "plumber-v1",
  questions: [
    startingPointQuestion,
    plumberRelevantExperienceQuestion,
    plumbingQualificationQuestion,
    mathsEnglishQuestion,
    trainingAvailabilityQuestion,
    trainingBudgetQuestion,
    travelRangeQuestion,
    plumberWorkingConditionsQuestion,
    routePrioritiesQuestion,
  ],
  requestBodyKey: "plumberSignals",
  extractSignals: extractPlumberSignals,
};
