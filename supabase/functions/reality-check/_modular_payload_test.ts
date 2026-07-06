// Deno mirror test — verifies the modular payload builder produces the
// expected route-card kinds for each engine status. Loose parity with the
// Vitest suite at src/lib/reality-check/route-engines/modular-payload.test.ts.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildElectricianResult } from "./_electrician.ts";
import { buildPlumberResult } from "./_plumber.ts";
import { buildHeatingEngineerResult } from "./_heating_engineer.ts";

const elecBase = () => ({
  startingPoint: "still_at_school",
  hasElectricalExperience: false,
  hasRelatedTradeExperience: false,
  electricalQualificationLevel: "none",
  mathsEnglishStatus: "both",
  availableTrainingPatterns: ["full_time_work_based"],
  trainingBudgetBand: "up_to_500",
  travelRange: "up_to_60",
  workingConditionsToCheck: [],
  routePriorities: [],
});

const plumbBase = () => ({
  startingPoint: "still_at_school",
  hasPlumbingExperience: false,
  hasRelatedTradeExperience: false,
  plumbingQualificationLevel: "none",
  mathsEnglishStatus: "both",
  availableTrainingPatterns: ["full_time_work_based"],
  trainingBudgetBand: "up_to_500",
  travelRange: "up_to_60",
  workingConditionsToCheck: [],
  routePriorities: [],
});

const heatBase = () => ({
  startingPoint: "still_at_school",
  hasHeatingExperience: false,
  hasGasExperience: false,
  hasPlumbingExperience: false,
  hasBuildingServicesExperience: false,
  hasElectricalControlsExperience: false,
  hasRelatedTradeExperience: false,
  heatingQualificationLevel: "none",
  mathsEnglishStatus: "both",
  availableTrainingPatterns: ["full_time_work_based"],
  trainingBudgetBand: "up_to_500",
  travelRange: "up_to_60",
  workingConditionsToCheck: [],
  routePriorities: [],
});

// deno-lint-ignore no-explicit-any
const build = (kind: string, base: any) => {
  if (kind === "electrician") return buildElectricianResult({ signals: base } as never);
  if (kind === "plumber") return buildPlumberResult({ signals: base } as never);
  return buildHeatingEngineerResult({ signals: base } as never);
};

const roles = [
  { name: "electrician", base: elecBase, qualKey: "electricalQualificationLevel" },
  { name: "plumber", base: plumbBase, qualKey: "plumbingQualificationLevel" },
  { name: "hvac-engineer", base: heatBase, qualKey: "heatingQualificationLevel" },
] as const;

for (const r of roles) {
  Deno.test(`${r.name} deno: recommended → recommended/backup/caution kinds`, () => {
    const out = build(r.name, r.base());
    // deno-lint-ignore no-explicit-any
    const m = (out as any).modular;
    assert(m, "modular payload present");
    assertEquals(m.status, "route_recommended");
    const kinds = m.routes.map((c: { kind: string }) => c.kind);
    assert(kinds.includes("recommended"));
    assert(kinds.includes("caution"));
    assert(!kinds.includes("investigate_after_check"));
    assert(!kinds.includes("may_open_later"));
  });

  Deno.test(`${r.name} deno: verification → only investigate_after_check`, () => {
    const s = { ...r.base(), [r.qualKey]: "international" };
    const out = build(r.name, s);
    // deno-lint-ignore no-explicit-any
    const m = (out as any).modular;
    assertEquals(m.status, "qualification_verification_required");
    for (const c of m.routes) {
      assertEquals(c.kind, "investigate_after_check");
    }
  });

  Deno.test(`${r.name} deno: bridging → only may_open_later`, () => {
    const s = { ...r.base(), availableTrainingPatterns: ["weekends"] };
    const out = build(r.name, s);
    // deno-lint-ignore no-explicit-any
    const m = (out as any).modular;
    assertEquals(m.status, "bridging_required");
    for (const c of m.routes) {
      assertEquals(c.kind, "may_open_later");
    }
  });

  Deno.test(`${r.name} deno: insufficient info → no route cards, missing info present`, () => {
    const s = {
      ...r.base(),
      startingPoint: null,
      [r.qualKey]: null,
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
    };
    const out = build(r.name, s);
    // deno-lint-ignore no-explicit-any
    const m = (out as any).modular;
    assertEquals(m.status, "insufficient_information");
    assertEquals(m.routes.length, 0);
    assert(m.missingInformation && m.missingInformation.length > 0);
  });
}
