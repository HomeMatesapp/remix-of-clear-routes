import type { ModularPayloadFlavor } from "./modular-payload";
import type { PlumberRouteId } from "./plumber";

export const plumberFlavor: ModularPayloadFlavor<PlumberRouteId> = {
  questionLabels: {
    starting_point: "Where are you starting from?",
    plumbing_qualification: "Do you already have a plumbing or heating qualification?",
    maths_english_status: "Which best describes your maths and English qualifications?",
    training_availability: "When could you realistically train?",
  },
  timeCaveats: {
    apprenticeship: "Typically 3–4 years",
    college_then_workplace_experience:
      "Typically 2–4 years, plus time to build evidenced on-site plumbing work",
    experienced_worker_route:
      "Depends on the volume of evidenced plumbing work you already have",
  },
  costCaveats: {
    apprenticeship: "Paid — you earn a wage and course fees are covered",
    college_then_workplace_experience:
      "Depends on the provider; funding may be available — confirm before committing",
    experienced_worker_route:
      "Assessment fees are usually in the low thousands and normally self-funded",
  },
  patternCaveats: {
    apprenticeship: "Employer-led, work-based with day-release college",
    college_then_workplace_experience:
      "College classroom plus a workplace placement to evidence NVQ Level 3",
    experienced_worker_route: "Self-managed portfolio and final assessment",
  },
  cautionCard: {
    title:
      "A short private course that implies a fully qualified plumber role at the end",
    fit:
      "Short private courses can look appealing but often do not lead to the industry-recognised Level 3 NVQ that lets you work as a fully qualified plumber.",
    constraint:
      "The endpoint qualification may not map to City & Guilds / EAL recognition, leaving you unable to work independently or take on gas or heating work.",
    checks: [
      "Ask the provider exactly which awarding-body qualification you'll hold at the end.",
      "Confirm how it maps to the Level 3 NVQ Diploma pathway.",
      "Ask what separate steps (ACS, Gas Safe registration) are still required.",
    ],
    nextAction:
      "Do not commit until the provider gives you the endpoint qualification title in writing and you have confirmed it maps to the Level 3 NVQ pathway.",
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
    "A route worth investigating after your existing plumbing / gas qualification has been formally verified — we can't confirm eligibility until that check is done.",
  mayOpenLaterFit:
    "A route that may open once the bridging step below is completed — not currently a confirmed training route.",
};
