// Zod schema for CareerDecisionPackV1.
// Runtime validation used by:
//   • the pack CLI (repo-first validate / test / import in PR 2)
//   • the edge function's server-side pack resolver (PR 2)
//   • the deterministic evaluator tests here in PR 1
//
// Import is a bare "zod" specifier. Vite resolves the installed npm package
// (^3.25.76). The Deno edge runtime resolves it via `supabase/functions/import_map.json`.

import { z } from "zod";
import { REGULATORY_STATUSES, REGULATORY_APPLIES_TO } from "./regulatory.ts";

const answerValue = z.union([
  z.string(),
  z.array(z.string()),
  z.boolean(),
  z.number(),
  z.null(),
]);

const predicate = z.object({
  questionId: z.string().min(1),
  op: z.enum(["eq", "neq", "in", "not_in", "present", "absent"]),
  value: answerValue.optional(),
});

const ruleEffect = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("block_route"), routeId: z.string(), reason: z.string(), evidenceRefs: z.array(z.string()) }),
  z.object({ kind: z.literal("flag_concern"), routeId: z.string(), concern: z.string(), evidenceRefs: z.array(z.string()) }),
  z.object({ kind: z.literal("require_verification"), routeId: z.string(), check: z.string(), evidenceRefs: z.array(z.string()) }),
  z.object({ kind: z.literal("add_action"), actionTemplateId: z.string(), routeId: z.string().optional() }),
  z.object({ kind: z.literal("add_consideration"), text: z.string(), evidenceRefs: z.array(z.string()) }),
]);

export const rule = z.object({
  id: z.string().min(1),
  when: z.object({ all: z.array(predicate) }),
  then: z.array(ruleEffect).min(1),
});

export const evidenceRecord = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  publishedOrRetrievedOn: z.string().min(4),
  verifiedOn: z.string().min(4),
  publiclyAccessible: z.boolean(),
  withdrawn: z.boolean().optional(),
});

export const routeRef = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  typicalDurationLabel: z.string().min(1),
  typicalCostLabel: z.string().min(1),
  requirementIds: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
});

export const requirementRef = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  verifiedBy: z.string().min(1),
  evidenceRefs: z.array(z.string()),
});

export const questionRef = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  helpText: z.string().optional(),
  allowedValues: z.array(z.string()).optional(),
  // v1.1 additive fields (optional for BC with 1.0.0 packs)
  displayLabel: z.string().optional(),
  helpTextLong: z.string().optional(),
  options: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
  required: z.boolean().optional(),
  visibleWhen: z.array(predicate).optional(),
  moduleId: z.string().optional(),
  inputKind: z.enum(["single_select", "multi_select"]).optional(),
});

export const questionModule = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const actionTemplate = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  effortLabel: z.string().min(1),
  evidenceRefs: z.array(z.string()),
});

export const testProfile = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  answers: z.record(answerValue),
  expect: z.object({
    rankedRouteIds: z.array(z.string()).optional(),
    blockedRouteIds: z.array(z.string()).optional(),
    mustMention: z.array(z.string()).optional(),
    mustNotMention: z.array(z.string()).optional(),
    requiredActionIds: z.array(z.string()).optional(),
  }),
});

export const careerIdentity = z.object({
  canonicalTitle: z.string().min(1),
  participantTitle: z.string().min(1),
  aliases: z.array(z.string()),
  sector: z.string().min(1),
  occupationalFamily: z.string().min(1),
  regulatory: z.object({
    status: z.enum(REGULATORY_STATUSES),
    body: z.string().optional(),
    protectedTitle: z.string().optional(),
    requiredRegisterOrLicence: z.string().optional(),
    appliesTo: z.enum(REGULATORY_APPLIES_TO),
    note: z.string().optional(),
  }),
  geographicScope: z.array(z.string()).min(1),
  // v1.1 additive
  introduction: z.string().optional(),
  whatItCovers: z.array(z.string()).optional(),
  whatItCannotConfirm: z.array(z.string()).optional(),
});

export const contentReview = z.object({
  ownerDisplayName: z.string().min(1),
  reviewerDisplayName: z.string().min(1),
  lastReviewedAt: z.string().min(4),
  nextReviewDueAt: z.string().min(4),
  sourcesAsOf: z.string().min(4),
});

