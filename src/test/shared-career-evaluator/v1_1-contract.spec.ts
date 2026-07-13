// PR 3c-i.a — additive contract + evaluator-version compatibility tests.
//
// Proves:
//   • CANONICAL_EVALUATOR_SCHEMA_VERSION is the only value new writes emit.
//   • normalizeEvaluatorSchemaVersion accepts legacy variants and rejects
//     unrelated strings.
//   • The evaluator populates every v1.1 additive field required for
//     historical rendering (title, intro snapshot, embedded evidence, embedded
//     content-review, review context, per-route summary/duration/cost).
//   • RealityCheckResultV1 (new evaluator output) validates against the new
//     realityCheckResultV1 zod schema.
//   • A "legacy-shape" v1 result missing v1.1 fields still parses (read-side BC).
//   • The existing 1.0.0 Midwife pack still validates (pack-side BC).
//   • Determinism preserved: same inputs → same output.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname_local = dirname(fileURLToPath(import.meta.url));

import {
  careerDecisionPackV1,
  realityCheckResultV1,
} from "@shared/career-evaluator/v1/schema";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import {
  CANONICAL_EVALUATOR_SCHEMA_VERSION,
  normalizeEvaluatorSchemaVersion,
  type CareerDecisionPackV1,
  type RealityCheckResultV1,
} from "@shared/career-evaluator/v1/types";

const NOW = "2026-07-13T00:00:00.000Z";

const midwife = JSON.parse(
  readFileSync(resolve(__dirname_local, "../../../content/career-packs/midwife/1.0.0.json"), "utf-8"),
) as CareerDecisionPackV1;

describe("evaluator-version compatibility", () => {
  it("exposes the canonical string", () => {
    expect(CANONICAL_EVALUATOR_SCHEMA_VERSION).toBe("reality-check-result/v1");
  });

  it("normalises canonical value", () => {
    expect(normalizeEvaluatorSchemaVersion("reality-check-result/v1")).toBe(CANONICAL_EVALUATOR_SCHEMA_VERSION);
  });

  it("normalises short-form 'v1' and hyphenated variant", () => {
    expect(normalizeEvaluatorSchemaVersion("v1")).toBe(CANONICAL_EVALUATOR_SCHEMA_VERSION);
    expect(normalizeEvaluatorSchemaVersion("reality-check-result-v1")).toBe(CANONICAL_EVALUATOR_SCHEMA_VERSION);
    expect(normalizeEvaluatorSchemaVersion("REALITY-CHECK-RESULT/V1")).toBe(CANONICAL_EVALUATOR_SCHEMA_VERSION);
  });

  it("returns null for null/undefined/empty (legacy engine rows)", () => {
    expect(normalizeEvaluatorSchemaVersion(null)).toBeNull();
    expect(normalizeEvaluatorSchemaVersion(undefined)).toBeNull();
    expect(normalizeEvaluatorSchemaVersion("")).toBeNull();
  });

  it("returns null for unrelated / hostile strings", () => {
    expect(normalizeEvaluatorSchemaVersion("v2")).toBeNull();
    expect(normalizeEvaluatorSchemaVersion("reality-check-result/v2")).toBeNull();
    expect(normalizeEvaluatorSchemaVersion("<script>")).toBeNull();
  });

  it("evaluator only ever writes the canonical value", () => {
    const r = evaluate(midwife, midwife.testProfiles[0].answers, { now: NOW });
    expect(r.schemaVersion).toBe(CANONICAL_EVALUATOR_SCHEMA_VERSION);
  });
});

