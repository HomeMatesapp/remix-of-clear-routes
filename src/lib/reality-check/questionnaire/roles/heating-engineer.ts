// Heating Engineer (uses existing slug `hvac-engineer`) — third modular
// skilled-trades role. Scoped to reviewed structural training routes for
// heating / domestic-heating / building-services work. Does NOT claim Gas
// Safe registration, qualification equivalence, or local availability
// unless verified evidence exists.
//
// Reuses:
//   - universal starting_point / training_budget / travel_range / route_priorities
//   - shared skilled-trades training_availability
//   - shared maths/English question
//
// Role-specific:
//   - relevant_experience (heating/gas/plumbing/building-services flavour)
//   - heating_qualification
//   - working_conditions_to_check (heating/gas plant-room flavour)

import type { Question, RoleConfig } from "../types";
import { extractHeatingEngineerSignals } from "../signals";
import {
  startingPointQuestion,
  trainingBudgetQuestion,
  travelRangeQuestion,
  routePrioritiesQuestion,
} from "../universal";
import { trainingAvailabilityQuestion } from "../families/skilled-trades";
import { mathsEnglishQuestion } from "../families/qualifications";

export const heatingEngineerRelevantExperienceQuestion: Question = {
  id: "relevant_experience",
  phase: "starting_point",
  title: "What relevant experience do you already have?",
  helpText: "Select everything that applies.",
  whyWeAsk:
    "Relevant experience may help you choose a more suitable route, but it does not automatically count as a heating, gas or building-services qualification, and does not imply Gas Safe registration.",
  controlType: "multi_select",
  options: [
    { value: "heating_install_service",    label: "Heating system installation or servicing" },
    { value: "plumbing_or_domestic_heat",  label: "Plumbing or domestic heating work" },
    { value: "gas_appliance_or_systems",   label: "Gas appliance or gas systems work" },
    { value: "building_services_hvac",     label: "Building services, HVAC or plant-room work" },
    { value: "electrical_controls",        label: "Electrical controls, wiring or fault-finding" },
    { value: "construction_or_trade",      label: "Construction or another skilled trade" },
    { value: "practical_projects",         label: "Practical hands-on projects" },
    { value: "no_experience",              label: "No directly relevant experience yet", exclusive: true },
    { value: "something_else",             label: "Something else" },
  ],
  conditionalField: {
    showWhenValueIn: ["something_else"],
    label: "Tell us briefly what experience you have.",
    placeholder: "e.g. helped install a home combi boiler",
    hint: "We'll show this on your review but won't use it to decide your route.",
  },
};

export const heatingQualificationQuestion: Question = {
  id: "heating_qualification",
  phase: "qualifications",
  title: "Do you already have a heating, gas, plumbing or building-services qualification?",
  whyWeAsk:
    "Some routes are designed for complete beginners, while others build on qualifications or experience you already have. A gas answer does not mean we treat you as Gas Safe registered — Gas Safe status is a legal register and needs verifying separately.",
  controlType: "single_select",
  options: [
    { value: "none",                     label: "No heating-related qualification" },
    { value: "foundation",               label: "An introductory or foundation qualification" },
    { value: "level_2",                  label: "A Level 2 plumbing, heating or building-services qualification" },
    { value: "level_3",                  label: "A Level 3 plumbing, domestic heating or building-services qualification" },
    { value: "gas_or_gas_safe_claimed",  label: "A gas qualification or current Gas Safe registration" },
    { value: "heat_pump_or_low_carbon",  label: "A heat pump or low-carbon heating qualification" },
    { value: "older_unknown",            label: "An older heating, plumbing or gas qualification" },
    { value: "international",            label: "A qualification from outside the UK" },
    { value: "unknown_level",            label: "I have one, but I'm not sure what level it is" },
    { value: "not_sure",                 label: "I'm not sure" },
  ],
  conditionalField: {
    // Do NOT show the free-text field for "none" or "not_sure".
    showWhenValueIn: [
      "foundation",
      "level_2",
      "level_3",
      "gas_or_gas_safe_claimed",
      "heat_pump_or_low_carbon",
      "older_unknown",
      "international",
      "unknown_level",
    ],
    label: "What is the qualification, registration or certificate called?",
    placeholder: "e.g. ACS CCN1 + CENWAT, City & Guilds 6035 L2",
    hint: "We'll show this on your review but won't treat it as verified — verification happens later.",
  },
};

export const heatingEngineerWorkingConditionsQuestion: Question = {
  id: "working_conditions_to_check",
  phase: "practical_constraints",
  title: "Which parts of the day-to-day work would you want to check before committing?",
  helpText: "Select anything you would want to understand better.",
  whyWeAsk:
    "Heating work can involve different environments and physical demands. This does not determine whether you can become a heating engineer — it helps identify what you should investigate before choosing a route.",
  controlType: "multi_select",
  options: [
    { value: "safety_critical_systems",   label: "Working with safety-critical heating or gas systems" },
    { value: "confined_or_plant_rooms",   label: "Working in confined spaces, lofts or plant rooms" },
    { value: "lifting_bending",           label: "Regular lifting, bending or kneeling" },
    { value: "customer_sites",            label: "Working in homes, commercial buildings or occupied customer sites" },
    { value: "emergency_callouts",        label: "Emergency callouts or irregular hours" },
    { value: "travel_between_customers",  label: "Travelling between customer sites" },
    { value: "none",                      label: "None of these concern me", exclusive: true },
    { value: "need_more_info",            label: "I need more information about the working conditions", exclusive: true },
  ],
};

export const heatingEngineerConfig: RoleConfig = {
  // Uses the existing DB slug `hvac-engineer` — the National Careers Service
  // labels this "heating and ventilation engineer". No `heating-engineer`
  // slug exists in the roles table.
  roleSlug: "hvac-engineer",
  family: "skilled-trades",
  engineId: "heating-engineer-v1",
  questionnaireVersion: "heating-engineer-v1",
  questions: [
    startingPointQuestion,
    heatingEngineerRelevantExperienceQuestion,
    heatingQualificationQuestion,
    mathsEnglishQuestion,
    trainingAvailabilityQuestion,
    trainingBudgetQuestion,
    travelRangeQuestion,
    heatingEngineerWorkingConditionsQuestion,
    routePrioritiesQuestion,
  ],
  requestBodyKey: "heatingEngineerSignals",
  extractSignals: extractHeatingEngineerSignals,
  scopeNote:
    "This Reality-check covers heating, ventilation, building-services and related domestic-heating routes. Gas Safe registration, heat-pump certification and qualification equivalence must be checked separately.",
};

