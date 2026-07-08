// Police Officer flavor for the shared modular payload builder.
//
// NOTE: The adapter builds `qualification_verification_required` payloads
// directly (not via the shared builder) because that status must mix
// `investigate_after_check` (rejoiner primary) or no route card at all
// (international equivalence), and never emit `recommended` / `backup`.

import type { ModularPayloadFlavor } from "./modular-payload";
import type { PoliceOfficerRouteId } from "./police-officer";

export const policeOfficerFlavor: ModularPayloadFlavor<PoliceOfficerRouteId> = {
  questionLabels: {
    starting_point: "Where are you starting from?",
    highest_qualification: "What's your highest completed qualification?",
    english_maths_status: "English and maths at GCSE grade 4/C or equivalent",
    current_public_service_experience: "Current or recent public-service experience",
    route_preference: "Preferred route shape",
    study_pattern_available: "Study or work pattern you can commit to",
    region_availability: "Where you're willing to apply",
    checks_before_applying: "Topics to check with the recruiting force",
    police_priority: "What matters most when choosing your route",
  },
  timeCaveats: {
    police_constable_entry_programme: "Typically 2 years training in role, force-dependent",
    police_constable_degree_apprenticeship: "Typically 3 years earning while training",
    degree_holder_entry_programme: "Typically 2 years in role for degree holders",
    professional_policing_degree_then_apply: "3 years pre-join degree, then force application",
    feeder_public_service_route: "Duration depends on the feeder role and force",
    police_rejoiner_route: "Timeline set by the recruiting force",
  },
  costCaveats: {
    police_constable_entry_programme: "Paid role from day one — training is force-funded",
    police_constable_degree_apprenticeship: "Paid — employer-funded via the apprenticeship levy",
    degree_holder_entry_programme: "Paid role from day one — training is on the job",
    professional_policing_degree_then_apply: "Self-funded degree — check student finance eligibility with the provider",
    feeder_public_service_route: "Feeder roles may be paid or volunteer — confirm with the employer",
    police_rejoiner_route: "Paid role from day one — force decides required top-up training",
  },
  patternCaveats: {
    police_constable_entry_programme: "Force-led, on-the-job training",
    police_constable_degree_apprenticeship: "Employer-led apprenticeship with off-the-job study",
    degree_holder_entry_programme: "Force-led, on-the-job training for degree holders",
    professional_policing_degree_then_apply: "Full-time university study, then separate force application",
    feeder_public_service_route: "Public-service role first, then apply to a force",
    police_rejoiner_route: "Force-decided — depends on prior service and break length",
  },
  cautionCard: {
    title: "Applying without checking force-specific criteria",
    fit: "It's tempting to apply to whichever force opens recruitment first. Forces publish different eligibility criteria, cohort dates and route availability.",
    constraint:
      "Final eligibility is decided by the individual force during recruitment. Vetting, fitness and medical standards are checked at that stage — not by this checker.",
    checks: [
      "Confirm the force is running the route (PCEP, PCDA, DHEP) you plan to apply for this cycle.",
      "Read the force's own eligibility criteria before submitting an application.",
      "Check the national eligibility criteria and the force's local criteria if in doubt.",
    ],
    nextAction:
      "Read the recruiting force's eligibility criteria and cohort availability before submitting an application.",
  },
  fitCopyRecommended: () =>
    "This route appears structurally relevant to your answers. It is not a promise of a police constable role — final eligibility is decided by the recruiting force.",
  fitCopyBackup: () =>
    "A second structurally relevant route. Compare against the recommended route and confirm the force is running it this cycle.",
  investigateAfterCheckFit:
    "This is the check you need to make first. It is a verification step, not a training route — the outcome decides which routes may be open to you.",
  mayOpenLaterFit:
    "A route that may become relevant after the step above — not currently a confirmed route for you.",
};
