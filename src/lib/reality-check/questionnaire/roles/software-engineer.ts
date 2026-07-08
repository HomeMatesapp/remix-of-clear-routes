// Software Engineer role config.
//
// First non-trades reviewed modular Reality Check. Proves the digital /
// portfolio route family (self-taught, bootcamp, degree, conversion MSc,
// digital apprenticeship, junior-role-with-training) without borrowing any
// of the existing skilled-trades questionnaire logic.
//
// - Reuses the shared `maths_english_status` question (families/qualifications).
// - Reuses universal `starting_point` question but the engine also accepts
//   the digital-only `already_coding_at_work` value handled by the extractor.
// - Uses `digital_route_priorities` (NOT the universal `route_priorities`) so
//   the reviewed trades priority question is not mutated.
// - Free text (`portfolio_url`, inline notes) never reaches the engine.

import type { Question, RoleConfig } from "../types";
import { extractSoftwareEngineerSignals } from "../signals";
import { startingPointQuestion } from "../universal";
import { mathsEnglishQuestion } from "../families/qualifications";
import {
  softwareHighestQualificationQuestion,
  mastersSubjectQuestion,
  codingExperienceQuestion,
  portfolioStateQuestion,
  learningTimeAvailableQuestion,
  digitalTrainingBudgetQuestion,
  locationFlexibilityQuestion,
  digitalRoutePrioritiesQuestion,
} from "../families/digital-portfolio";

// Universal starting-point question augmented with a digital-only option.
// We build a new object rather than mutating the exported universal question
// so the trades questionnaires are untouched.
const digitalStartingPointQuestion: Question = {
  ...startingPointQuestion,
  options: [
    { value: "still_at_school",         label: "I'm still at school or college" },
    { value: "recently_left_education", label: "I've recently left education" },
    { value: "career_changer",          label: "I'm changing career" },
    { value: "adjacent_tech_role",      label: "I already work in an adjacent tech role (QA, IT support, data ops)" },
    { value: "already_coding_at_work",  label: "I already code at work, but not as a developer" },
    { value: "returning_after_break",   label: "I'm returning to work after a break" },
    { value: "none_fit",                label: "None of these quite fit" },
    { value: "not_sure_yet",            label: "I'm not sure yet" },
  ],
};

export const softwareEngineerConfig: RoleConfig = {
  roleSlug: "software-engineer",
  family: "digital-portfolio",
  engineId: "software-engineer-v1",
  questionnaireVersion: "software-engineer-v1",
  scopeNote:
    "This checker covers general software-engineering routes only. Specialist branches (cybersecurity, data science, product management) will get their own checkers later.",
  questions: [
    digitalStartingPointQuestion,
    codingExperienceQuestion,
    portfolioStateQuestion,
    softwareHighestQualificationQuestion,
    mastersSubjectQuestion,
    mathsEnglishQuestion,
    learningTimeAvailableQuestion,
    digitalTrainingBudgetQuestion,
    locationFlexibilityQuestion,
    digitalRoutePrioritiesQuestion,
  ],
  requestBodyKey: "softwareEngineerSignals",
  extractSignals: extractSoftwareEngineerSignals,
};
