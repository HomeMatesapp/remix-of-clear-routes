// Electrician-specific questions + config.
//
// Two questions live here: electrical_qualification (with a conditional
// qualification-name field) and maths_english_status. Everything else is
// composed from universal + skilled-trades definitions.

import type { Question, RoleConfig } from "../types";
import { extractElectricianSignals } from "../signals";


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

export const mathsEnglishQuestion: Question = {
  id: "maths_english_status",
  phase: "qualifications",
  title: "Which best describes your maths and English qualifications?",
  whyWeAsk:
    "Some training providers and apprenticeships have maths and English entry requirements. Missing qualifications do not necessarily prevent you from becoming an electrician, but they may affect the route or additional study required.",
  controlType: "single_select",
  options: [
    { value: "both",          label: "I have both maths and English" },
    { value: "maths_only",    label: "I have maths but not English" },
    { value: "english_only",  label: "I have English but not maths" },
    { value: "neither",       label: "I do not have either" },
    { value: "international", label: "I have qualifications from outside the UK" },
    { value: "not_sure",      label: "I'm not sure" },
  ],
};

export const electricianConfig: RoleConfig = {
  roleSlug: "electrician",
  family: "skilled-trades",
  engineId: "electrician-v1",
  questionnaireVersion: "electrician-v1",
  questionIds: [
    "starting_point",
    "relevant_experience",
    "electrical_qualification",
    "maths_english_status",
    "training_availability",
    "training_budget",
    "travel_range",
    "working_conditions_to_check",
    "route_priorities",
  ],
  requestBodyKey: "electricianSignals",
  extractSignals: extractElectricianSignals,
};

