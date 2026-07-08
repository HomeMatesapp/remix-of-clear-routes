// Deno parity test for the Police Officer engine.
// Loads shared/reality-check/police-officer-cases.json.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runPoliceOfficerEngine } from "./_police_officer.ts";

const FIXTURE_PATH = new URL(
  "../../../shared/reality-check/police-officer-cases.json",
  import.meta.url,
);

interface FixtureCase {
  name: string;
  signals: Parameters<typeof runPoliceOfficerEngine>[0]["signals"];
  expected: {
    status?: string;
    recommendedRouteId?: string | null;
    recommendedRouteMustNotBe?: string;
    verificationPrimaryRouteId?: string;
  };
}

const fixtures: FixtureCase[] = JSON.parse(
  await Deno.readTextFile(FIXTURE_PATH),
);

for (const c of fixtures) {
  Deno.test(`police-officer deno mirror — ${c.name}`, () => {
    const out = runPoliceOfficerEngine({ signals: c.signals });
    if (c.expected.status !== undefined) assertEquals(out.status, c.expected.status);
    if (c.expected.recommendedRouteId !== undefined) {
      assertEquals(out.recommendedRouteId, c.expected.recommendedRouteId);
    }
    if (c.expected.recommendedRouteMustNotBe) {
      if (out.recommendedRouteId === c.expected.recommendedRouteMustNotBe) {
        throw new Error(`Route ${c.expected.recommendedRouteMustNotBe} was recommended but should not have been`);
      }
    }
    if (c.expected.verificationPrimaryRouteId) {
      assertEquals(out.verificationPrimaryRouteId, c.expected.verificationPrimaryRouteId);
    }
  });
}
