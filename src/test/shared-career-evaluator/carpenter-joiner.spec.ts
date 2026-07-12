import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname_local = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(resolve(__dirname_local, "../../../content/career-packs/carpenter-joiner/1.0.0.json"), "utf-8"));
import { careerDecisionPackV1, validatePackCrossRefs } from "@shared/career-evaluator/v1/schema";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import { FORBIDDEN_LANGUAGE } from "@shared/career-evaluator/v1/phrases";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const NOW = "2026-07-12T00:00:00.000Z";

describe("carpenter-joiner pack — schema and cross-refs", () => {
  it("parses against CareerDecisionPackV1", () => {
    const parsed = careerDecisionPackV1.safeParse(pack);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  });
  it("has no cross-reference errors", () => {
    expect(validatePackCrossRefs(pack)).toEqual([]);
  });
  it("ships at least 12 test profiles", () => {
    expect((pack as CareerDecisionPackV1).testProfiles.length).toBeGreaterThanOrEqual(12);
  });
  it("declares not_formally_regulated (job title is not protected)", () => {
    expect((pack as CareerDecisionPackV1).careerIdentity.regulatory.status).toBe("not_formally_regulated");
  });
});

const typed = pack as CareerDecisionPackV1;

describe("carpenter-joiner pack — every profile passes its expectations", () => {
  for (const profile of typed.testProfiles) {
    it(profile.label, () => {
      const result = evaluate(typed, profile.answers, { now: NOW });
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
    });
  }
});

describe("carpenter-joiner pack — practical-fit vs formal eligibility", () => {
  it("does not treat CSCS as statutory eligibility", () => {
    const r = evaluate(typed, typed.testProfiles[0].answers, { now: NOW });
    // CSCS should appear as a consideration, not as a route blocker.
    const consids = r.considerations.join(" ").toLowerCase();
    expect(consids).toContain("cscs");
    expect(consids).toContain("industry scheme");
  });
});
