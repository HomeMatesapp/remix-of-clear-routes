// Runtime-neutral type definitions for CareerDecisionPackV1 and
// RealityCheckResultV1. Consumed by both the Vite frontend and the Supabase
// edge function via a bare "@shared/career-evaluator/v1" import.
//
// The pack shape here is the AUTHORITATIVE source of decision content. Mutable
// lifecycle state (published / review_due / suspended / superseded / archived)
// lives in the relational `career_pack_publications` table introduced in PR 2
// and is intentionally NOT modelled on the pack.

import type {
  RegulatoryStatus,
  RegulatoryAppliesTo,
} from "./regulatory.ts";

// ── Answer surface (kept intentionally small) ──────────────────────────────

export type AnswerValue = string | string[] | boolean | number | null;
export type AnswerMap = Record<string, AnswerValue>;

// ── Content: careerIdentity ────────────────────────────────────────────────

export interface CareerIdentity {
  /** Canonical occupation title. MUST match the roles table title. */
  canonicalTitle: string;
  /** Participant-facing pack title. May be identical to `canonicalTitle`;
   *  MUST NOT rename the canonical occupation into something materially
   *  narrower. Enforced by the publish gate. */
  participantTitle: string;
  aliases: readonly string[];
  sector: string;
  occupationalFamily: string;
  regulatory: {
    status: RegulatoryStatus;
    body?: string;
    protectedTitle?: string;
    requiredRegisterOrLicence?: string;
    appliesTo: RegulatoryAppliesTo;
    note?: string;
  };
  /** England-only for the pilot. */
  geographicScope: readonly string[];
  /** v1.1 additive: participant-facing intro shown on the Reality Check start
   *  screen. Optional so 1.0.0 packs continue to validate. */
  introduction?: string;
  /** v1.1 additive: bullet list of what this Reality Check confirms. */
  whatItCovers?: readonly string[];
  /** v1.1 additive: bullet list of what this Reality Check does NOT confirm. */
  whatItCannotConfirm?: readonly string[];
}

// ── Content: routes and requirements ───────────────────────────────────────

export interface RouteRef {
  id: string;
  title: string;
  summary: string;
  /** Descriptor only — never rendered as a probability. */
  typicalDurationLabel: string;
  /** Descriptor only — never rendered as a fee quote. */
  typicalCostLabel: string;
  /** IDs of `requirements[]` this route needs. */
  requirementIds: readonly string[];
  /** Evidence records supporting this route. */
  evidenceRefs: readonly string[];
}

export interface RequirementRef {
  id: string;
  label: string;
  /** Human-readable description of what the requirement is. */
  description: string;
  /** How this requirement can be verified by the participant. */
  verifiedBy: string;
  evidenceRefs: readonly string[];
}

// ── Content: rules (pure predicate DSL) ────────────────────────────────────
//
// Rules are pure JSON. The evaluator interprets them; there is no code inside
// the pack. This keeps packs safe to import from git and safe to store as
// immutable JSON in the database.

export type Comparator = "eq" | "neq" | "in" | "not_in" | "present" | "absent";

export interface Predicate {
  /** ID of a question in `questionRefs[]`. */
  questionId: string;
  op: Comparator;
  /** Required for eq/neq/in/not_in. */
  value?: AnswerValue;
}

export type RuleEffect =
  | { kind: "block_route"; routeId: string; reason: string; evidenceRefs: readonly string[] }
  | { kind: "flag_concern"; routeId: string; concern: string; evidenceRefs: readonly string[] }
  | { kind: "require_verification"; routeId: string; check: string; evidenceRefs: readonly string[] }
  | { kind: "add_action"; actionTemplateId: string; routeId?: string }
  | { kind: "add_consideration"; text: string; evidenceRefs: readonly string[] };

export interface Rule {
  id: string;
  when: {
    /** All predicates must match (AND). Empty array = always. */
    all: readonly Predicate[];
  };
  then: readonly RuleEffect[];
}

// ── Content: questions ─────────────────────────────────────────────────────

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

/** Participant-facing input control kind. Extend only when a pack genuinely
 *  requires it. Every kind added here must be handled explicitly by the
 *  publish validator, the public projector, the sanitiser and the renderer. */
export type PublicQuestionInputKind = "single_select" | "multi_select";

export const PUBLIC_QUESTION_INPUT_KINDS: readonly PublicQuestionInputKind[] = [
  "single_select",
  "multi_select",
] as const;

