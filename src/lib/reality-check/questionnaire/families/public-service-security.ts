// Public-service / security family questions.
//
// Introduced with the Police Officer module. First deep-reviewed role in the
// existing `public_service_security` taxonomy family.
//
// Design constraints (v4 brief):
//   - `highest_qualification` uses `international` and `unknown` as distinct
//     values. `not_sure` is NOT a value here — `unknown` is the only
//     highest-qualification uncertainty value.
//   - `english_maths_status = not_sure` is a valid answer but gates to
//     `insufficient_information` (see engine).
//   - `checks_before_applying` is check-only; its values are topics to check
//     with the recruiting force, never disclosures. It never affects
//     eligibility. `residency`, `nationality`, `immigration` and `visa`
//     tokens are banned; the neutral value `national_eligibility_criteria`
//     covers force-level eligibility screening.
//   - No question asks the user to disclose medical history, health
//     condition, disability, criminal record, cautions, DBS status,
//     vetting outcome, immigration, visa, nationality or residency.

import type { Question } from "../types";

export const policeStartingPointQuestion: Question = {
  id: "starting_point",
  phase: "starting_point",
  title: "Where are you starting from?",
  helpText: "Choose the option that best describes you right now.",
  whyWeAsk:
    "Your starting point affects which police constable route may be structurally relevant. Former officers go through a force-specific rejoiner check, not a beginner training route.",
  controlType: "single_select",
  options: [
    { value: "school_leaver",                 label: "I'm at or leaving school / college" },
    { value: "career_changer",                label: "I'm changing career" },
    { value: "graduate",                      label: "I already have a degree" },
    { value: "returning_to_work",             label: "I'm returning to work after a break" },
    { value: "currently_in_public_service",   label: "I currently work in the armed forces or other public service" },
    { value: "former_police_officer",         label: "I was previously a police officer in the UK" },
    { value: "not_sure",                      label: "I'm not sure yet" },
  ],
};

export const policeHighestQualificationQuestion: Question = {
  id: "highest_qualification",
  phase: "qualifications",
  title: "What's your highest completed qualification?",
  whyWeAsk:
    "Police constable routes require a UK Level 3 (e.g. A-levels) or force-accepted equivalent experience. Your level affects which routes may be structurally open now and which need verification or a bridging step first.",
  controlType: "single_select",
  options: [
    { value: "none",                          label: "No formal qualifications yet" },
    { value: "gcse",                          label: "GCSEs (or equivalent)" },
    { value: "a_level_or_level_3",            label: "A-levels, BTEC, T Level or another Level 3" },
    { value: "professional_policing_degree",  label: "Professional Policing Degree (pre-join)" },
    { value: "bachelors_any_subject",         label: "Bachelor's degree in any subject" },
    { value: "masters_plus",                  label: "Master's degree or higher" },
    { value: "international",                 label: "A qualification from outside the UK" },
    { value: "unknown",                       label: "I'm not sure of the level" },
  ],
};

export const policeEnglishMathsStatusQuestion: Question = {
  id: "english_maths_status",
  phase: "qualifications",
  title: "Do you have English and maths at GCSE grade 4/C or equivalent?",
  whyWeAsk:
    "GCSE English and maths (or accepted equivalent) is a common force entry expectation. Missing either is a bridging step, not a blocker.",
  controlType: "single_select",
  options: [
    { value: "english_and_maths_met", label: "Yes — I have both (or accepted equivalents)" },
    { value: "one_missing",           label: "I have one but not the other" },
    { value: "neither_met",           label: "I don't have either yet" },
    { value: "not_sure",              label: "I'm not sure" },
  ],
};

