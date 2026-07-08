// Modular questionnaire configuration — types.
//
// Universal, family and role-specific question definitions are composed into
// an ordered visibleSteps array by the registry. The wizard renders any
// config generically so a new role only requires question data + a signals
// module + a route engine.

export type ControlType = "single_select" | "multi_select" | "text";

export type QuestionPhase =
  | "starting_point"
  | "qualifications"
  | "practical_constraints";

export interface QuestionOption {
  value: string;
  label: string;
  small?: string;
  // If true, selecting this option clears every other selection AND is cleared
  // by selecting any other option. Used for "None", "Not sure yet", etc.
  exclusive?: boolean;
}

export interface ConditionalField {
  // Show the field when the current answer includes any of these option values.
  showWhenValueIn: readonly string[];
  label: string;
  placeholder?: string;
  // Never used as an eligibility signal.
  hint?: string;
}

/**
 * Whole-question visibility gate. When set, the question is only rendered
 * (and only counted for advance/submit) if the referenced prior question's
 * answer overlaps `valueIn`. This is distinct from `conditionalField` which
 * only reveals an inline text field on the SAME question.
 *
 * Hidden questions have their stored answer dropped by sanitiseAnswerMap so
 * signal extraction never sees stale values.
 */
export interface VisibleWhen {
  questionId: string;
  valueIn: readonly string[];
}

export interface Question {
  id: string;
  phase: QuestionPhase;
  title: string;
  helpText?: string;
  whyWeAsk: string;
  controlType: ControlType;
  options?: readonly QuestionOption[];
  maxSelections?: number;
  conditionalField?: ConditionalField;
  visibleWhen?: VisibleWhen;
  required?: boolean; // default true
}

export interface RoleConfig {
  roleSlug: string;
  family: string;
  engineId: string;
  questionnaireVersion: string;
  // Each role owns its ordered question list — universal / family / role-
  // specific questions are composed at config time. Two roles may declare
  // the same question id (e.g. `working_conditions_to_check`) with different
  // options; there is no global question bank.
  questions: readonly Question[];
  // Wire the config to a role-specific signal extractor + edge-function
  // request-body key. Keeps the wizard renderer generic — it doesn't need
  // to know which role it is rendering.
  requestBodyKey: string;
  extractSignals: (answers: AnswerMap, inline: InlineTextMap) => unknown;
  // Optional short scope note shown at the top of the wizard. Use to clarify
  // what a role does and does not cover (e.g. gas registration is separate).
  scopeNote?: string;
}


// Kept as an alias for backwards compatibility — resolution is now a no-op.
export type ResolvedConfig = RoleConfig;


// Answer storage inside the v3 draft.
export type AnswerValue = string | string[];
export type AnswerMap = Record<string, AnswerValue>;
export type InlineTextMap = Record<string, string>;
