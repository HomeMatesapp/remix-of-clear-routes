import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname_local = dirname(fileURLToPath(import.meta.url));
const midwife = JSON.parse(readFileSync(resolve(__dirname_local, "../../../content/career-packs/midwife/1.0.0.json"), "utf-8"));
import { careerDecisionPackV1, validatePackCrossRefs } from "@shared/career-evaluator/v1/schema";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import { FORBIDDEN_LANGUAGE } from "@shared/career-evaluator/v1/phrases";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const NOW = "2026-07-12T00:00:00.000Z";

describe("midwife pack — schema and cross-refs", () => {
  it("parses against the CareerDecisionPackV1 schema", () => {
    const parsed = careerDecisionPackV1.safeParse(midwife);
    if (!parsed.success) {
      // Surface all issues in the assertion message so failures are actionable.
      throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
  });

  it("has no cross-reference errors", () => {
    expect(validatePackCrossRefs(midwife)).toEqual([]);
  });

  it("ships at least 12 test profiles", () => {
    expect((midwife as unknown as CareerDecisionPackV1).testProfiles.length).toBeGreaterThanOrEqual(12);
  });
});

const pack = midwife as unknown as CareerDecisionPackV1;

describe("midwife pack — evaluator determinism", () => {
  it("is deterministic across two runs with the same inputs", () => {
    const p = pack.testProfiles[0];
    const a = evaluate(pack, p.answers, { now: NOW });
    const b = evaluate(pack, p.answers, { now: NOW });
    expect(a).toEqual(b);
  });

  it("copies England-only geographic scope into the result", () => {
    const r = evaluate(pack, pack.testProfiles[0].answers, { now: NOW });
    expect(r.geographicScope).toEqual(["England"]);
    expect(r.limitations.some((l) => l.includes("England only"))).toBe(true);
  });

  it("copies statutory_registration status into the result", () => {
    const r = evaluate(pack, pack.testProfiles[0].answers, { now: NOW });
    expect(r.regulatoryStatus).toBe("statutory_registration");
  });
});

describe("midwife pack — every test profile passes its expectations", () => {
  for (const profile of pack.testProfiles) {
    it(profile.label, () => {
      const result = evaluate(pack, profile.answers, { now: NOW });
      const rendered = JSON.stringify(result).toLowerCase();

      // Language safety — applies to every profile.
      for (const forbidden of FORBIDDEN_LANGUAGE) {
        expect(rendered.includes(forbidden.toLowerCase()), `forbidden phrase "${forbidden}" appeared in result`).toBe(false);
      }

      if (profile.expect.rankedRouteIds) {
        expect(result.routes.map((r) => r.routeId)).toEqual(profile.expect.rankedRouteIds);
      }
      if (profile.expect.blockedRouteIds) {
        const actuallyBlocked = result.routes
          .filter((r) => r.classification === "not_currently_available_to_you")
          .map((r) => r.routeId)
          .sort();
        expect(actuallyBlocked).toEqual([...profile.expect.blockedRouteIds].sort());
      }
      if (profile.expect.mustMention) {
        for (const phrase of profile.expect.mustMention) {
          expect(rendered.includes(phrase.toLowerCase()), `expected result to mention "${phrase}"`).toBe(true);
        }
      }
      if (profile.expect.mustNotMention) {
        for (const phrase of profile.expect.mustNotMention) {
          expect(rendered.includes(phrase.toLowerCase()), `result should not mention "${phrase}"`).toBe(false);
        }
      }
      if (profile.expect.requiredActionIds) {
        const ids = result.immediateActions.map((a) => a.actionTemplateId);
        for (const required of profile.expect.requiredActionIds) {
          expect(ids, `expected immediate action ${required}`).toContain(required);
        }
      }
    });
  }
});

describe("midwife pack — evidence coverage wording", () => {
  it("never renders a probability-style success claim", () => {
    for (const p of pack.testProfiles) {
      const r = evaluate(pack, p.answers, { now: NOW });
      expect(r.participantLanguage.confidencePhrase.toLowerCase()).not.toMatch(/probability|will succeed|success rate/);
      expect(r.participantLanguage.confidencePhrase).toMatch(/Evidence coverage/);
    }
  });
});
