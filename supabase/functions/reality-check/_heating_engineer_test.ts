// Deno mirror parity test for the Heating Engineer engine.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runHeatingEngineerEngine } from "./_heating_engineer.ts";

const FIXTURE_PATH = new URL(
  "../../../shared/reality-check/heating-engineer-cases.json",
  import.meta.url,
);

interface FixtureCase {
  name: string;
  signals: Parameters<typeof runHeatingEngineerEngine>[0]["signals"];
  expected: {
    status: string;
    recommendedRouteId: string | null;
    recommendedRouteMustNotBe?: string;
    considerationsCountAtLeast?: number;
    experiencedWorkerRouteEligible?: boolean;
  };
}

const fixtures: FixtureCase[] = JSON.parse(await Deno.readTextFile(FIXTURE_PATH));

for (const c of fixtures) {
  Deno.test(`heating-engineer deno mirror — ${c.name}`, () => {
    const out = runHeatingEngineerEngine({ signals: c.signals });
    assertEquals(out.status, c.expected.status);
    if (c.expected.recommendedRouteId !== undefined) {
      assertEquals(out.recommendedRouteId, c.expected.recommendedRouteId);
    }
    if (c.expected.recommendedRouteMustNotBe) {
      if (out.recommendedRouteId === c.expected.recommendedRouteMustNotBe) {
        throw new Error(
          `Route ${c.expected.recommendedRouteMustNotBe} was recommended but should not have been`,
        );
      }
    }
    if (c.expected.considerationsCountAtLeast !== undefined) {
      if (out.considerations.length < c.expected.considerationsCountAtLeast) {
        throw new Error(
          `Expected ≥${c.expected.considerationsCountAtLeast} considerations, got ${out.considerations.length}`,
        );
      }
    }
    if (c.expected.experiencedWorkerRouteEligible !== undefined) {
      const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route");
      assertEquals(ewa?.eligible, c.expected.experiencedWorkerRouteEligible);
    }
  });
}

Deno.test("heating-engineer deno mirror — Gas Safe claimed + experience emits Gas Safe verification check", () => {
  const out = runHeatingEngineerEngine({
    signals: {
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
    },
  });
  const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route");
  assertEquals(ewa?.eligible, true);
  const hasCheck = (ewa?.blockersAndChecks ?? []).some((c) =>
    /Gas Safe/.test(c) && /verif/i.test(c),
  );
  assertEquals(hasCheck, true);
});

Deno.test("heating-engineer deno mirror — gas experience without qualification is not experienced-worker eligible", () => {
  const out = runHeatingEngineerEngine({
    signals: {
      startingPoint: "career_changer",
      hasHeatingExperience: false,
      hasGasExperience: true,
      hasPlumbingExperience: false,
      hasBuildingServicesExperience: false,
      hasElectricalControlsExperience: false,
      hasRelatedTradeExperience: false,
      heatingQualificationLevel: "none",
      mathsEnglishStatus: "both",
      availableTrainingPatterns: ["full_time_work_based"],
      trainingBudgetBand: "over_2000",
      travelRange: "wider_area",
      workingConditionsToCheck: [],
      routePriorities: [],
    },
  });
  const ewa = out.routeEvaluations.find((r) => r.id === "experienced_worker_route");
  assertEquals(ewa?.eligible, false);
});
