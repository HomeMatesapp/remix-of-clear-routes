// Signal extraction for the Electrician engine.
//
// Deterministic mapping from raw answer values to structured signals. Free
// text is captured for display but NEVER used as an eligibility signal.

import type { AnswerMap, InlineTextMap } from "./types";

export type ElectricianStartingPoint =
  | "still_at_school"
  | "recently_left_education"
  | "career_changer"
  | "construction_or_trade"
  | "some_electrical_work"
  | "returning_after_break"
  | "none_fit"
  | "not_sure_yet";

export type ElectricianQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export type MathsEnglishStatus =
  | "both"
  | "maths_only"
  | "english_only"
  | "neither"
  | "international"
  | "not_sure";

export type TrainingBudgetBand =
  | "free_only"
  | "up_to_500"
  | "500_to_2000"
  | "over_2000"
  | "depends"
  | "not_sure";

export type TravelRange =
  | "local_no_car"
  | "up_to_30"
  | "up_to_60"
  | "wider_area"
  | "can_relocate"
  | "depends"
  | "not_sure";

export interface ElectricianSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasElectricalExperience: boolean;
  hasRelatedTradeExperience: boolean;
  electricalQualificationLevel: ElectricianQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const extractElectricianSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): ElectricianSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasElectricalExperience: experience.includes("electrical_work"),
    hasRelatedTradeExperience:
      experience.includes("construction_or_trade") ||
      experience.includes("engineering_technical"),
    electricalQualificationLevel:
      asString(answers.electrical_qualification) as ElectricianQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Plumber ──────────────────────────────────────────────────────────────────

export type PlumberQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "gas_heating"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export interface PlumberSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasPlumbingExperience: boolean;
  hasRelatedTradeExperience: boolean;
  plumbingQualificationLevel: PlumberQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

export const extractPlumberSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): PlumberSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasPlumbingExperience: experience.includes("plumbing_work"),
    hasRelatedTradeExperience:
      experience.includes("gas_or_heating") ||
      experience.includes("construction_or_trade") ||
      experience.includes("engineering_technical"),
    plumbingQualificationLevel:
      asString(answers.plumbing_qualification) as PlumberQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Heating Engineer (slug: hvac-engineer) ───────────────────────────────────

export type HeatingEngineerQualificationLevel =
  | "none"
  | "foundation"
  | "level_2"
  | "level_3"
  | "gas_or_gas_safe_claimed"
  | "heat_pump_or_low_carbon"
  | "older_unknown"
  | "international"
  | "unknown_level"
  | "not_sure";

export interface HeatingEngineerSignals {
  startingPoint: ElectricianStartingPoint | null;
  hasHeatingExperience: boolean;
  hasGasExperience: boolean;
  hasPlumbingExperience: boolean;
  hasBuildingServicesExperience: boolean;
  hasElectricalControlsExperience: boolean;
  hasRelatedTradeExperience: boolean;
  heatingQualificationLevel: HeatingEngineerQualificationLevel | null;
  mathsEnglishStatus: MathsEnglishStatus | null;
  availableTrainingPatterns: string[];
  trainingBudgetBand: TrainingBudgetBand | null;
  travelRange: TravelRange | null;
  workingConditionsToCheck: string[];
  routePriorities: string[];
}

export const extractHeatingEngineerSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): HeatingEngineerSignals => {
  const experience = asArray(answers.relevant_experience);
  return {
    startingPoint: asString(answers.starting_point) as ElectricianStartingPoint | null,
    hasHeatingExperience: experience.includes("heating_install_service"),
    hasGasExperience: experience.includes("gas_appliance_or_systems"),
    hasPlumbingExperience: experience.includes("plumbing_or_domestic_heat"),
    hasBuildingServicesExperience: experience.includes("building_services_hvac"),
    hasElectricalControlsExperience: experience.includes("electrical_controls"),
    hasRelatedTradeExperience:
      experience.includes("construction_or_trade") ||
      experience.includes("practical_projects"),
    heatingQualificationLevel:
      asString(answers.heating_qualification) as HeatingEngineerQualificationLevel | null,
    mathsEnglishStatus:
      asString(answers.maths_english_status) as MathsEnglishStatus | null,
    availableTrainingPatterns: asArray(answers.training_availability),
    trainingBudgetBand: asString(answers.training_budget) as TrainingBudgetBand | null,
    travelRange: asString(answers.travel_range) as TravelRange | null,
    workingConditionsToCheck: asArray(answers.working_conditions_to_check),
    routePriorities: asArray(answers.route_priorities),
  };
};

