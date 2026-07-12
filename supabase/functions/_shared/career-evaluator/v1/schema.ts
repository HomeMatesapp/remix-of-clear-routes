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
  rules: z.array(rule),
  evidenceRecords: z.array(evidenceRecord).min(1),
  actionTemplates: z.array(actionTemplate),
  testProfiles: z.array(testProfile).min(12, "packs require at least 12 test profiles"),
  contentReview,
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