describe("v1.1 additive contract — evaluator output", () => {
  const result = evaluate(midwife, midwife.testProfiles[0].answers, {
    now: NOW,
    reviewContext: { status: "current", reviewDueAt: "2027-01-01T00:00:00.000Z" },
  });

  it("populates careerTitle and participantTitle from the pack", () => {
    expect(result.careerTitle).toBe(midwife.careerIdentity.canonicalTitle);
    expect(result.participantTitle).toBe(midwife.careerIdentity.participantTitle);
  });

  it("embeds a content-review snapshot", () => {
    expect(result.contentReviewSnapshot).toEqual({
      ownerDisplayName: midwife.contentReview.ownerDisplayName,
      reviewerDisplayName: midwife.contentReview.reviewerDisplayName,
      lastReviewedAt: midwife.contentReview.lastReviewedAt,
      nextReviewDueAt: midwife.contentReview.nextReviewDueAt,
      sourcesAsOf: midwife.contentReview.sourcesAsOf,
    });
  });

  it("preserves review context passed by the runtime", () => {
    expect(result.reviewContext).toEqual({ status: "current", reviewDueAt: "2027-01-01T00:00:00.000Z" });
  });

  it("embeds resolvedEvidence for every ref surfaced in the result", () => {
    expect(result.resolvedEvidence).toBeDefined();
    const emittedIds = new Set<string>();
    for (const r of result.routes) for (const e of r.evidenceRefs) emittedIds.add(e);
    for (const a of result.immediateActions) for (const e of a.evidenceRefs) emittedIds.add(e);
    const snapshotIds = new Set((result.resolvedEvidence ?? []).map((e) => e.id));
    for (const id of emittedIds) expect(snapshotIds.has(id), `missing snapshot for ${id}`).toBe(true);
    // Snapshot deterministically sorted
    const ids = (result.resolvedEvidence ?? []).map((e) => e.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("carries route rendering fields (summary + duration + cost + requirementIds)", () => {
    for (const r of result.routes) {
      expect(typeof r.summary).toBe("string");
      expect(typeof r.typicalDurationLabel).toBe("string");
      expect(typeof r.typicalCostLabel).toBe("string");
      expect(Array.isArray(r.requirementIds)).toBe(true);
    }
  });

  it("carries effortLabel on every immediate action", () => {
    for (const a of result.immediateActions) expect(typeof a.effortLabel).toBe("string");
  });

  it("retains assessment date, pack version, geographic scope, regulatory status", () => {
    expect(result.evaluatedAt).toBe(NOW);
    expect(result.packVersion).toBe(midwife.packVersion);
    expect(result.geographicScope).toEqual(midwife.careerIdentity.geographicScope);
    expect(result.regulatoryStatus).toBe(midwife.careerIdentity.regulatory.status);
  });

  it("validates against realityCheckResultV1 zod schema", () => {
    const parsed = realityCheckResultV1.safeParse(result);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
  });
});

describe("v1.1 additive contract — determinism", () => {
  it("produces byte-identical output for identical inputs", () => {
    const a = evaluate(midwife, midwife.testProfiles[3].answers, { now: NOW });
    const b = evaluate(midwife, midwife.testProfiles[3].answers, { now: NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("backward compatibility", () => {
  it("existing 1.0.0 Midwife pack still validates against the pack schema", () => {
    const parsed = careerDecisionPackV1.safeParse(midwife);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
  });

  it("a legacy-shape v1 result missing v1.1 additive fields still parses (read-side BC)", () => {
    const legacyShape: RealityCheckResultV1 = {
      schemaVersion: "reality-check-result/v1",
      packVersion: "1.0.0",
      roleId: midwife.roleId,
      slug: midwife.slug,
      evaluatedAt: NOW,
      geographicScope: ["England"],
      regulatoryStatus: "statutory_registration",
      routes: [{
        routeId: "r1", routeTitle: "R1", classification: "requires_further_verification",
        supportingReasons: [], concerns: [], verificationsRequired: [], evidenceRefs: [],
      }],
      considerations: [],
      immediateActions: [],
      evidenceCoverage: { level: "limited", completedAnswerCount: 0, totalAnswerCount: 1, note: "n" },
      limitations: [],
      participantLanguage: { topRoutePhrase: "p", confidencePhrase: "c" },
    };
    const parsed = realityCheckResultV1.safeParse(legacyShape);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
  });
});
