// Software Engineer flavor for the shared modular payload builder.

import type { ModularPayloadFlavor } from "./modular-payload";
import type { SoftwareEngineerRouteId } from "./software-engineer";

export const softwareEngineerFlavor: ModularPayloadFlavor<SoftwareEngineerRouteId> = {
  questionLabels: {
    starting_point: "Where are you starting from?",
    coding_experience: "How much coding have you done?",
    portfolio_state: "Do you have any personal projects or a portfolio?",
    highest_qualification: "What's your highest completed qualification?",
    masters_subject: "Is your Master's in a computing subject?",
    maths_english_status: "Which best describes your maths and English qualifications?",
    learning_time_available: "How many hours per week could you study or build?",
    training_budget: "What could you realistically afford towards training?",
    location_flexibility: "How flexible are you on location?",
    digital_route_priorities: "What matters most when choosing your route?",
  },
  timeCaveats: {
    self_taught_portfolio: "Typically 6–18 months to a first junior offer",
    bootcamp_intensive: "Typically 3–6 months intensive, plus job search",
    degree_computer_science: "3–4 years including placement year",
    degree_conversion_msc: "Typically 12 months full-time",
    apprenticeship_digital: "Typically 2–4 years, employer-paid",
    junior_role_with_training: "12–24 months to reach engineer via progression",
  },
  costCaveats: {
    self_taught_portfolio:
      "Minimal direct cost — plan for laptop, internet and possibly paid learning platforms",
    bootcamp_intensive:
      "Private bootcamps typically £6,000–£12,000+; funded Skills Bootcamps may be free — confirm before paying",
    degree_computer_science:
      "Tuition fee loans currently around £9.5k–£9.8k/year; living costs separate",
    degree_conversion_msc:
      "Typically £9,000–£15,000 tuition plus living costs; postgraduate loan may apply",
    apprenticeship_digital:
      "Paid — you earn a wage and fees are covered by the employer/government",
    junior_role_with_training: "Paid employment; employer training on top of salary",
  },
  patternCaveats: {
    self_taught_portfolio: "Self-directed; you set the pace and choose the projects",
    bootcamp_intensive: "Cohort-based; intensive daily commitment for a short period",
    degree_computer_science: "University-led; structured semesters and assessments",
    degree_conversion_msc: "One-year intensive; usually full-time",
    apprenticeship_digital: "Employer-led; work-based with off-the-job study",
    junior_role_with_training: "On-the-job; progression depends on the employer's plan",
  },
  cautionCard: {
    title: "A high-cost private bootcamp with weak evidence of outcomes",
    fit:
      "Some private bootcamps market strong outcomes but rely on self-reported job numbers without independent audit.",
    constraint:
      "Paying £8,000–£12,000+ for a course that does not lead to a first developer role is one of the most expensive wrong turns in this route family.",
    checks: [
      "Ask for the provider's outcomes methodology and whether it is independently audited.",
      "Ask what proportion of a recent cohort reached a developer role within six months of graduating.",
      "Confirm refund terms and cohort deferral options before paying anything.",
    ],
    nextAction:
      "Do not commit until you have written outcomes methodology, refund terms and — where possible — direct references from recent graduates.",
  },
  fitCopyRecommended: ({ affordable }) =>
    affordable
      ? "This route appears structurally suitable for you based on your answers."
      : "This route is structurally the strongest fit for you; note the affordability caveats below.",
  fitCopyBackup: ({ affordable }) =>
    affordable
      ? "A second structurally viable route from your answers — compare it against the recommended route before committing."
      : "Structurally viable but likely exceeds your stated training budget; compare against the recommended route.",
  investigateAfterCheckFit:
    "A route worth investigating after your existing qualification has been formally verified — we can't confirm eligibility until that check is done.",
  mayOpenLaterFit:
    "A route that may open once the bridging step below is completed — not currently a confirmed training route.",
};
