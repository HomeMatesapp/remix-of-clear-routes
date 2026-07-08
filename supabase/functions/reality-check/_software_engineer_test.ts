// Deno parity test for the Software Engineer engine.
// Loads shared/reality-check/software-engineer-cases.json.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runSoftwareEngineerEngine } from "./_software_engineer.ts";

const FIXTURE_PATH = new URL(
  "../../../shared/reality-check/software-engineer-cases.json",
  import.meta.url,
);

interface FixtureCase {
  name: string;
  signals: Parameters<typeof runSoftwareEngineerEngine>[0]["signals"];
  expected: {
    status: string;
    recommendedRouteId?: string | null;
    recommendedRouteMustNotBe?: string;
    recommendedRouteMustBeOneOf?: string[];
    bootcampMustBeEligible?: boolean;
  };
}

const fixtures: FixtureCase[] = JSON.parse(await Deno.readTextFile(FIXTURE_PATH));

for (const c of fixtures) {
  Deno.test(`software-engineer deno mirror — ${c.name}`, () => {
    const out = runSoftwareEngineerEngine({ signals: c.signals });
    assertEquals(out.status, c.expected.status);
    if (c.expected.recommendedRouteId !== undefined) {
      assertEquals(out.recommendedRouteId, c.expected.recommendedRouteId);
    }
    if (c.expected.recommendedRouteMustNotBe) {
      if (out.recommendedRouteId === c.expected.recommendedRouteMustNotBe) {
        throw new Error(`Route ${c.expected.recommendedRouteMustNotBe} was recommended but should not have been`);
      }
    }
    if (c.expected.recommendedRouteMustBeOneOf) {
      if (!c.expected.recommendedRouteMustBeOneOf.includes(out.recommendedRouteId ?? "")) {
        throw new Error(`Expected route in ${JSON.stringify(c.expected.recommendedRouteMustBeOneOf)}, got ${out.recommendedRouteId}`);
      }
    }
    if (c.expected.bootcampMustBeEligible) {
      const bc = out.routeEvaluations.find((r) => r.id === "bootcamp_intensive");
      if (!bc || !bc.eligible) {
        throw new Error("bootcamp_intensive was expected to be eligible but was not");
      }
    }
    // Invariant: no route id equals 'bridging_beginner'.
    for (const r of out.routeEvaluations) {
      if ((r.id as string) === "bridging_beginner") {
        throw new Error("bridging_beginner must never appear as a route id");
      }
    }
  });
}
