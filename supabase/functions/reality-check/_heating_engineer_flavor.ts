// Deno mirror of src/lib/reality-check/route-engines/heating-engineer-flavor.ts.
import type { ModularPayloadFlavor } from "./_modular_payload.ts";

export const heatingEngineerFlavor: ModularPayloadFlavor<string> = {
  questionLabels: {
    starting_point: "Where are you starting from?",
    heating_qualification:
      "Do you already have a heating, gas, plumbing or building-services qualification?",
    maths_english_status: "Which best describes your maths and English qualifications?",
    training_availability: "When could you realistically train?",
  },
  timeCaveats: {
    apprenticeship: "Typically 3–4 years",
    college_then_workplace_experience:
      "Typically 2–4 years, plus time to build evidenced on-site work",
    experienced_worker_route:
      "Depends on the volume of evidenced site work you already have, plus any further gas / low-carbon assessments needed",
  },
  costCaveats: {
    apprenticeship: "Paid — you earn a wage and course fees are covered",
    college_then_workplace_experience:
      "Depends on the provider; funding may be available — confirm before committing",
    experienced_worker_route:
      "Assessment and any ACS / low-carbon fees are normally self-funded",
  },
  patternCaveats: {
    apprenticeship: "Employer-led, work-based with day-release college",
    college_then_workplace_experience:
      "College classroom plus workplace placement; Gas Safe registration is a separate legal step",
    experienced_worker_route:
      "Self-managed portfolio plus any further ACS or low-carbon assessments",
  },
  cautionCard: {
    title:
      "A short private course that implies Gas Safe registration or a full heating-engineer role at the end",
    fit:
      "Short private courses can look appealing but Gas Safe registration is a legal register, not a course outcome — no course alone makes you Gas Safe registered.",
    constraint:
      "The endpoint qualification may leave you without the industry-recognised awards (Level 3 NVQ, ACS assessments) needed to work as a fully qualified heating engineer.",
    checks: [
      "Ask exactly which awarding-body qualification you'll hold at the end.",
      "Confirm how it maps to Level 3 NVQ / building-services pathways.",
      "Ask what separate steps (NVQ, ACS, Gas Safe registration) are still required.",
    ],
    nextAction:
      "Do not commit until the provider gives you the endpoint qualification title in writing and you have confirmed it against recognised heating and Gas Safe pathways.",
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
    "A route worth investigating after your existing qualification has been formally verified — we can't confirm eligibility until that check is done. Gas Safe registration is a separate legal step.",
  mayOpenLaterFit:
    "A route that may open once the bridging step below is completed — not currently a confirmed training route.",
};