export const careerDecisionPackV1 = z.object({
  schemaVersion: z.literal("career-decision-pack/v1"),
  packVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "packVersion must be semver"),
  roleId: z.string().uuid(),
  slug: z.string().min(1),
  archetypeId: z.string().min(2),
  careerIdentity,
  routes: z.array(routeRef).min(1),
  requirements: z.array(requirementRef),
  questionRefs: z.array(questionRef).min(1),
  // v1.1 additive
  questionModules: z.array(questionModule).optional(),
  rules: z.array(rule),
  evidenceRecords: z.array(evidenceRecord).min(1),
  actionTemplates: z.array(actionTemplate),
  testProfiles: z.array(testProfile).min(12, "packs require at least 12 test profiles"),
  contentReview,
});

// ── RealityCheckResultV1 schema (for read-side validation) ────────────────
// All v1.1-additive fields are optional so persisted rows written before v1.1
// still parse. New evaluator writes always populate them.

const routeClassification = z.enum([
  "currently_looks_most_workable",
  "possible_with_trade_offs",
  "requires_further_verification",
  "not_currently_available_to_you",
]);

const routeEvaluation = z.object({
  routeId: z.string().min(1),
  routeTitle: z.string().min(1),
  classification: routeClassification,
  supportingReasons: z.array(z.string()),
  concerns: z.array(z.string()),
  verificationsRequired: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  summary: z.string().optional(),
  typicalDurationLabel: z.string().optional(),
  typicalCostLabel: z.string().optional(),
  requirementIds: z.array(z.string()).optional(),
});

const evidenceCoverage = z.object({
  level: z.enum(["comprehensive", "adequate", "limited"]),
  completedAnswerCount: z.number().int().nonnegative(),
  totalAnswerCount: z.number().int().nonnegative(),
  note: z.string().min(1),
});

const immediateActionR = z.object({
  actionTemplateId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  evidenceRefs: z.array(z.string()),
  effortLabel: z.string().optional(),
});

const resolvedRequirement = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  verifiedBy: z.string().min(1),
  evidenceRefs: z.array(z.string()),
});

const contentReviewSnapshot = z.object({
  ownerDisplayName: z.string().min(1),
  reviewerDisplayName: z.string().min(1),
  lastReviewedAt: z.string().min(4),
  nextReviewDueAt: z.string().min(4),
  sourcesAsOf: z.string().min(4),
});

const reviewContext = z.object({
  status: z.enum(["current", "review_due", "historical"]),
  reviewDueAt: z.string().min(4),
  graceUntil: z.string().optional(),
});

export const realityCheckResultV1 = z.object({
  schemaVersion: z.literal("reality-check-result/v1"),
  packVersion: z.string().min(1),
  roleId: z.string().uuid(),
  slug: z.string().min(1),
  evaluatedAt: z.string().min(4),
  geographicScope: z.array(z.string()).min(1),
  regulatoryStatus: z.enum(REGULATORY_STATUSES),
  routes: z.array(routeEvaluation),
  considerations: z.array(z.string()),
  immediateActions: z.array(immediateActionR),
  evidenceCoverage,
  limitations: z.array(z.string()),
  participantLanguage: z.object({
    topRoutePhrase: z.string().min(1),
    confidencePhrase: z.string().min(1),
  }),
  // v1.1 additive (optional for read-side BC)
  careerTitle: z.string().optional(),
  participantTitle: z.string().optional(),
  careerIntroduction: z.string().optional(),
  whatItCovers: z.array(z.string()).optional(),
  whatItCannotConfirm: z.array(z.string()).optional(),
  resolvedEvidence: z.array(evidenceRecord).optional(),
  resolvedRequirements: z.array(resolvedRequirement).optional(),
  contentReviewSnapshot: contentReviewSnapshot.optional(),
  reviewContext: reviewContext.optional(),
});

