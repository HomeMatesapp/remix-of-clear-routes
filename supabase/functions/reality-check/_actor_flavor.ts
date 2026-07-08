// Deno mirror of src/lib/reality-check/route-engines/actor-flavor.ts.
// Behaviour must stay in lockstep — modify both files together.

import type { ModularPayloadFlavor } from "./_modular_payload.ts";

export type ActorRouteId =
  | "formal_actor_training"
  | "university_drama_degree"
  | "portfolio_audition_materials_route"
  | "credits_and_experience_route"
  | "agent_and_casting_profile_route"
  | "adjacent_performance_income_route";

export const COURSE_CAUTION_CARD = {
  title: "Paid acting courses and unaccredited training",
  fit: "Acting is not statutorily regulated. Paid courses vary widely in quality and none can promise paid acting work afterwards.",
  constraint:
    "Accreditation (e.g. CDMT recognition) is a quality-assurance signal, not proof of paid work afterwards. Check tutor credits, graduate outcomes and refund/cancellation terms before committing money.",
  checks: [
    "Check the provider's accreditation (e.g. CDMT for performing-arts training) — treat it as quality assurance, not a guarantee.",
    "Check named tutor credits and recent graduate outcomes independently, not just the provider's own marketing.",
    "Check refund and cancellation terms before paying any deposit.",
  ] as string[],
  nextAction:
    "Confirm accreditation, tutor credits and graduate outcomes for any paid course before committing.",
};

export const AGENT_CAUTION_CARD = {
  title: "Agents, casting platforms and unpaid work",
  fit: "Signing with an agent, subscribing to a casting platform or taking unpaid work does not promise auditions or paid work.",
  constraint:
    "Reputable agents do not charge sign-up fees. Casting platforms charge subscription fees and do not promise castings. Unpaid work should still have written terms.",
  checks: [
    "Check agent contract terms, commission rates and notice periods — Equity provides guidance.",
    "Check casting-platform subscription fees against the value you'll realistically get from them.",
    "Check unpaid-work terms, travel, subsistence and safety arrangements before agreeing.",
  ] as string[],
  nextAction:
    "Read Equity guidance on agents and unpaid work before signing anything.",
};

export const actorFlavor: ModularPayloadFlavor<ActorRouteId> = {
  questionLabels: {
    performer_scope: "Which route are you exploring?",
    highest_qualification: "Highest completed qualification",
    qualification_origin: "Where the qualification was taken",
    training_background: "Prior acting training",
    existing_credits: "Current acting credits",
    audition_materials: "Audition materials",
    representation_status: "Representation position",
    route_priorities: "Route priorities",
    income_expectation: "Income expectation",
    time_availability: "Time availability",
    budget_for_training_or_materials: "Budget for training or materials",
    checks_before_committing: "Topics to double-check",
  },
  timeCaveats: {
    formal_actor_training: "Typically 1–3 years, provider-dependent",
    university_drama_degree: "Typically 3 years full-time",
    portfolio_audition_materials_route: "Weeks — depends on session availability",
    credits_and_experience_route: "Ongoing — build steadily over months to years",
    agent_and_casting_profile_route: "Weeks to months to research and approach",
    adjacent_performance_income_route: "Immediate to weeks",
  },
  costCaveats: {
    formal_actor_training: "Fees vary widely — check the specific provider and any funding options",
    university_drama_degree: "UK undergraduate tuition is loan-funded via Student Finance",
    portfolio_audition_materials_route: "Headshot and showreel edits are the largest items",
    credits_and_experience_route: "Usually low or no cost — check travel and subsistence terms",
    agent_and_casting_profile_route: "Casting-platform subscriptions carry fees; reputable agents do not charge sign-up fees",
    adjacent_performance_income_route: "Paid work — confirm rates and terms upfront",
  },
  patternCaveats: {
    formal_actor_training: "Full-time or intensive part-time cohorts",
    university_drama_degree: "Full-time university study",
    portfolio_audition_materials_route: "Short focused sessions with independent providers",
    credits_and_experience_route: "Project-based, intermittent",
    agent_and_casting_profile_route: "Research and open-submission windows",
    adjacent_performance_income_route: "Ad-hoc paid engagements",
  },
  cautionCard: COURSE_CAUTION_CARD,
  fitCopyRecommended: () =>
    "This route appears structurally relevant to your answers. It does not promise auditions, representation or paid acting work.",
  fitCopyBackup: () =>
    "A second structurally relevant route. Compare against the recommended route — it also does not promise paid acting work.",
  investigateAfterCheckFit:
    "This route may be worth investigating after the qualification-equivalence check above. It is not a confirmed route for you yet.",
  mayOpenLaterFit:
    "This route may become relevant once the step above is in place. It is not currently a confirmed route for you.",
};
