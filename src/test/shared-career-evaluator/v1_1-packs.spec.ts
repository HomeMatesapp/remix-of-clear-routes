import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  careerDecisionPackV1,
  careerDecisionPackV1Publish,
  validatePackCrossRefs,
  validatePackPublishCompleteness,
  validateResultNewWriteCompleteness,
} from "@shared/career-evaluator/v1/schema";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import { FORBIDDEN_LANGUAGE } from "@shared/career-evaluator/v1/phrases";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const NOW = "2026-07-13T00:00:00.000Z";

const REVIEW_CONTEXT = { status: "current" as const, reviewDueAt: "2027-01-12" };

const load = (slug: string) =>
  JSON.parse(readFileSync(resolve(__dir, `../../../content/career-packs/${slug}/1.1.0.json`), "utf-8")) as CareerDecisionPackV1;

const cases: Array<{ slug: string; regulatory: string; minProfiles: number }> = [
  { slug: "midwife", regulatory: "statutory_registration", minProfiles: 12 },
  { slug: "carpenter-joiner", regulatory: "not_formally_regulated", minProfiles: 12 },
  { slug: "photographer", regulatory: "not_formally_regulated", minProfiles: 12 },
];

for (const c of cases) {
  describe(`${c.slug} 1.1.0 pack — publish schema and cross-refs`, () => {
    const pack = load(c.slug);

    it("packVersion is 1.1.0", () => {
      expect(pack.packVersion).toBe("1.1.0");
    });
    it("parses under the backward-compatible READ schema", () => {
      const r = careerDecisionPackV1.safeParse(pack);
      if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    });
    it("parses under the strict PUBLISH schema", () => {
      const r = careerDecisionPackV1Publish.safeParse(pack);
      if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    });
    it("has no read cross-reference errors", () => {
      expect(validatePackCrossRefs(pack)).toEqual([]);
    });
    it("has no publish-completeness errors", () => {
      expect(validatePackPublishCompleteness(pack)).toEqual([]);
    });
    it(`ships at least ${c.minProfiles} test profiles`, () => {
      expect(pack.testProfiles.length).toBeGreaterThanOrEqual(c.minProfiles);
    });
    it("declares the expected regulatory status", () => {
      expect(pack.careerIdentity.regulatory.status).toBe(c.regulatory);
    });
    it("declares participant introduction and coverage lists", () => {
      expect(pack.careerIdentity.introduction!.length).toBeGreaterThan(20);
      expect(pack.careerIdentity.whatItCovers!.length).toBeGreaterThan(0);
      expect(pack.careerIdentity.whatItCannotConfirm!.length).toBeGreaterThan(0);
    });
    it("declares at least one question module and every question references one", () => {
      expect(pack.questionModules!.length).toBeGreaterThan(0);
      const modIds = new Set(pack.questionModules!.map((m) => m.id));
      for (const q of pack.questionRefs) {
        expect(q.moduleId, `question ${q.id} missing moduleId`).toBeTruthy();
        expect(modIds.has(q.moduleId!)).toBe(true);
      }
    });
    it("every questionRef has a display label and options match allowedValues", () => {
      for (const q of pack.questionRefs) {
        expect(q.displayLabel).toBeTruthy();
        expect(q.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        const allowed = new Set(q.allowedValues);
        for (const o of q.options!) expect(allowed.has(o.value)).toBe(true);
        for (const v of allowed) expect(q.options!.some((o) => o.value === v)).toBe(true);
        expect(typeof q.required).toBe("boolean");
      }
    });
    it("at least one questionRef declares conditional visibility", () => {
      expect(pack.questionRefs.some((q) => (q.visibleWhen?.length ?? 0) > 0)).toBe(true);
    });
  });

  describe(`${c.slug} 1.1.0 pack — every profile evaluates safely`, () => {
    const pack = load(c.slug);
    for (const profile of pack.testProfiles) {
      it(`${profile.label}`, () => {
        const result = evaluate(pack, profile.answers, { now: NOW, reviewContext: REVIEW_CONTEXT });
        const rendered = JSON.stringify(result).toLowerCase();
        for (const forbidden of FORBIDDEN_LANGUAGE) {
          expect(rendered.includes(forbidden.toLowerCase()), `forbidden phrase "${forbidden}"`).toBe(false);
        }
        if (profile.expect.blockedRouteIds) {
          const blocked = result.routes.filter((r) => r.classification === "not_currently_available_to_you").map((r) => r.routeId).sort();
          expect(blocked).toEqual([...profile.expect.blockedRouteIds].sort());
        }
        if (profile.expect.mustMention) {
          for (const phrase of profile.expect.mustMention) {
            expect(rendered.includes(phrase.toLowerCase()), `expected "${phrase}"`).toBe(true);
          }
        }
        if (profile.expect.mustNotMention) {
          for (const phrase of profile.expect.mustNotMention) {
            expect(rendered.includes(phrase.toLowerCase()), `should not mention "${phrase}"`).toBe(false);
          }
        }
        if (profile.expect.requiredActionIds) {
          const ids = result.immediateActions.map((a) => a.actionTemplateId);
          for (const req of profile.expect.requiredActionIds) expect(ids).toContain(req);
        }
        // Strict new-write completeness for a freshly generated result.
        const errs = validateResultNewWriteCompleteness(result);
        expect(errs).toEqual([]);
      });
    }
  });
}

describe("1.0.0 pack files must remain byte-unchanged", () => {
  // Byte-size snapshot recorded when PR 3b closed. Any edit will change this.
  const expectedBytes: Record<string, number> = {
    midwife: 25520,
    "carpenter-joiner": 26565,
    photographer: 21885,
  };
  for (const [slug, bytes] of Object.entries(expectedBytes)) {
    it(`${slug}/1.0.0.json is byte-unchanged (${bytes} bytes)`, () => {
      const raw = readFileSync(resolve(__dir, `../../../content/career-packs/${slug}/1.0.0.json`));
      expect(raw.byteLength).toBe(bytes);
      const parsed = careerDecisionPackV1.safeParse(JSON.parse(raw.toString("utf-8")));
      expect(parsed.success).toBe(true);
    });
  }
});


describe("strict PUBLISH schema rejects an incomplete pack", () => {
  it("rejects a v1.1 pack missing careerIdentity.introduction", () => {
    const midwife = load("midwife");
    const broken = { ...midwife, careerIdentity: { ...midwife.careerIdentity, introduction: undefined } };
    const r = careerDecisionPackV1Publish.safeParse(broken);
    expect(r.success).toBe(false);
  });
  it("rejects a v1.1 pack missing questionModules", () => {
    const midwife = load("midwife");
    const broken = { ...midwife, questionModules: undefined };
    const r = careerDecisionPackV1Publish.safeParse(broken);
    expect(r.success).toBe(false);
  });
  it("rejects a v1.1 pack where a question option is not in allowedValues", () => {
    const midwife = load("midwife");
    const broken = JSON.parse(JSON.stringify(midwife));
    broken.questionRefs[0].options.push({ value: "not_in_allowed", label: "Bogus" });
    expect(validatePackPublishCompleteness(broken).length).toBeGreaterThan(0);
  });
});

describe("strict NEW-WRITE result schema rejects an incomplete result", () => {
  it("rejects a result missing resolvedEvidence", () => {
    const midwife = load("midwife");
    const r = evaluate(midwife, midwife.testProfiles[0].answers, { now: NOW, reviewContext: REVIEW_CONTEXT });
    const broken = { ...r, resolvedEvidence: undefined };
    expect(validateResultNewWriteCompleteness(broken).length).toBeGreaterThan(0);
  });
  it("rejects a result missing reviewContext", () => {
    const midwife = load("midwife");
    const r = evaluate(midwife, midwife.testProfiles[0].answers, { now: NOW }); // no reviewContext
    expect(validateResultNewWriteCompleteness(r).length).toBeGreaterThan(0);
  });
  it("rejects a resolved snapshot containing a forbidden admin key", () => {
    const midwife = load("midwife");
    const r = evaluate(midwife, midwife.testProfiles[0].answers, { now: NOW, reviewContext: REVIEW_CONTEXT });
    const broken = JSON.parse(JSON.stringify(r));
    broken.resolvedEvidence[0].ownerUserId = "leaky-uuid";
    expect(validateResultNewWriteCompleteness(broken).some((e) => e.includes("forbidden"))).toBe(true);
  });
});