// ── Software Engineer (slug: software-engineer) ──────────────────────────────
//
// portfolioUrl is captured for display in Review ONLY. The engine's eligibility
// input strips it before evaluation (see route-engines/software-engineer.ts →
// stripPortfolioUrl). The extractor keeps it here so the wizard can render it.

export type SoftwareEngineerStartingPoint =
  | "still_at_school"
  | "recently_left_education"
  | "career_changer"
  | "adjacent_tech_role"
  | "already_coding_at_work"
  | "returning_after_break"
  | "none_fit"
  | "not_sure_yet";

export type SoftwareEngineerHighestQualification =
  | "none"
  | "gcse"
  | "a_level"
  | "l3_vocational"
  | "bachelors_cs"
  | "bachelors_non_cs"
  | "masters_plus"
  | "international"
  | "unknown";

export type SoftwareEngineerMastersSubject =
  | "computing"
  | "non_computing"
  | "unknown";

export type SoftwareEngineerCodingExperience =
  | "none"
  | "hobbyist"
  | "self_taught_6m_plus"
  | "bootcamp_grad"
  | "paid_experience";

export type SoftwareEngineerPortfolioState =
  | "none"
  | "tutorials_only"
  | "personal_projects"
  | "deployed"
  | "open_source";

export type SoftwareEngineerLearningTime =
  | "lt5"
  | "5_15"
  | "15_30"
  | "30_plus";

export type SoftwareEngineerTrainingBudget =
  | "0"
  | "0_2k"
  | "2k_10k"
  | "10k_plus";

export type SoftwareEngineerLocationFlexibility =
  | "remote_only"
  | "hybrid_region"
  | "relocate"
  | "london_only";

export interface SoftwareEngineerSignals {
  startingPoint: SoftwareEngineerStartingPoint | null;
  codingExperience: SoftwareEngineerCodingExperience | null;
  portfolioState: SoftwareEngineerPortfolioState | null;
  /** Display-only. Never used for eligibility or scoring. */
  portfolioUrl?: string;
  highestQualification: SoftwareEngineerHighestQualification | null;
  mastersSubject?: SoftwareEngineerMastersSubject;
  mathsEnglishStatus: MathsEnglishStatus | null;
  learningTimeHoursPerWeek: SoftwareEngineerLearningTime | null;
  trainingBudgetGbp: SoftwareEngineerTrainingBudget | null;
  locationFlexibility: SoftwareEngineerLocationFlexibility | null;
  routePriorities: string[];
}

const PORTFOLIO_STATES_ALLOWING_URL: ReadonlySet<SoftwareEngineerPortfolioState> =
  new Set(["personal_projects", "deployed", "open_source"]);

