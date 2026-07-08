// Digital / portfolio family questions.
//
// Introduced with the Software Engineer module. These questions are meaningfully
// different from the skilled-trades variants:
//   - `coding_experience` names software-specific experience states, not
//     electrical/plumbing/heating experience.
//   - `portfolio_state` captures evidence-of-work states relevant to a portfolio-
//     led route family; the conditional `portfolio_url` field is DISPLAY-ONLY
//     and never reaches the engine (stripped in the extractor before evaluation).
//   - `learning_time_available` is hours-per-week, not weekday/evening pattern.
//   - `location_flexibility` treats remote-only as a first-class option (unlike
//     skilled-trades which centre on travel radius by car).
//   - `digital_route_priorities` is a distinct question id from
//     `route_priorities` so the existing trades priority question is NOT mutated
//     when this family is enabled. Both ids map onto the same shared
//     `routePriorities` signal field in the extractor.
//
// The mastersSubject follow-up on the highest-qualification question is
// implemented here as its own single-select question, only shown when the
// selected highest-qualification value is `masters_plus`.

import type { Question } from "../types";

/**
 * Software Engineer highest-qualification question.
 * Uses `highest_qualification` (single_select). The `masters_subject` follow-
 * up is a separate question that the wizard renders when relevant; the engine
 * treats missing subject on `masters_plus` as `unknown`.
 */
export const softwareHighestQualificationQuestion: Question = {
  id: "highest_qualification",
  phase: "qualifications",
  title: "What's your highest completed qualification?",
  whyWeAsk:
    "Different software-engineering routes have very different starting points. Your highest qualification affects which routes are directly open now and which may open later.",
  controlType: "single_select",
  options: [
    { value: "none",             label: "No formal qualifications yet" },
    { value: "gcse",             label: "GCSEs (or equivalent)" },
    { value: "a_level",          label: "A-levels, T Levels or Level 3 vocational" },
    { value: "l3_vocational",    label: "Level 3 apprenticeship or BTEC" },
    { value: "bachelors_cs",     label: "Bachelor's degree in Computer Science or similar" },
    { value: "bachelors_non_cs", label: "Bachelor's degree in another subject" },
    { value: "masters_plus",     label: "Master's or higher" },
    { value: "international",    label: "A qualification from outside the UK" },
    { value: "unknown",          label: "I'm not sure of the level" },
  ],
};

/**
 * Only shown when highest_qualification = masters_plus. Determines whether the
 * conversion MSc route is directly open, blocked, or subject-verification-required.
 */
export const mastersSubjectQuestion: Question = {
  id: "masters_subject",
  phase: "qualifications",
  title: "Is your Master's (or higher) in a computing subject?",
  whyWeAsk:
    "A conversion Master's is designed for people whose existing degree is not in computing. If yours already is, other routes are usually a better fit.",
  controlType: "single_select",
  // Only asked when the user has already selected `masters_plus` as their
  // highest qualification. Non-masters users must not see this question.
  visibleWhen: {
    questionId: "highest_qualification",
    valueIn: ["masters_plus"],
  },
  options: [
    { value: "computing",     label: "Yes — computer science, software engineering or similar" },
    { value: "non_computing", label: "No — a different subject" },
    { value: "unknown",       label: "I'm not sure" },
  ],
};

export const codingExperienceQuestion: Question = {
  id: "coding_experience",
  phase: "starting_point",
  title: "How much coding have you done?",
  whyWeAsk:
    "Some routes assume no prior coding; others expect self-taught progress or paid experience. Your answer will not judge you — it just picks the routes that fit where you actually are.",
  controlType: "single_select",
  options: [
    { value: "none",                label: "None yet" },
    { value: "hobbyist",            label: "A little — tutorials or dabbling" },
    { value: "self_taught_6m_plus", label: "Six months or more of self-taught study" },
    { value: "bootcamp_grad",       label: "Completed a bootcamp" },
    { value: "paid_experience",     label: "Paid work involving coding" },
  ],
};