export interface QuestionRef {
  id: string;
  label: string;
  helpText?: string;
  /** Answer values the rule DSL is allowed to reference. Enforced at validate. */
  allowedValues?: readonly string[];
  /** v1.1 additive: participant-facing display label (falls back to `label`). */
  displayLabel?: string;
  /** v1.1 additive: longer explanatory help text for the wizard. */
  helpTextLong?: string;
  /** v1.1 additive: rich options with descriptions for the wizard. */
  options?: readonly QuestionOption[];
  /** v1.1 additive: whether the question is required for a valid submission. */
  required?: boolean;
  /** v1.1 additive: conditional visibility — all predicates must match (AND).
   *  When absent the question is always visible. */
  visibleWhen?: readonly Predicate[];
  /** v1.1 additive: id of the containing questionnaire module. */
  moduleId?: string;
  /** v1.1 additive: explicit participant input kind. Required at publish for
   *  1.1.0+; optional on read so 1.0.0 packs still parse. */
  inputKind?: PublicQuestionInputKind;
}

/** v1.1 additive: participant-facing questionnaire grouping. */
export interface QuestionModule {
  id: string;
  title: string;
  description?: string;
}

// ── Content: evidence ──────────────────────────────────────────────────────

export interface EvidenceRecord {
  id: string;
  title: string;
  /** Publisher — regulator, government body, university, standard, etc. */
  publisher: string;
  url: string;
  publishedOrRetrievedOn: string; // ISO date
  /** Verified-on date used by the pack author. */
  verifiedOn: string;
  /** Freely accessible? Publish gate rejects `false` for statutory sources. */
  publiclyAccessible: boolean;
  /** Withdrawn evidence causes the publish gate (or a later admin action) to
   *  suspend the pack, not merely warn. */
  withdrawn?: boolean;
}

// ── Content: actions ───────────────────────────────────────────────────────

export interface ActionTemplate {
  id: string;
  title: string;
  description: string;
  /** Descriptor only — deliberately not a duration prediction. */
  effortLabel: string;
  evidenceRefs: readonly string[];
}

// ── Content: test profiles ─────────────────────────────────────────────────
//
// Each pack ships ≥ 12 test profiles that the evaluator MUST pass. This is the
// primary quality gate: content changes without profile changes are visible,
// and profile changes require reviewer approval.

export interface TestProfile {
  id: string;
  label: string;
  answers: AnswerMap;
  expect: {
    /** Route IDs, in the order they must rank. */
    rankedRouteIds?: readonly string[];
    /** Route IDs that must be blocked. */
    blockedRouteIds?: readonly string[];
    /** Substrings the top route's summary or concerns must contain. */
    mustMention?: readonly string[];
    /** Substrings the whole result MUST NOT contain (language safety). */
    mustNotMention?: readonly string[];
    /** Required immediate-action template IDs. */
    requiredActionIds?: readonly string[];
  };
}

// ── Content: review descriptors (audit-only, immutable) ────────────────────

export interface ContentReview {
  ownerDisplayName: string;
  reviewerDisplayName: string;
  lastReviewedAt: string;
  nextReviewDueAt: string;
  sourcesAsOf: string;
}

// ── Pack ───────────────────────────────────────────────────────────────────

export interface CareerDecisionPackV1 {
  schemaVersion: "career-decision-pack/v1";
  packVersion: string;
  /** Canonical role id from public.roles. */
  roleId: string;
  /** Canonical slug from public.roles. */
  slug: string;
  archetypeId: string;
  careerIdentity: CareerIdentity;
  routes: readonly RouteRef[];
  requirements: readonly RequirementRef[];
  questionRefs: readonly QuestionRef[];
  /** v1.1 additive: participant-facing questionnaire modules. */
  questionModules?: readonly QuestionModule[];
  rules: readonly Rule[];
  evidenceRecords: readonly EvidenceRecord[];
  actionTemplates: readonly ActionTemplate[];
  testProfiles: readonly TestProfile[];
  contentReview: ContentReview;
}

/** Canonical evaluator schema version string. Historical rows may also carry
 *  `null` (legacy engines) or the short-form `"v1"`. See
 *  {@link normalizeEvaluatorSchemaVersion}. */
export const CANONICAL_EVALUATOR_SCHEMA_VERSION = "reality-check-result/v1" as const;
export type CanonicalEvaluatorSchemaVersion = typeof CANONICAL_EVALUATOR_SCHEMA_VERSION;

/** Reads a persisted evaluator_schema_version and returns the canonical form
 *  when the row represents a generic v1 result, or `null` when the row is a
 *  legacy engine result (no v1 schema was in force at write time).
 *  Never emits any non-canonical string. */