export const extractSoftwareEngineerSignals = (
  answers: AnswerMap,
  inline: InlineTextMap = {},
): SoftwareEngineerSignals => {
  const portfolioState = asString(answers.portfolio_state) as
    | SoftwareEngineerPortfolioState
    | null;

  // Portfolio URL clears whenever the state moves away from a state that
  // supports it. Enforced here (in the extractor) so the invariant holds even
  // if the UI reducer misses the transition — cheap defence in depth.
  let portfolioUrl: string | undefined;
  if (
    portfolioState &&
    PORTFOLIO_STATES_ALLOWING_URL.has(portfolioState)
  ) {
    const raw = inline.portfolio_state ?? inline.portfolio_url;
    if (typeof raw === "string" && raw.trim().length > 0) {
      portfolioUrl = raw.trim();
    }
  }

  const highest = asString(answers.highest_qualification) as
    | SoftwareEngineerHighestQualification
    | null;
  const mastersSubjectRaw = asString(answers.masters_subject) as
    | SoftwareEngineerMastersSubject
    | null;

  // Accept `digital_route_priorities` (new) and legacy `route_priorities` so
  // both question ids feed the same signal.
  const priorities = asArray(answers.digital_route_priorities).length
    ? asArray(answers.digital_route_priorities)
    : asArray(answers.route_priorities);

  return {
    startingPoint: asString(answers.starting_point) as
      | SoftwareEngineerStartingPoint
      | null,
    codingExperience: asString(answers.coding_experience) as
      | SoftwareEngineerCodingExperience
      | null,
    portfolioState,
    ...(portfolioUrl !== undefined ? { portfolioUrl } : {}),
    highestQualification: highest,
    ...(highest === "masters_plus" && mastersSubjectRaw
      ? { mastersSubject: mastersSubjectRaw }
      : {}),
    mathsEnglishStatus: asString(answers.maths_english_status) as
      | MathsEnglishStatus
      | null,
    learningTimeHoursPerWeek: asString(
      answers.learning_time_available,
    ) as SoftwareEngineerLearningTime | null,
    trainingBudgetGbp: asString(answers.training_budget) as
      | SoftwareEngineerTrainingBudget
      | null,
    locationFlexibility: asString(answers.location_flexibility) as
      | SoftwareEngineerLocationFlexibility
      | null,
    routePriorities: priorities,
  };
};

// ── Registered Nurse (slug: registered-nurse) ────────────────────────────────
//
// Regulated-healthcare route family. Signals contain no health-condition,
// disability, pregnancy, criminal-record, DBS, occupational-health or
// immigration/visa fields. Those items belong to the employer/provider/NMC.
// No free text is captured that could reach the engine; there is no
// budget field (nursing degrees are student-loan funded and apprenticeships
// are employer-paid, so budget is caveat-only in copy).

export type RegisteredNurseStartingPoint =
  | "complete_beginner"
  | "some_health_or_care_experience"
  | "currently_healthcare_support_worker"
  | "nursing_associate_or_assistant_practitioner"
  | "graduate_non_nursing"
  | "trained_as_nurse_outside_uk"
  | "previously_registered_nurse"
  | "already_registered_nurse_other_field"
  | "not_sure";

export type RegisteredNurseTargetField =
  | "adult"
  | "child"
  | "mental_health"
  | "learning_disability"
  | "not_sure";

export type RegisteredNurseHighestQualification =
  | "none"
  | "gcse"
  | "a_level"
  | "l3_vocational"
  | "access_to_he_health_science"
  | "bachelors_health_related"
  | "bachelors_other"
  | "nursing_associate_foundation_degree"
  | "overseas_nursing_qualification"
  | "unknown";

export type RegisteredNurseMathsEnglishScienceStatus =
  | "english_maths_science_gcse_met"
  | "english_maths_met_science_missing"
  | "maths_or_english_missing"
  | "unsure";

export type RegisteredNurseCurrentHealthcareEmployment =
  | "not_currently_employed_in_healthcare"
  | "employed_healthcare_support_role"
  | "employed_nursing_associate"
  | "employed_assistant_practitioner"
  | "employed_other_healthcare"
  | "not_sure";

export type RegisteredNurseEmployerSupport =
  | "employer_support_confirmed"
  | "employer_support_possible"
  | "no_employer_support"
  | "not_discussed_yet";

export type RegisteredNurseDegreeBackgroundSubject =
  | "health_related"
  | "psychology"
  | "life_sciences"
  | "social_work"
  | "other_subject"
  | "unsure";

