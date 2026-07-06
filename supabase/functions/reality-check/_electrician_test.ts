// Deno mirror parity test — loads the same shared JSON fixture the Vitest
// test uses and asserts identical outputs.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runElectricianEngine } from "./_electrician.ts";

const FIXTURE_PATH = new URL(
  "../../../shared/reality-check/electrician-cases.json",
  import.meta.url,
);

interface FixtureCase {
  name: string;
  signals: Parameters<typeof runElectricianEngine>[0]["signals"];
  expected: {
    status: string;
    recommendedRouteId: string | null;
    recommendedRouteMustNotBe?: string;
    considerationsCountAtLeast?: number;
  };
}

const fixtures: FixtureCase[] = JSON.parse(await Deno.readTextFile(FIXTURE_PATH));

for (const c of fixtures) {
  Deno.test(`electrician deno mirror — ${c.name}`, () => {
    const out = runElectricianEngine({ signals: c.signals });
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
  });
}
