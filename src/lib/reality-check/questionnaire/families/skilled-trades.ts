// Skilled-trades family questions.
//
// training_availability lives here (not in universal) because the option set
// meaningfully differs for skilled trades — a full-time work-based route or
// apprenticeship is a first-class route for electricians, plumbers, etc. Other
// role families can define their own training_availability variant.

import type { Question } from "../types";

export const relevantExperienceQuestion: Question = {
  id: "relevant_experience",
  phase: "starting_point",
  title: "What relevant experience do you already have?",
  helpText: "Select everything that applies.",
  whyWeAsk:
    "Relevant experience may help you choose a more suitable route, but it does not automatically count as an electrical qualification.",
  controlType: "multi_select",
  options: [
    { value: "electrical_work",       label: "Electrical installation or maintenance" },
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
    placeholder: "e.g. rewired my parents' garage; helped an uncle on a small site",
    hint: "We'll show this on your review but won't use it to decide your route.",
  },
};

export const workingConditionsQuestion: Question = {
  id: "working_conditions_to_check",
  phase: "practical_constraints",
  title: "Which parts of the day-to-day work would you want to check before committing?",
  helpText: "Select anything you would want to understand better.",
  whyWeAsk:
    "Electrical roles can involve different environments and physical demands. This does not determine whether you can become an electrician — it helps identify what you should investigate before choosing a route.",
  controlType: "multi_select",
  options: [
    { value: "working_at_height",    label: "Working at height or using ladders" },
    { value: "confined_spaces",      label: "Working in confined spaces" },
    { value: "lifting_bending",      label: "Regular lifting, bending or kneeling" },
    { value: "outdoor_or_dusty",     label: "Working in noisy, dusty or outdoor environments" },
    { value: "early_or_travel",      label: "Early starts or travelling between sites" },
    { value: "none",                 label: "None of these concern me", exclusive: true },
    { value: "need_more_info",       label: "I need more information about the working conditions", exclusive: true },
  ],
};

// Skilled-trades training availability. Explicitly names full-time work-based
// routes (apprenticeships) as a distinct option so it is not conflated with
// full-time weekday college.
export const trainingAvailabilityQuestion: Question = {
  id: "training_availability",
  phase: "practical_constraints",
  title: "Which training patterns could you realistically commit to for at least a year?",
  helpText: "Select everything that could work.",
  whyWeAsk:
    "Electrical training is normally offered in fixed formats. Knowing when you can attend helps us avoid suggesting routes that would not fit around your existing commitments.",
  controlType: "multi_select",
  options: [
    { value: "full_time_work_based",  label: "A full-time work-based route or apprenticeship" },
    { value: "full_time_college",     label: "A full-time weekday college or training programme" },
    { value: "one_or_two_weekdays",   label: "One or two weekdays each week" },
    { value: "weekday_evenings",      label: "Weekday evenings" },
    { value: "weekends",              label: "Weekends" },
    { value: "mixed_day_evening",     label: "A mixture of daytime and evening sessions" },
    { value: "availability_varies",   label: "My availability changes regularly" },
    { value: "not_sure_yet",          label: "I'm not sure yet", exclusive: true },
  ],
};
