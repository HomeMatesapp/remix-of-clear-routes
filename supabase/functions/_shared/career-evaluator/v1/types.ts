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
    /** Regulator or professional body name (display). */
    body?: string;
    /** Statutorily protected title, if any. */
    protectedTitle?: string;
    /** Required register, licence or industry scheme. */
    requiredRegisterOrLicence?: string;
    /** Whether the constraint applies to every route or only particular work. */
    appliesTo: RegulatoryAppliesTo;
    /** Free-text nuance for participant wording. */
    note?: string;
  };
  /** England-only for the pilot. */
  geographicScope: readonly string[];
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

export interface QuestionRef {
  id: string;
  label: string;
  helpText?: string;
  /** Answer values the rule DSL is allowed to reference. Enforced at validate. */
  allowedValues?: readonly string[];
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
  rules: readonly Rule[];
  evidenceRecords: readonly EvidenceRecord[];
  actionTemplates: readonly ActionTemplate[];
  testProfiles: readonly TestProfile[];
  contentReview: ContentReview;
}

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
}