export const currentPublicServiceExperienceQuestion: Question = {
  id: "current_public_service_experience",
  phase: "starting_point",
  title: "Do you currently have (or recently held) any of these public-service roles?",
  whyWeAsk:
    "Forces may accept Special Constable, PCSO, armed forces or comparable public-service experience as equivalent to Level 3 for entry. Whether they accept it is a force decision — this checker never guarantees it.",
  controlType: "single_select",
  options: [
    { value: "none",                                              label: "None of these" },
    { value: "pcso",                                              label: "Police Community Support Officer (PCSO)" },
    { value: "special_constable",                                 label: "Special Constable" },
    { value: "armed_forces",                                      label: "Armed forces (serving or veteran)" },
    { value: "prison_border_security_or_emergency_services",      label: "Prison, Border Force, security or emergency services" },
    { value: "other_relevant_public_service",                     label: "Other relevant public-service role" },
    { value: "not_sure",                                          label: "I'm not sure" },
  ],
};

export const policeRoutePreferenceQuestion: Question = {
  id: "route_preference",
  phase: "practical_constraints",
  title: "What kind of route would suit you best?",
  whyWeAsk:
    "Your preference re-ranks routes that are already structurally open. It never opens a route that isn't otherwise available to you.",
  controlType: "single_select",
  options: [
    { value: "fastest_application_route", label: "Apply as quickly as I can" },
    { value: "earn_while_training",       label: "Earn a wage while I train" },
    { value: "degree_first",              label: "Complete a degree first, then apply" },
    { value: "not_sure",                  label: "I'm not sure yet" },
  ],
};

export const policeStudyPatternAvailableQuestion: Question = {
  id: "study_pattern_available",
  phase: "practical_constraints",
  title: "What study or work pattern could you commit to?",
  whyWeAsk:
    "Different routes assume different patterns — full-time degree, work-based apprenticeship, or on-the-job training with a force.",
  controlType: "single_select",
  options: [
    { value: "full_time_study_possible",     label: "Full-time study is possible" },
    { value: "work_based_training_preferred", label: "I'd prefer work-based training" },
    { value: "need_to_keep_earning",         label: "I need to keep earning throughout" },
    { value: "flexible",                     label: "I'm flexible" },
    { value: "not_sure",                     label: "I'm not sure yet" },
  ],
};

export const policeRegionAvailabilityQuestion: Question = {
  id: "region_availability",
  phase: "practical_constraints",
  title: "Where are you willing to apply?",
  whyWeAsk:
    "Recruitment cycles and available routes vary by force. This is captured for caveat copy — it never changes eligibility.",
  controlType: "single_select",
  options: [
    { value: "england_wales_any_force", label: "Any force in England or Wales" },
    { value: "specific_region",         label: "A specific region or force" },
    { value: "not_sure",                label: "I'm not sure yet" },
  ],
};

export const checksBeforeApplyingQuestion: Question = {
  id: "checks_before_applying",
  phase: "practical_constraints",
  title: "Which topics do you want to check with the recruiting force before applying?",
  helpText:
    "These are things to look up with the force — they are not disclosures and never change what routes are open to you.",
  whyWeAsk:
    "Forces publish their own fitness, medical, vetting and eligibility criteria. This question points you at what to check with them. It never affects the route recommendation.",
  controlType: "multi_select",
  options: [
    { value: "fitness_or_medical_process",   label: "The fitness and medical assessment process" },
    { value: "vetting_process",              label: "How the force's vetting process works" },
    { value: "national_eligibility_criteria", label: "National and force-level eligibility criteria" },
    { value: "driving_licence_process",      label: "Driving licence expectations" },
    { value: "none_of_these",                label: "None of these", exclusive: true },
  ],
};

export const policePriorityQuestion: Question = {
  id: "police_priority",
  phase: "practical_constraints",
  title: "What matters most when choosing your route into policing?",
  whyWeAsk:
    "Priorities reorder eligible routes only — they never open a route that isn't structurally available to you.",
  controlType: "single_select",
  options: [
    { value: "avoid_student_debt",         label: "Avoiding student debt" },
    { value: "graduate_as_fast_as_possible", label: "Applying as fast as possible" },
    { value: "keep_earning_while_training", label: "Keeping an income throughout" },
    { value: "structured_academic_route",  label: "A structured academic route" },
    { value: "not_sure",                   label: "I'm not sure yet" },
  ],
};
