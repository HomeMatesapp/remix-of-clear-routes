// Actor role config — Actor Design Brief v3.
//
// Creative / portfolio / gig-led route family. Evidence-and-risk checker, not
// an eligibility checker. No statutory gate, no guaranteed pathway.
//
// Design constraints (v3 brief):
//   - `performer_scope` is a scope gate (adult vs. child performer / not sure),
//     never a readiness or suitability signal.
//   - `highest_qualification` and `qualification_origin` are separate fields;
//     `unknown` never behaves like `international`.
//   - `budget_for_training_or_materials` NEVER gates eligibility.
//   - `checks_before_committing` NEVER gates eligibility and NEVER decides
//     whether a safety caution appears.
//   - No protected-characteristic, appearance, body, gender, ethnicity,
//     disability, accent, casting-type or precise-age fields.

import type { RoleConfig } from "../types";
import { extractActorSignals } from "../signals";
import {
  actorAuditionMaterialsQuestion,
  actorBudgetQuestion,
  actorChecksBeforeCommittingQuestion,
  actorExistingCreditsQuestion,
  actorHighestQualificationQuestion,
  actorIncomeExpectationQuestion,
  actorPerformerScopeQuestion,
  actorQualificationOriginQuestion,
  actorRepresentationStatusQuestion,
  actorRoutePrioritiesQuestion,
  actorTimeAvailabilityQuestion,
  actorTrainingBackgroundQuestion,
} from "../families/creative-media-content";

export const actorConfig: RoleConfig = {
  roleSlug: "actor",
  family: "creative-media-content",
  engineId: "actor-v1",
  questionnaireVersion: "actor-v1",
  scopeNote:
    "Acting is not statutorily regulated. There is no promised route to paid acting work. This checker compares evidence-building routes and flags common risks (private courses, agent terms, casting-platform fees, unpaid work). Child performer routes are out of scope for v1.",
  questions: [
    actorPerformerScopeQuestion,
    actorHighestQualificationQuestion,
    actorQualificationOriginQuestion,
    actorTrainingBackgroundQuestion,
    actorExistingCreditsQuestion,
    actorAuditionMaterialsQuestion,
    actorRepresentationStatusQuestion,
    actorRoutePrioritiesQuestion,
    actorIncomeExpectationQuestion,
    actorTimeAvailabilityQuestion,
    actorBudgetQuestion,
    actorChecksBeforeCommittingQuestion,
  ],
  requestBodyKey: "actorSignals",
  extractSignals: extractActorSignals,
};
