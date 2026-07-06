// Plumber engine + parity + adapter tests. Fixtures load from the shared
// JSON at /shared/reality-check/plumber-cases.json — the same physical
// file the Deno mirror test loads.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runPlumberEngine,
  type PlumberRouteId,
} from "./plumber";
import { buildPlumberResult } from "./plumber-adapter";
import type { PlumberSignals } from "../questionnaire/signals";
import type { RealityCheckAnswers } from "../types";

interface FixtureCase {
  name: string;
  signals: PlumberSignals;
  expected: {
    status: string;
    recommendedRouteId: PlumberRouteId | null;
    recommendedRouteMustNotBe?: PlumberRouteId;
    considerationsCountAtLeast?: number;
    experiencedWorkerRouteEligible?: boolean;
  };
}

const FIXTURES: FixtureCase[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../shared/reality-check/plumber-cases.json"), "utf-8"),
);

describe("Plumber engine — shared fixtures", () => {
  for (const c of FIXTURES) {
    it(c.name, () => {
      const out = runPlumberEngine({ signals: c.signals });
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
      if (c.expected.experiencedWorkerRouteEligible !== undefined) {
        const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route");
        expect(ewa?.eligible).toBe(c.expected.experiencedWorkerRouteEligible);
      }
    });
  }
});

describe("Plumber engine — invariants", () => {
  it("budget never changes readiness or eligibility (paired case)", () => {
    const low = FIXTURES.find((c) => c.name === "budget_low_versus_high_identical_readiness")!;
    const high = FIXTURES.find((c) => c.name === "budget_high_variant")!;
    const a = runPlumberEngine({ signals: low.signals });
    const b = runPlumberEngine({ signals: high.signals });
    expect(a.status).toBe(b.status);
    const aEligible = a.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    const bEligible = b.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(aEligible).toEqual(bEligible);
  });

  it("working conditions produce considerations but do not reject", () => {
    const c = FIXTURES.find((x) => x.name === "working_conditions_concerns_do_not_reject")!;
    const out = runPlumberEngine({ signals: c.signals });
    expect(out.status).toBe("route_recommended");
    expect(out.considerations.length).toBeGreaterThan(0);
  });

  it("priorities cannot promote an ineligible route", () => {
    const c = FIXTURES.find((x) => x.name === "priorities_cannot_promote_ineligible_route")!;
    const out = runPlumberEngine({ signals: c.signals });
    expect(out.recommendedRouteId).not.toBe("experienced_worker_route");
    const experienced = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(experienced.eligible).toBe(false);
  });

  it("gas_heating qualification + plumbing experience unlocks experienced worker route", () => {
    const c = FIXTURES.find((x) => x.name === "gas_heating_holder_experienced_worker")!;
    const out = runPlumberEngine({ signals: c.signals });
    const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(ewa.eligible).toBe(true);
  });

  it("outcome precedence: verification wins over insufficient info", () => {
    const signals: PlumberSignals = {
      startingPoint: null,
      hasPlumbingExperience: false,
      hasRelatedTradeExperience: false,
      plumbingQualificationLevel: "international",
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
      trainingBudgetBand: null,
      travelRange: null,
      workingConditionsToCheck: [],
      routePriorities: [],
    };
    const out = runPlumberEngine({ signals });
    expect(out.status).toBe("qualification_verification_required");
  });
});

describe("Plumber adapter to RealityCheckResult", () => {
  const emptyAnswers = {} as RealityCheckAnswers;
  it("route_recommended maps to a plumbing route title", () => {
    const c = FIXTURES.find((x) => x.name === "beginner_school_weekday")!;
    const r = buildPlumberResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/plumbing/i);
    expect(r.readiness).toBe("ready_now");
  });

  it("qualification_verification_required never presents a training route", () => {
    const c = FIXTURES.find((x) => x.name === "older_uk_plumbing_qualification_verification")!;
    const r = buildPlumberResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/verification/i);
    expect(r.readiness).toBe("needs_bridging");
  });

  it("considerations round-trip into the result", () => {
    const c = FIXTURES.find((x) => x.name === "working_conditions_concerns_do_not_reject")!;
    const r = buildPlumberResult({ signals: c.signals }, emptyAnswers);
    expect(r.considerations && r.considerations.length).toBeGreaterThan(0);
  });
});