export type RegisteredNurseRegistrationBackground =
  | "overseas_trained_not_on_nmc_register"
  | "previous_nmc_registration_lapsed"
  | "current_nmc_registration_other_field"
  | "unsure";

export type RegisteredNurseStudyPattern =
  | "full_time_university_possible"
  | "part_time_only"
  | "employer_led_only"
  | "need_to_keep_earning"
  | "not_sure";

export interface RegisteredNurseSignals {
  startingPoint: RegisteredNurseStartingPoint | null;
  targetNursingField: RegisteredNurseTargetField | null;
  highestQualification: RegisteredNurseHighestQualification | null;
  mathsEnglishScienceStatus: RegisteredNurseMathsEnglishScienceStatus | null;
  currentHealthcareEmployment: RegisteredNurseCurrentHealthcareEmployment | null;
  employerSupport?: RegisteredNurseEmployerSupport;
  degreeBackgroundSubject?: RegisteredNurseDegreeBackgroundSubject;
  registrationBackground?: RegisteredNurseRegistrationBackground;
  studyPatternAvailable: RegisteredNurseStudyPattern | null;
  routePriorities: string[];
}

const EMPLOYED_HEALTHCARE = new Set<RegisteredNurseCurrentHealthcareEmployment>([
  "employed_healthcare_support_role",
  "employed_nursing_associate",
  "employed_assistant_practitioner",
  "employed_other_healthcare",
]);

export const extractRegisteredNurseSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): RegisteredNurseSignals => {
  const startingPoint = asString(answers.starting_point) as
    | RegisteredNurseStartingPoint
    | null;
  const highestQualification = asString(answers.highest_qualification) as
    | RegisteredNurseHighestQualification
    | null;
  const currentHealthcareEmployment = asString(
    answers.current_healthcare_employment,
  ) as RegisteredNurseCurrentHealthcareEmployment | null;
  const employerSupportRaw = asString(answers.employer_support) as
    | RegisteredNurseEmployerSupport
    | null;
  const degreeBackgroundSubjectRaw = asString(answers.degree_background_subject) as
    | RegisteredNurseDegreeBackgroundSubject
    | null;
  const registrationBackgroundRaw = asString(answers.registration_background) as
    | RegisteredNurseRegistrationBackground
    | null;

  // Enforce visibleWhen invariants defensively — drop optional signals whose
  // gate condition is not met so the engine never sees stale values.
  const employerSupport =
    currentHealthcareEmployment &&
    EMPLOYED_HEALTHCARE.has(currentHealthcareEmployment) &&
    employerSupportRaw
      ? employerSupportRaw
      : undefined;
  const degreeBackgroundSubject =
    (highestQualification === "bachelors_health_related" ||
      highestQualification === "bachelors_other") &&
    degreeBackgroundSubjectRaw
      ? degreeBackgroundSubjectRaw
      : undefined;
  const registrationBackground =
    (startingPoint === "trained_as_nurse_outside_uk" ||
      startingPoint === "previously_registered_nurse" ||
      startingPoint === "already_registered_nurse_other_field") &&
    registrationBackgroundRaw
      ? registrationBackgroundRaw
      : undefined;

  return {
    startingPoint,
    targetNursingField: asString(answers.target_nursing_field) as
      | RegisteredNurseTargetField
      | null,
    highestQualification,
    mathsEnglishScienceStatus: asString(
      answers.maths_english_science_status,
    ) as RegisteredNurseMathsEnglishScienceStatus | null,
    currentHealthcareEmployment,
    ...(employerSupport !== undefined ? { employerSupport } : {}),
    ...(degreeBackgroundSubject !== undefined ? { degreeBackgroundSubject } : {}),
    ...(registrationBackground !== undefined ? { registrationBackground } : {}),
    studyPatternAvailable: asString(answers.study_pattern_available) as
      | RegisteredNurseStudyPattern
      | null,
    routePriorities: asArray(answers.nursing_route_priorities),
  };
};