// Cross-field integrity checks that Zod cannot express structurally.
export const validatePackCrossRefs = (pack: unknown): string[] => {
  const result = careerDecisionPackV1.safeParse(pack);
  if (!result.success) return result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const p = result.data;
  const errs: string[] = [];
  const evidenceIds = new Set(p.evidenceRecords.map((e) => e.id));
  const routeIds = new Set(p.routes.map((r) => r.id));
  const requirementIds = new Set(p.requirements.map((r) => r.id));
  const questionIds = new Set(p.questionRefs.map((q) => q.id));
  const actionIds = new Set(p.actionTemplates.map((a) => a.id));

  for (const r of p.routes) {
    for (const rq of r.requirementIds) if (!requirementIds.has(rq)) errs.push(`route ${r.id} references unknown requirement ${rq}`);
    for (const ev of r.evidenceRefs) if (!evidenceIds.has(ev)) errs.push(`route ${r.id} references unknown evidence ${ev}`);
  }
  for (const req of p.requirements) for (const ev of req.evidenceRefs) if (!evidenceIds.has(ev)) errs.push(`requirement ${req.id} references unknown evidence ${ev}`);
  for (const a of p.actionTemplates) for (const ev of a.evidenceRefs) if (!evidenceIds.has(ev)) errs.push(`action ${a.id} references unknown evidence ${ev}`);
  for (const rule of p.rules) {
    for (const pr of rule.when.all) if (!questionIds.has(pr.questionId)) errs.push(`rule ${rule.id} references unknown question ${pr.questionId}`);
    for (const eff of rule.then) {
      if ("routeId" in eff && eff.routeId && !routeIds.has(eff.routeId)) errs.push(`rule ${rule.id} references unknown route ${eff.routeId}`);
      if (eff.kind === "add_action" && !actionIds.has(eff.actionTemplateId)) errs.push(`rule ${rule.id} references unknown action ${eff.actionTemplateId}`);
      if ("evidenceRefs" in eff) for (const ev of eff.evidenceRefs) if (!evidenceIds.has(ev)) errs.push(`rule ${rule.id} references unknown evidence ${ev}`);
    }
  }
  // participant title guard: must include the canonical title as a substring
  // OR be identical. Prevents "Midwife" being renamed to "Home-birth midwife".
  const canon = p.careerIdentity.canonicalTitle.toLowerCase();
  const part = p.careerIdentity.participantTitle.toLowerCase();
  if (part !== canon && !part.includes(canon)) {
    errs.push(`participantTitle "${p.careerIdentity.participantTitle}" narrows canonicalTitle "${p.careerIdentity.canonicalTitle}"`);
  }
  return errs;
};

// ══════════════════════════════════════════════════════════════════════════
// Strict PUBLISH schema — enforced on new 1.1.x pack publication.
// ══════════════════════════════════════════════════════════════════════════
// The read-side `careerDecisionPackV1` schema keeps v1.1 additive fields
// optional so 1.0.0 packs and older persisted result rows continue to parse.
// New pack publication (1.1.x and later) must go through this stricter check
// so participant-facing copy is never accidentally missing.

const publishQuestionOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

const publishQuestionRef = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  displayLabel: z.string().min(1),
  helpText: z.string().optional(),
  helpTextLong: z.string().optional(),
  allowedValues: z.array(z.string()).min(2),
  options: z.array(publishQuestionOption).min(2),
  required: z.boolean(),
  visibleWhen: z.array(predicate).optional(),
  moduleId: z.string().min(1),
});

const publishCareerIdentity = careerIdentity.extend({
  introduction: z.string().min(1),
  whatItCovers: z.array(z.string().min(1)).min(1),
  whatItCannotConfirm: z.array(z.string().min(1)).min(1),
});

export const careerDecisionPackV1Publish = careerDecisionPackV1.extend({
  careerIdentity: publishCareerIdentity,
  questionRefs: z.array(publishQuestionRef).min(1),
  questionModules: z.array(questionModule).min(1),
});

/** Runs both the strict publish schema AND the existing cross-ref checks,
 *  plus publish-only cross-ref checks (option values ⊆ allowedValues, module
 *  refs, visibleWhen question refs). Returns [] on success. */
export const validatePackPublishCompleteness = (pack: unknown): string[] => {
  const parsed = careerDecisionPackV1Publish.safeParse(pack);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const errs = validatePackCrossRefs(pack);
  const p = parsed.data;
  const moduleIds = new Set(p.questionModules!.map((m) => m.id));
  const questionIds = new Set(p.questionRefs.map((q) => q.id));
  for (const q of p.questionRefs) {
    const pq = q as z.infer<typeof publishQuestionRef>;
    if (!moduleIds.has(pq.moduleId)) errs.push(`question ${q.id} references unknown module ${pq.moduleId}`);
    const allowed = new Set(pq.allowedValues);
    for (const opt of pq.options) {
      if (!allowed.has(opt.value)) errs.push(`question ${q.id} option "${opt.value}" not in allowedValues`);
    }
    for (const v of allowed) {
      if (!pq.options.some((o) => o.value === v)) errs.push(`question ${q.id} allowedValue "${v}" has no display option`);
    }
    for (const pred of pq.visibleWhen ?? []) {
      if (!questionIds.has(pred.questionId)) errs.push(`question ${q.id} visibleWhen references unknown question ${pred.questionId}`);
    }
  }
  return errs;
};

