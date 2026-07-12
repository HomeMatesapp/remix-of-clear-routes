import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname_local = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(resolve(__dirname_local, "../../../content/career-packs/photographer/1.0.0.json"), "utf-8"));
import { careerDecisionPackV1, validatePackCrossRefs } from "@shared/career-evaluator/v1/schema";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import { FORBIDDEN_LANGUAGE } from "@shared/career-evaluator/v1/phrases";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const NOW = "2026-07-12T00:00:00.000Z";

describe("photographer pack — schema and cross-refs", () => {
  it("parses against CareerDecisionPackV1", () => {
    const parsed = careerDecisionPackV1.safeParse(pack);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  });
  it("has no cross-reference errors", () => {
    expect(validatePackCrossRefs(pack)).toEqual([]);
  });
  it("ships at least 12 profiles", () => {
    expect((pack as CareerDecisionPackV1).testProfiles.length).toBeGreaterThanOrEqual(12);
  });
  it("declares not_formally_regulated", () => {
    expect((pack as CareerDecisionPackV1).careerIdentity.regulatory.status).toBe("not_formally_regulated");
  });
});

const typed = pack as CareerDecisionPackV1;

describe("photographer pack — profiles", () => {
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
      if (profile.expect.mustMention) for (const p of profile.expect.mustMention) expect(rendered.includes(p.toLowerCase()), `expected "${p}"`).toBe(true);
      if (profile.expect.mustNotMention) for (const p of profile.expect.mustNotMention) expect(rendered.includes(p.toLowerCase()), `should not mention "${p}"`).toBe(false);
      if (profile.expect.requiredActionIds) {
        const ids = result.immediateActions.map((a) => a.actionTemplateId);
        for (const req of profile.expect.requiredActionIds) expect(ids).toContain(req);
      }
    });
  }
});

describe("photographer pack — never converts practical fit into formal eligibility", () => {
  it("adds a consideration that no mandatory qualification exists", () => {
    const r = evaluate(typed, typed.testProfiles[0].answers, { now: NOW });
    expect(r.considerations.join(" ").toLowerCase()).toContain("no mandatory qualification");
  });
  it("does not block the formal-study route on cost alone", () => {
    // finance-constrained profile
    const finance = typed.testProfiles.find((p) => p.id === "formal_route_finance_constrained")!;
    const r = evaluate(typed, finance.answers, { now: NOW });
    const study = r.routes.find((x) => x.routeId === "formal_study_plus_portfolio")!;
    expect(study.classification).not.toBe("not_currently_available_to_you");
  });
});