export const normalizeEvaluatorSchemaVersion = (
  raw: string | null | undefined,
): CanonicalEvaluatorSchemaVersion | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "reality-check-result/v1" || s === "v1" || s === "reality-check-result-v1") {
    return CANONICAL_EVALUATOR_SCHEMA_VERSION;
  }
  return null;
};

// ── Result: RealityCheckResultV1 ───────────────────────────────────────────

/**
 * Route classification, deliberately NOT probabilistic.
 * Participant-facing phrases are chosen in `phrases.ts`.
 */
export type RouteClassification =
  | "currently_looks_most_workable"
  | "possible_with_trade_offs"
  | "requires_further_verification"
  | "not_currently_available_to_you";

export interface RouteEvaluation {
  routeId: string;
  routeTitle: string;
  classification: RouteClassification;
  supportingReasons: readonly string[];
  concerns: readonly string[];
  verificationsRequired: readonly string[];
  evidenceRefs: readonly string[];
  /** v1.1 additive: route summary snapshot so ResultV1View can render without
   *  loading the pack. Optional so pre-v1.1 persisted results still parse. */
  summary?: string;
  typicalDurationLabel?: string;
  typicalCostLabel?: string;
  requirementIds?: readonly string[];
}

/**
 * Evidence coverage — reported as coverage, never as a probability of success.
 */
export interface EvidenceCoverage {
  level: "comprehensive" | "adequate" | "limited";
  completedAnswerCount: number;
  totalAnswerCount: number;
  note: string;
}

export interface ImmediateAction {
  actionTemplateId: string;
  title: string;
  description: string;
  evidenceRefs: readonly string[];
  /** v1.1 additive: descriptor label copied from the pack action template. */
  effortLabel?: string;
}

/** v1.1 additive: snapshot of a resolved requirement so ResultV1View does not
 *  need to reopen the pack to render requirement descriptions. */
export interface ResolvedRequirement {
  id: string;
  label: string;
  description: string;
  verifiedBy: string;
  evidenceRefs: readonly string[];
}

/** v1.1 additive: snapshot of the pack's content-review metadata, embedded in
 *  the result so historical replay preserves who authored/reviewed the pack
 *  and when the next review is due. */
export interface ContentReviewSnapshot {
  ownerDisplayName: string;
  reviewerDisplayName: string;
  lastReviewedAt: string;
  nextReviewDueAt: string;
  sourcesAsOf: string;
}

/** v1.1 additive: mutable review context supplied by the edge function at
 *  evaluation time (the evaluator itself cannot know servability state).
 *  Embedded in the result so a saved decision preserves "was this current or
 *  review_due when the participant answered?" without a live pack lookup. */
export interface ReviewContext {
  /** "current" = pack was actively published; "review_due" = past nextReviewDueAt
   *  but within grace; "historical" = evaluated against a superseded pack. */
  status: "current" | "review_due" | "historical";
  reviewDueAt: string;
  /** ISO datetime the grace window ends, when status = review_due. */
  graceUntil?: string;
}

export interface RealityCheckResultV1 {
  schemaVersion: "reality-check-result/v1";
  packVersion: string;
  roleId: string;
  slug: string;
  /** ISO datetime the evaluator ran. */
  evaluatedAt: string;
  /** Copied from the pack so the UI never needs to re-open the pack. */
  geographicScope: readonly string[];
  /** Copied so historical replay knows what regulatory framing to use. */
  regulatoryStatus: RegulatoryStatus;
  routes: readonly RouteEvaluation[];
  considerations: readonly string[];
  immediateActions: readonly ImmediateAction[];
  evidenceCoverage: EvidenceCoverage;
  limitations: readonly string[];
  /** Phrases the UI is expected to render for the top route. Enforced by the
   *  language-safety test — no probability wording, no "best route" claim. */
  participantLanguage: {
    topRoutePhrase: string;
    confidencePhrase: string;
  };
  /** v1.1 additive fields — always populated by the evaluator on new writes,
   *  optional on read so pre-v1.1 persisted rows still parse. */
  careerTitle?: string;
  participantTitle?: string;
  careerIntroduction?: string;
  whatItCovers?: readonly string[];
  whatItCannotConfirm?: readonly string[];
  /** Snapshot copies of only the evidence records referenced anywhere in this
   *  result. Sorted by id for determinism. */
  resolvedEvidence?: readonly EvidenceRecord[];
  /** Snapshot copies of only the requirements referenced by ranked routes. */
  resolvedRequirements?: readonly ResolvedRequirement[];
  contentReviewSnapshot?: ContentReviewSnapshot;
  /** Filled in by the edge function; evaluator leaves it undefined when it
   *  isn't supplied via options. */
  reviewContext?: ReviewContext;
}