// ══════════════════════════════════════════════════════════════════════════
// Strict NEW-WRITE schema for RealityCheckResultV1.
// ══════════════════════════════════════════════════════════════════════════
// Read-side `realityCheckResultV1` keeps v1.1 fields optional so older saved
// snapshots still parse. Every fresh evaluator output MUST satisfy this
// stricter shape so historical rendering never has to reopen the pack.

const newWriteRouteEvaluation = routeEvaluation.extend({
  summary: z.string().min(1),
  typicalDurationLabel: z.string().min(1),
  typicalCostLabel: z.string().min(1),
  requirementIds: z.array(z.string()),
});

const newWriteImmediateAction = immediateActionR.extend({
  effortLabel: z.string().min(1),
});

export const realityCheckResultV1NewWrite = realityCheckResultV1.extend({
  careerTitle: z.string().min(1),
  participantTitle: z.string().min(1),
  careerIntroduction: z.string().min(1),
  whatItCovers: z.array(z.string().min(1)).min(1),
  whatItCannotConfirm: z.array(z.string().min(1)).min(1),
  routes: z.array(newWriteRouteEvaluation),
  immediateActions: z.array(newWriteImmediateAction),
  resolvedEvidence: z.array(evidenceRecord).min(1),
  resolvedRequirements: z.array(resolvedRequirement),
  contentReviewSnapshot,
  reviewContext,
});

// Keys that must NEVER appear in resolved snapshots handed to the participant.
const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  "packId", "pack_id",
  "ownerId", "owner_id", "ownerUserId",
  "reviewerId", "reviewer_id", "reviewerUserId",
  "internalNotes", "internal_notes",
  "adminNotes", "admin_notes",
]);

const scanForbiddenKeys = (node: unknown, path: string, errs: string[]): void => {
  if (Array.isArray(node)) {
    node.forEach((child, i) => scanForbiddenKeys(child, `${path}[${i}]`, errs));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_SNAPSHOT_KEYS.has(k)) errs.push(`${path}.${k}: forbidden snapshot key`);
      scanForbiddenKeys(v, `${path}.${k}`, errs);
    }
  }
};

/** Runs the strict schema AND cross-integrity checks required for a self-
 *  contained result. Returns [] on success. */
export const validateResultNewWriteCompleteness = (result: unknown): string[] => {
  const parsed = realityCheckResultV1NewWrite.safeParse(result);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const r = parsed.data;
  const errs: string[] = [];
  const resolvedEvIds = new Set(r.resolvedEvidence!.map((e) => e.id));
  const resolvedReqIds = new Set(r.resolvedRequirements!.map((q) => q.id));
  for (const route of r.routes) {
    for (const e of route.evidenceRefs) {
      if (!resolvedEvIds.has(e)) errs.push(`route ${route.routeId} evidenceRef "${e}" not in resolvedEvidence`);
    }
    for (const rq of route.requirementIds ?? []) {
      if (!resolvedReqIds.has(rq)) errs.push(`route ${route.routeId} requirementId "${rq}" not in resolvedRequirements`);
    }
  }
  for (const a of r.immediateActions) {
    for (const e of a.evidenceRefs) {
      if (!resolvedEvIds.has(e)) errs.push(`action ${a.actionTemplateId} evidenceRef "${e}" not in resolvedEvidence`);
    }
  }
  // Owner/reviewer *display names* are legitimate in contentReviewSnapshot;
  // forbid only internal *IDs* and administrative notes. Scan the RAW input
  // (not the parsed data) because Zod strips unknown keys during parse.
  const raw = result as Record<string, unknown>;
  scanForbiddenKeys(raw.resolvedEvidence, "resolvedEvidence", errs);
  scanForbiddenKeys(raw.resolvedRequirements, "resolvedRequirements", errs);
  scanForbiddenKeys(raw.contentReviewSnapshot, "contentReviewSnapshot", errs);
  return errs;
};

