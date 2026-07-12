// Regulatory-status taxonomy for career packs.
//
// Replaces the crude `regulated: boolean`. Values are ordered from strongest
// legal constraint to weakest so evaluator rules and participant wording can
// treat them consistently.
//
// Definitions (short forms used in participant wording):
//   statutory_registration          — you must be on a legally required register
//                                     to practise (e.g. midwife on the NMC register).
//   protected_title                 — the job title itself is protected in law;
//                                     using the title without meeting the criteria
//                                     is an offence (e.g. "Architect" / ARB).
//   regulated_activity              — the ACTIVITY is legally restricted to
//                                     people who meet defined criteria, even
//                                     though the job title may not be protected
//                                     (e.g. certain gas work / Gas Safe).
//   mandatory_licence_or_scheme     — a licence or industry scheme is required
//                                     in practice for the work to be lawful or
//                                     insurable, without being a statutory
//                                     professional register (e.g. FCA
//                                     authorisation for regulated advice).
//   voluntary_professional_register — a recognised professional register exists
//                                     that employers and clients commonly
//                                     require, but registration is not legally
//                                     compulsory (e.g. BACP for counsellors).
//   optional_professional_accreditation — chartership, industry certification
//                                     or membership that improves employability
//                                     but is not required (e.g. CEng, PRINCE2).
//   not_formally_regulated          — no statutory or professional register or
//                                     licence requirement.

export const REGULATORY_STATUSES = [
  "statutory_registration",
  "protected_title",
  "regulated_activity",
  "mandatory_licence_or_scheme",
  "voluntary_professional_register",
  "optional_professional_accreditation",
  "not_formally_regulated",
] as const;

export type RegulatoryStatus = (typeof REGULATORY_STATUSES)[number];

/**
 * `appliesTo` describes whether the regulatory constraint applies to every
 * route into the career, or only to particular kinds of work or specialisms.
 *
 *   all_routes           — every route into this career must meet the constraint
 *   specific_work_only   — only some kinds of work require it (e.g. gas work
 *                          within heating and ventilation)
 *   specific_specialism  — only certain specialisms require it (e.g. midwife
 *                          within nursing family — not applicable to nurse pack)
 */
export const REGULATORY_APPLIES_TO = [
  "all_routes",
  "specific_work_only",
  "specific_specialism",
] as const;

export type RegulatoryAppliesTo = (typeof REGULATORY_APPLIES_TO)[number];
