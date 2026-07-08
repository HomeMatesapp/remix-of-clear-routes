// Police Officer role config.
//
// First deep-reviewed modular Reality Check in the `public_service_security`
// family. Selection-led public-service route. England & Wales only.
//
// Design constraints (v4 brief):
//   - Detective and specialist-entry routes are out of scope for v1.
//   - Police Scotland / PSNI are out of scope for v1.
//   - No health, criminal-record, DBS, vetting-outcome, nationality,
//     residency, immigration or visa disclosure fields.
//   - `checks_before_applying` values are topics to check with the force —
//     never disclosures. They never affect eligibility.

import type { RoleConfig } from "../types";
import { extractPoliceOfficerSignals } from "../signals";
import {
  checksBeforeApplyingQuestion,
  currentPublicServiceExperienceQuestion,
  policeEnglishMathsStatusQuestion,
  policeHighestQualificationQuestion,
  policePriorityQuestion,
  policeRegionAvailabilityQuestion,
  policeRoutePreferenceQuestion,
  policeStartingPointQuestion,
  policeStudyPatternAvailableQuestion,
} from "../families/public-service-security";

export const policeOfficerConfig: RoleConfig = {
  roleSlug: "police-officer",
  family: "public-service-security",
  engineId: "police-officer-v1",
  questionnaireVersion: "police-officer-v1",
  scopeNote:
    "This checker is for police constable routes in England and Wales. Police Scotland and PSNI have separate recruitment routes and are out of scope for v1. Detective and specialist-entry routes are also out of scope for v1.",
  questions: [
    policeStartingPointQuestion,
    policeHighestQualificationQuestion,
    policeEnglishMathsStatusQuestion,
    currentPublicServiceExperienceQuestion,
    policeRoutePreferenceQuestion,
    policeStudyPatternAvailableQuestion,
    policeRegionAvailabilityQuestion,
    checksBeforeApplyingQuestion,
    policePriorityQuestion,
  ],
  requestBodyKey: "policeOfficerSignals",
  extractSignals: extractPoliceOfficerSignals,
};
