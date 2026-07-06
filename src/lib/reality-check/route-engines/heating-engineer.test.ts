// Heating Engineer engine + parity + adapter tests. Fixtures load from the
// shared JSON at /shared/reality-check/heating-engineer-cases.json — the
// same physical file the Deno mirror test loads.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runHeatingEngineerEngine,
  type HeatingEngineerRouteId,
} from "./heating-engineer";
import { buildHeatingEngineerResult } from "./heating-engineer-adapter";
import type { HeatingEngineerSignals } from "../questionnaire/signals";
import type { RealityCheckAnswers } from "../types";

interface FixtureCase {
  name: string;
  signals: HeatingEngineerSignals;
  expected: {
    status: string;
    recommendedRouteId: HeatingEngineerRouteId | null;
    recommendedRouteMustNotBe?: HeatingEngineerRouteId;
    considerationsCountAtLeast?: number;
    experiencedWorkerRouteEligible?: boolean;
  };
}

const FIXTURES: FixtureCase[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../../shared/reality-check/heating-engineer-cases.json"),
    "utf-8",
  ),
);

describe("Heating Engineer engine — shared fixtures", () => {
  for (const c of FIXTURES) {
    it(c.name, () => {
      const out = runHeatingEngineerEngine({ signals: c.signals });
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

describe("Heating Engineer engine — invariants", () => {
  it("budget never changes readiness or eligibility (paired case)", () => {
    const low = FIXTURES.find((c) => c.name === "budget_low_versus_high_identical_readiness")!;
    const high = FIXTURES.find((c) => c.name === "budget_high_variant")!;
    const a = runHeatingEngineerEngine({ signals: low.signals });
    const b = runHeatingEngineerEngine({ signals: high.signals });
    expect(a.status).toBe(b.status);
    const aEligible = a.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    const bEligible = b.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(aEligible).toEqual(bEligible);
  });

  it("working conditions produce considerations but do not reject", () => {
    const c = FIXTURES.find((x) => x.name === "working_conditions_concerns_do_not_reject")!;
    const out = runHeatingEngineerEngine({ signals: c.signals });
    expect(out.status).toBe("route_recommended");
    expect(out.considerations.length).toBeGreaterThan(0);
  });

  it("priorities cannot promote an ineligible route", () => {
    const c = FIXTURES.find((x) => x.name === "priorities_cannot_promote_ineligible_route")!;
    const out = runHeatingEngineerEngine({ signals: c.signals });
    expect(out.recommendedRouteId).not.toBe("experienced_worker_route");
    const experienced = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(experienced.eligible).toBe(false);
  });

  it("outcome precedence: verification wins over insufficient info", () => {
    const signals: HeatingEngineerSignals = {
      startingPoint: null,
      hasHeatingExperience: false,
      hasGasExperience: false,
      hasPlumbingExperience: false,
      hasBuildingServicesExperience: false,
      hasElectricalControlsExperience: false,
      hasRelatedTradeExperience: false,
      heatingQualificationLevel: "international",
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
      trainingBudgetBand: null,
      travelRange: null,
      workingConditionsToCheck: [],
      routePriorities: [],
    };
    const out = runHeatingEngineerEngine({ signals });
    expect(out.status).toBe("qualification_verification_required");
  });
});

describe("Heating Engineer engine — gas / Gas Safe rule", () => {
  const base: HeatingEngineerSignals = {
    startingPoint: "career_changer",
    hasHeatingExperience: true,
    hasGasExperience: true,
    hasPlumbingExperience: false,
    hasBuildingServicesExperience: false,
    hasElectricalControlsExperience: false,
    hasRelatedTradeExperience: false,
    heatingQualificationLevel: "gas_or_gas_safe_claimed",
    mathsEnglishStatus: "both",
    availableTrainingPatterns: ["full_time_work_based"],
    trainingBudgetBand: "over_2000",
    travelRange: "wider_area",
    workingConditionsToCheck: [],
    routePriorities: [],
  };

  it("gas/Gas Safe claimed + relevant experience: eligible AND emits Gas Safe verification check", () => {
    const out = runHeatingEngineerEngine({ signals: base });
    const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(ewa.eligible).toBe(true);
    expect(
      ewa.blockersAndChecks.some((c) => /Gas Safe.*verif|verif.*Gas Safe/i.test(c)),
    ).toBe(true);
  });

  it("gas/Gas Safe claimed without any relevant heating/gas/plumbing/building-services experience: not eligible", () => {
    const out = runHeatingEngineerEngine({
      signals: {
        ...base,
        hasHeatingExperience: false,
        hasGasExperience: false,
        hasPlumbingExperience: false,
        hasBuildingServicesExperience: false,
      },
    });
    const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(ewa.eligible).toBe(false);
  });

  it("gas-related experience alone (no qualification) never unlocks experienced-worker route", () => {
    const out = runHeatingEngineerEngine({
      signals: { ...base, heatingQualificationLevel: "none" },
    });
    const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(ewa.eligible).toBe(false);
  });

  it("heat-pump / low-carbon qualification does NOT imply gas authorisation in copy", () => {
    const out = runHeatingEngineerEngine({
      signals: {
        ...base,
        heatingQualificationLevel: "heat_pump_or_low_carbon",
        hasGasExperience: false,
      },
    });
    const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route")!;
    expect(ewa.eligible).toBe(true);
    expect(
      ewa.blockersAndChecks.some((c) => /does not imply gas authorisation|Gas Safe registration/i.test(c)),
    ).toBe(true);
  });

  it("free-text qualification names must not affect eligibility", () => {
    // The engine input has no free-text field; two identical signal objects
    // must produce identical eligibility regardless of any user-typed name.
    const a = runHeatingEngineerEngine({ signals: base });
    const b = runHeatingEngineerEngine({ signals: { ...base } });
    expect(a.recommendedRouteId).toBe(b.recommendedRouteId);
  });
});

describe("Heating Engineer adapter to RealityCheckResult", () => {
  const emptyAnswers = {} as RealityCheckAnswers;

  it("route_recommended maps to a heating-flavoured route title", () => {
    const c = FIXTURES.find((x) => x.name === "beginner_school_weekday")!;
    const r = buildHeatingEngineerResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/heating|building-services/i);
    expect(r.readiness).toBe("ready_now");
  });

  it("qualification_verification_required never presents a training route", () => {
    const c = FIXTURES.find((x) => x.name === "older_qualification_verification_required")!;
    const r = buildHeatingEngineerResult({ signals: c.signals }, emptyAnswers);
    expect(r.bestRoute.title).toMatch(/verification/i);
    expect(r.readiness).toBe("needs_bridging");
  });

  it("Gas Safe claimed route is never presented as verified in adapter output", () => {
    const c = FIXTURES.find(
      (x) => x.name === "gas_safe_claimed_with_experience_structurally_relevant_with_verification",
    )!;
    const r = buildHeatingEngineerResult({ signals: c.signals }, emptyAnswers);
    // No "verified", "you are Gas Safe registered", "guaranteed", "available near you"
    const all = JSON.stringify(r).toLowerCase();
    expect(all).not.toMatch(/\byou are gas safe registered\b/);
    expect(all).not.toMatch(/\bguaranteed\b/);
    expect(all).not.toMatch(/\bavailable near you\b/);
  });
});