export const portfolioStateQuestion: Question = {
  id: "portfolio_state",
  phase: "starting_point",
  title: "Do you have any personal projects or a portfolio?",
  whyWeAsk:
    "Portfolio-led routes weigh evidence of work heavily. Tutorials on their own are not portfolio evidence — deployable projects are.",
  controlType: "single_select",
  options: [
    { value: "none",              label: "No" },
    { value: "tutorials_only",    label: "Only tutorial follow-alongs" },
    { value: "personal_projects", label: "One or two personal projects" },
    { value: "deployed",          label: "A deployed portfolio or live site" },
    { value: "open_source",       label: "Open-source contributions" },
  ],
  conditionalField: {
    showWhenValueIn: ["personal_projects", "deployed", "open_source"],
    label: "Link to your portfolio or repository (optional).",
    placeholder: "e.g. https://github.com/you or https://your-portfolio.example",
    hint: "We show this on your review as plain text — we do not open or verify links, and it never affects your recommended route.",
  },
};

export const learningTimeAvailableQuestion: Question = {
  id: "learning_time_available",
  phase: "practical_constraints",
  title: "Realistically, how many hours per week could you study or build?",
  whyWeAsk:
    "Different routes need different weekly commitments. This is used to filter routes that would not fit around your life, not to judge how motivated you are.",
  controlType: "single_select",
  options: [
    { value: "lt5",      label: "Under 5 hours" },
    { value: "5_15",     label: "5–15 hours" },
    { value: "15_30",    label: "15–30 hours" },
    { value: "30_plus",  label: "30+ hours (effectively full-time)" },
  ],
};

/**
 * Software-Engineer training-budget question. Same id as the universal
 * `training_budget` but with digital-appropriate bands: bootcamp fees dominate
 * the meaningful thresholds here, not skilled-trades assessment fees.
 * NOTE: budget NEVER affects route eligibility — it only informs affordability
 * notes and ranking. Enforced by tests.
 */
export const digitalTrainingBudgetQuestion: Question = {
  id: "training_budget",
  phase: "practical_constraints",
  title: "What could you realistically afford towards training?",
  helpText:
    "Think about course fees only — not living costs. If you might rely on employer or government funding, choose the lower band.",
  whyWeAsk:
    "Budget never rules a route out. It affects affordability notes and how routes are ranked, so we do not present unaffordable options as though they are realistic.",
  controlType: "single_select",
  options: [
    { value: "0",        label: "£0 — needs to be free or fully funded" },
    { value: "0_2k",     label: "Up to £2,000" },
    { value: "2k_10k",   label: "£2,000–£10,000" },
    { value: "10k_plus", label: "£10,000+" },
  ],
};

export const locationFlexibilityQuestion: Question = {
  id: "location_flexibility",
  phase: "practical_constraints",
  title: "How flexible are you on location?",
  whyWeAsk:
    "Apprenticeships and some employer-training routes are location-dependent. Remote-only rules some of them out today; flexibility opens them up.",
  controlType: "single_select",
  options: [
    { value: "remote_only",   label: "Remote-only — I can't attend a workplace regularly" },
    { value: "hybrid_region", label: "Hybrid within my region" },
    { value: "relocate",      label: "I could relocate for the right route" },
    { value: "london_only",   label: "London only" },
  ],
};

/**
 * Digital-family route priorities. Distinct question id from the trades
 * `route_priorities` so we do NOT mutate the existing reviewed trades
 * question. Both ids extract into the same shared `routePriorities` signal
 * so downstream ranking code is unified.
 */
export const digitalRoutePrioritiesQuestion: Question = {
  id: "digital_route_priorities",
  phase: "practical_constraints",
  title: "What matters most when choosing your route?",
  helpText: "Choose up to three.",
  whyWeAsk:
    "Several routes may be structurally possible. Your priorities re-rank the eligible ones — they never make an ineligible route eligible.",
  controlType: "multi_select",
  maxSelections: 3,
  options: [
    { value: "speed",              label: "Getting into a first role quickly" },
    { value: "low_cost",           label: "Keeping training costs low" },
    { value: "job_security",       label: "A recognised qualification with strong employment odds" },
    { value: "employer_training",  label: "Being trained on the job by an employer" },
    { value: "creative",           label: "Creative or product-shaping work" },
    { value: "high_pay",           label: "A high pay ceiling over the long term" },
  ],
};
