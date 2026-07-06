// Deno mirror parity test for the Plumber engine.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runPlumberEngine } from "./_plumber.ts";

const FIXTURE_PATH = new URL(
  "../../../shared/reality-check/plumber-cases.json",
  import.meta.url,
);

interface FixtureCase {
  name: string;
  signals: Parameters<typeof runPlumberEngine>[0]["signals"];
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
  Deno.test(`plumber deno mirror — ${c.name}`, () => {
    const out = runPlumberEngine({ signals: c.signals });
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
