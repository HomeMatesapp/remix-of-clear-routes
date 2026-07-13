import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import { validateResultNewWriteCompleteness } from "@shared/career-evaluator/v1/schema";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const NOW = "2026-07-13T00:00:00.000Z";
const REVIEW: { status: "current"; reviewDueAt: string } = { status: "current", reviewDueAt: "2027-01-13" };

const load = (slug: string) =>
  JSON.parse(readFileSync(resolve(__dir, `../../../content/career-packs/${slug}/1.1.0.json`), "utf-8")) as CareerDecisionPackV1;

describe("self-contained result — Result alone renders participant view", () => {
  for (const slug of ["midwife", "carpenter-joiner", "photographer"]) {
    it(`${slug} representative profile: result carries every participant-visible field`, () => {
      const pack = load(slug);
      const profile = pack.testProfiles[0];
      const result = evaluate(pack, profile.answers, { now: NOW, reviewContext: REVIEW });

      // Titles / intro / coverage
      expect(result.careerTitle).toBe(pack.careerIdentity.canonicalTitle);
      expect(result.participantTitle).toBe(pack.careerIdentity.participantTitle);
      expect(result.careerIntroduction).toBe(pack.careerIdentity.introduction);
      expect(result.whatItCovers).toEqual([...pack.careerIdentity.whatItCovers!]);
      expect(result.whatItCannotConfirm).toEqual([...pack.careerIdentity.whatItCannotConfirm!]);

      // Scope / dates / review context
      expect(result.geographicScope).toEqual(pack.careerIdentity.geographicScope);
      expect(result.packVersion).toBe(pack.packVersion);
      expect(result.evaluatedAt).toBe(NOW);
      expect(result.contentReviewSnapshot?.nextReviewDueAt).toBe(pack.contentReview.nextReviewDueAt);
      expect(result.reviewContext).toEqual(REVIEW);

      // Routes: title, summary, duration, cost, requirementIds
      for (const r of result.routes) {
        expect(r.routeTitle.length).toBeGreaterThan(0);
        expect(r.summary!.length).toBeGreaterThan(0);
        expect(r.typicalDurationLabel!.length).toBeGreaterThan(0);
        expect(r.typicalCostLabel!.length).toBeGreaterThan(0);
        expect(Array.isArray(r.requirementIds)).toBe(true);
      }

      // Immediate actions: descriptor labels present, no unresolved evidence
      const resolvedEvIds = new Set(result.resolvedEvidence!.map((e) => e.id));
      for (const a of result.immediateActions) {
        expect(a.effortLabel!.length).toBeGreaterThan(0);
        for (const e of a.evidenceRefs) expect(resolvedEvIds.has(e)).toBe(true);
      }
      for (const r of result.routes) for (const e of r.evidenceRefs) expect(resolvedEvIds.has(e)).toBe(true);

      // Requirements resolved for ranked routes
      const resolvedReqIds = new Set(result.resolvedRequirements!.map((r) => r.id));
      for (const r of result.routes) for (const rid of r.requirementIds ?? []) expect(resolvedReqIds.has(rid)).toBe(true);

      // Limitations preserved
      expect(Array.isArray(result.limitations)).toBe(true);

      // Strict new-write completeness passes
      expect(validateResultNewWriteCompleteness(result)).toEqual([]);
    });

    it(`${slug} result can be rendered without re-loading the pack`, () => {
      const pack = load(slug);
      const result = evaluate(pack, pack.testProfiles[0].answers, { now: NOW, reviewContext: REVIEW });
      // Serialise and reload — simulate loading a saved decision from the DB.
      const json = JSON.parse(JSON.stringify(result));
      // Every evidenceRef on every route must resolve inside `resolvedEvidence`
      // — the result alone is sufficient.
      const ids = new Set(json.resolvedEvidence.map((e: { id: string }) => e.id));
      for (const r of json.routes) for (const e of r.evidenceRefs) expect(ids.has(e)).toBe(true);
      for (const a of json.immediateActions) for (const e of a.evidenceRefs) expect(ids.has(e)).toBe(true);
    });
  }
});

describe("review-due preservation", () => {
  it("review-due binding is captured in reviewContext and survives serialisation", () => {
    const pack = load("photographer");
    const rc: { status: "review_due"; reviewDueAt: string; graceUntil: string } = {
      status: "review_due",
      reviewDueAt: "2026-06-01T00:00:00.000Z",
      graceUntil: "2026-09-01T00:00:00.000Z",
    };
    const result = evaluate(pack, pack.testProfiles[0].answers, { now: NOW, reviewContext: rc });
    expect(result.reviewContext).toEqual(rc);
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.reviewContext).toEqual(rc);
    // Limitation about scope still present (does not depend on publication row)
    expect(result.limitations.length).toBeGreaterThan(0);
    // Passes strict new-write completeness
    expect(validateResultNewWriteCompleteness(result)).toEqual([]);
  });
});