// ── Police Officer (slug: police-officer) ────────────────────────────────────
//
// Selection-led public-service route. Signals contain no health, disability,
// criminal-record, DBS, vetting-outcome, nationality, residency, immigration
// or visa fields — those items belong to the recruiting force.

export type PoliceOfficerStartingPoint =
  | "school_leaver"
  | "career_changer"
  | "graduate"
  | "returning_to_work"
  | "currently_in_public_service"
  | "former_police_officer"
  | "not_sure";

export type PoliceOfficerHighestQualification =
  | "none"
  | "gcse"
  | "a_level_or_level_3"
  | "professional_policing_degree"
  | "bachelors_any_subject"
  | "masters_plus"
  | "international"
  | "unknown";

export type PoliceOfficerEnglishMathsStatus =
  | "english_and_maths_met"
  | "one_missing"
  | "neither_met"
  | "not_sure";

export type PoliceOfficerPublicServiceExperience =
  | "none"
  | "pcso"
  | "special_constable"
  | "armed_forces"
  | "prison_border_security_or_emergency_services"
  | "other_relevant_public_service"
  | "not_sure";

export type PoliceOfficerRoutePreference =
  | "fastest_application_route"
  | "earn_while_training"
  | "degree_first"
  | "not_sure";

export type PoliceOfficerStudyPattern =
  | "full_time_study_possible"
  | "work_based_training_preferred"
  | "need_to_keep_earning"
  | "flexible"
  | "not_sure";

export type PoliceOfficerRegionAvailability =
  | "england_wales_any_force"
  | "specific_region"
  | "not_sure";

export type PoliceOfficerChecksBeforeApplying =
  | "fitness_or_medical_process"
  | "vetting_process"
  | "national_eligibility_criteria"
  | "driving_licence_process"
  | "none_of_these";

export type PoliceOfficerPriority =
  | "avoid_student_debt"
  | "graduate_as_fast_as_possible"
  | "keep_earning_while_training"
  | "structured_academic_route"
  | "not_sure";

export interface PoliceOfficerSignals {
  startingPoint: PoliceOfficerStartingPoint | null;
  highestQualification: PoliceOfficerHighestQualification | null;
  englishMathsStatus: PoliceOfficerEnglishMathsStatus | null;
  currentPublicServiceExperience: PoliceOfficerPublicServiceExperience | null;
  routePreference: PoliceOfficerRoutePreference | null;
  studyPatternAvailable: PoliceOfficerStudyPattern | null;
  regionAvailability: PoliceOfficerRegionAvailability | null;
  /** Multi-select check topics. Never used in eligibility. */
  checks_before_applying: readonly PoliceOfficerChecksBeforeApplying[];
  priority: PoliceOfficerPriority | null;
}

export const extractPoliceOfficerSignals = (
  answers: AnswerMap,
  _inline: InlineTextMap = {},
): PoliceOfficerSignals => ({
  startingPoint: asString(answers.starting_point) as
    | PoliceOfficerStartingPoint
    | null,
  highestQualification: asString(answers.highest_qualification) as
    | PoliceOfficerHighestQualification
    | null,
  englishMathsStatus: asString(answers.english_maths_status) as
    | PoliceOfficerEnglishMathsStatus
    | null,
  currentPublicServiceExperience: asString(
    answers.current_public_service_experience,
  ) as PoliceOfficerPublicServiceExperience | null,
  routePreference: asString(answers.route_preference) as
    | PoliceOfficerRoutePreference
    | null,
  studyPatternAvailable: asString(answers.study_pattern_available) as
    | PoliceOfficerStudyPattern
    | null,
  regionAvailability: asString(answers.region_availability) as
    | PoliceOfficerRegionAvailability
    | null,
  checks_before_applying: asArray(
    answers.checks_before_applying,
  ) as PoliceOfficerChecksBeforeApplying[],
  priority: asString(answers.police_priority) as PoliceOfficerPriority | null,
});
