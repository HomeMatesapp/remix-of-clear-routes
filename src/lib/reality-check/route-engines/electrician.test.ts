// Electrician engine + parity + adapter tests. Fixtures load from the shared
// JSON at /shared/reality-check/electrician-cases.json — the same physical
// file the Deno mirror test loads.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runElectricianEngine,
  type ElectricianRouteId,
} from "./electrician";
import { buildElectricianResult } from "./electrician-adapter";
import type { ElectricianSignals } from "../questionnaire/signals";
import type { RealityCheckAnswers } from "../types";

interface FixtureCase {
  name: string;
  signals: ElectricianSignals;
  expected: {
    status: string;
    recommendedRouteId: ElectricianRouteId | null;
    recommendedRouteMustNotBe?: ElectricianRouteId;
    considerationsCountAtLeast?: number;
  };
}

const FIXTURES: FixtureCase[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../shared/reality-check/electrician-cases.json"), "utf-8"),
);

describe("Electrician engine — shared fixtures", () => {
  for (const c of FIXTURES) {
    it(c.name, () => {
      const out = runElectricianEngine({ signals: c.signals });
      expect(out.status).toBe(c.expected.status);
      if (c.expected.recommendedRouteId !== undefined) {
        expect(out.recommendedRouteId).toBe(c.expected.recommendedRouteId);
      }
      if (c.expected.recommendedRouteMustNotBe) {
        expect(out.recommendedRouteId).not.toBe(c.expected.recommendedRouteMustNotBe);
      }
      if (c.expected.considerationsCountAtLeast !== undefined) {
        expect(out.considerations.length).toBeGreaterThanOrEqual(c.expected.considerationsCountAtLeast);
      }
    });
  }
});

describe("Electrician engine — invariants", () => {
  it("budget never changes readiness or eligibility (paired case)", () => {
    const low = FIXTURES.find((c) => c.name === "budget_low_versus_high_identical_readiness")!;
    const high = FIXTURES.find((c) => c.name === "budget_high_variant")!;
    const a = runElectricianEngine({ signals: low.signals });
    const b = runElectricianEngine({ signals: high.signals });
    expect(a.status).toBe(b.status);
    expect(a.routeEvaluations.map((r) => `${r.id}:${r.eligible}`)).toEqual(
      b.routeEvaluations.map((r) => `${r.id}:${r.eligible}`),
    );
    // Feasibility notes are allowed to differ.
    // Best/backup may swap; assert at least the eligible set is identical.
    const aEligible = a.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    const bEligible = b.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(aEligible).toEqual(bEligible);
  });

  it("working conditions produce considerations but do not reject", () => {
    const c = FIXTURES.find((x) => x.name === "working_conditions_concerns_do_not_reject")!;
    const out = runElectricianEngine({ signals: c.signals });
    expect(out.status).toBe("route_recommended");
    expect(out.considerations.length).toBeGreaterThan(0);
  });

  it("priorities cannot promote an ineligible route", () => {
    const c = FIXTURES.find((x) => x.name === "priorities_cannot_promote_ineligible_route")!;
    const out = runElectricianEngine({ signals: c.signals });
    expect(out.recommendedRouteId).not.toBe("experienced_worker_route");
    const experienced = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(experienced.eligible).toBe(false);
  });

  it("all eligible routes remain in comparison even if unaffordable", () => {
    // A career changer with only weekday_evenings and free_only budget.
    const c = FIXTURES.find((x) => x.name === "budget_low_versus_high_identical_readiness")!;
    const out = runElectricianEngine({ signals: c.signals });
    const college = out.routeEvaluations.find((r) => r.id === "college_then_workplace_experience")!;
    expect(college.eligible).toBe(true);
    expect(college.affordability.affordable).toBe(false);
    // Still present as an evaluated route.
    expect(out.routeEvaluations.map((r) => r.id)).toContain("college_then_workplace_experience");
  });

  it("insufficient_information is limited to critical signals", () => {
    const signals: ElectricianSignals = {
      startingPoint: "career_changer",
      hasElectricalExperience: false,
      hasRelatedTradeExperience: false,
      electricalQualificationLevel: "none",
      mathsEnglishStatus: "both",
      availableTrainingPatterns: ["full_time_work_based"],
      // Non-critical signals missing:
      trainingBudgetBand: null,
      travelRange: null,
      workingConditionsToCheck: [],
      routePriorities: [],
    };
    const out = runElectricianEngine({ signals });
    expect(out.status).toBe("route_recommended");
  });

  it("outcome precedence: verification wins over insufficient info", () => {
    const signals: ElectricianSignals = {
      startingPoint: null,
      hasElectricalExperience: false,
      hasRelatedTradeExperience: false,
      electricalQualificationLevel: "international",
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
      trainingBudgetBand: null,
      travelRange: null,
      workingConditionsToCheck: [],
      routePriorities: [],
    };
    const out = runElectricianEngine({ signals });
    expect(out.status).toBe("qualification_verification_required");
  });
});

describe("Adapter to RealityCheckResult", () => {
  const emptyAnswers = {} as RealityCheckAnswers;
  it("route_recommended maps to a real route title", () => {
    const c = FIXTURES.find((x) => x.name === "beginner_school_weekday")!;
    const r = buildElectricianResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/apprenticeship/i);
    expect(r.readiness).toBe("ready_now");
  });

  it("qualification_verification_required never presents a training route", () => {
    const c = FIXTURES.find((x) => x.name === "older_uk_qualification_verification")!;
    const r = buildElectricianResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/verification/i);
    expect(r.readiness).toBe("needs_bridging");
  });

  it("insufficient_information asks for missing answers", () => {
    const signals: ElectricianSignals = {
      startingPoint: null,
      hasElectricalExperience: false,
      hasRelatedTradeExperience: false,
      electricalQualificationLevel: "none",
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
      trainingBudgetBand: null,
      travelRange: null,
      workingConditionsToCheck: [],
      routePriorities: [],
    };
    const r = buildElectricianResult({ signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/more answers/i);
  });

  it("considerations round-trip into the result", () => {
    const c = FIXTURES.find((x) => x.name === "working_conditions_concerns_do_not_reject")!;
    const r = buildElectricianResult({ signals: c.signals }, emptyAnswers);
    expect(r.considerations && r.considerations.length).toBeGreaterThan(0);
  });
});
