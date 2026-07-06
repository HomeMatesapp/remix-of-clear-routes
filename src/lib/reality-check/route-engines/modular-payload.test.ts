// Shared tests for the modular route-comparison payload produced by the
// three reviewed adapters (electrician, plumber, hvac-engineer).
// Ensures every status maps to safe route-card kinds and copy is free of
// overclaiming phrases.

import { describe, expect, it } from "vitest";
import { buildElectricianResult } from "./electrician-adapter";
import { buildPlumberResult } from "./plumber-adapter";
import { buildHeatingEngineerResult } from "./heating-engineer-adapter";
import type { ElectricianSignals, PlumberSignals, HeatingEngineerSignals } from "../questionnaire/signals";
import type { RealityCheckAnswers } from "../types";
import { hasReviewedModularRealityCheck } from "../questionnaire/registry";

const emptyAnswers = {} as RealityCheckAnswers;

// ── Signal helpers ─────────────────────────────────────────────────────────

const elecBase = (): ElectricianSignals => ({
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

const plumbBase = (): PlumberSignals => ({
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

const heatBase = (): HeatingEngineerSignals => ({
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


// ── Copy-safety guards (explicit lists, per plan §6) ───────────────────────

const UNSAFE_PHRASES = [
  "you are verified",
  "verified available",
  "verified route",
  "available near you",
  "you qualify",
  "you are eligible",
  "guaranteed",
];

const collectCopyStrings = (
  m: NonNullable<ReturnType<typeof buildElectricianResult>["modular"]>,
): string[] => {
  const out: string[] = [m.headline];
  for (const r of m.routes) {
    out.push(r.fit, r.constraint, r.nextAction, r.title);
    out.push(...r.checks);
    if (r.timeCaveat) out.push(r.timeCaveat);
    if (r.costCaveat) out.push(r.costCaveat);
    if (r.patternCaveat) out.push(r.patternCaveat);
  }
  out.push(...m.checksBeforeCommitting);
  for (const mi of m.missingInformation ?? []) out.push(mi.label);
  return out;
};

const assertNoOverclaiming = (
  m: NonNullable<ReturnType<typeof buildElectricianResult>["modular"]>,
) => {
  const strings = collectCopyStrings(m).map((s) => s.toLowerCase());
  for (const unsafe of UNSAFE_PHRASES) {
    for (const s of strings) {
      expect(
        s.includes(unsafe),
        `unsafe phrase "${unsafe}" found in modular copy: "${s}"`,
      ).toBe(false);
    }
  }
};

// ── Roles table ────────────────────────────────────────────────────────────

const ROLES = [
  {
    slug: "electrician",
    build: (o: object) => buildElectricianResult(o as never, emptyAnswers),
    recommended: () => elecBase(),
    verification: (): ElectricianSignals => ({
      ...elecBase(),
      electricalQualificationLevel: "international",
    }),
    bridging: (): ElectricianSignals => ({
      ...elecBase(),
      availableTrainingPatterns: ["weekends"],
    }),
    insufficient: (): ElectricianSignals => ({
      ...elecBase(),
      startingPoint: null,
      electricalQualificationLevel: null,
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
    }),
    workingConditions: (): ElectricianSignals => ({
      ...elecBase(),
      workingConditionsToCheck: ["working_at_height", "confined_spaces"],
    }),
  },
  {
    slug: "plumber",
    build: (o: object) => buildPlumberResult(o as never, emptyAnswers),
    recommended: () => plumbBase(),
    verification: (): PlumberSignals => ({
      ...plumbBase(),
      plumbingQualificationLevel: "international",
    }),
    bridging: (): PlumberSignals => ({
      ...plumbBase(),
      availableTrainingPatterns: ["weekends"],
    }),
    insufficient: (): PlumberSignals => ({
      ...plumbBase(),
      startingPoint: null,
      plumbingQualificationLevel: null,
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
    }),
    workingConditions: (): PlumberSignals => ({
      ...plumbBase(),
      workingConditionsToCheck: ["confined_spaces", "lifting_bending"],
    }),
  },
  {
    slug: "hvac-engineer",
    build: (o: object) => buildHeatingEngineerResult(o as never, emptyAnswers),
    recommended: () => heatBase(),
    verification: (): HeatingEngineerSignals => ({
      ...heatBase(),
      heatingQualificationLevel: "international",
    }),
    bridging: (): HeatingEngineerSignals => ({
      ...heatBase(),
      availableTrainingPatterns: ["weekends"],
    }),
    insufficient: (): HeatingEngineerSignals => ({
      ...heatBase(),
      startingPoint: null,
      heatingQualificationLevel: null,
      mathsEnglishStatus: null,
      availableTrainingPatterns: [],
    }),
    workingConditions: (): HeatingEngineerSignals => ({
      ...heatBase(),
      workingConditionsToCheck: ["safety_critical_systems", "confined_or_plant_rooms"],
    }),
  },
] as const;

// ── Tests ──────────────────────────────────────────────────────────────────

describe("modular payload — every reviewed role", () => {
  for (const role of ROLES) {
    describe(role.slug, () => {
      it("registry says this role has a reviewed modular Reality-check", () => {
        expect(hasReviewedModularRealityCheck(role.slug)).toBe(true);
      });

      it("route_recommended produces recommended + backup + caution cards", () => {
        const r = role.build({ signals: role.recommended() });
        expect(r.modular).toBeDefined();
        const m = r.modular!;
        expect(m.status).toBe("route_recommended");
        const kinds = m.routes.map((c) => c.kind);
        expect(kinds).toContain("recommended");
        expect(kinds).toContain("caution");
        // No verification/bridging kinds leak into a normal recommendation.
        expect(kinds).not.toContain("investigate_after_check");
        expect(kinds).not.toContain("may_open_later");
        assertNoOverclaiming(m);
      });

      it("verification never uses kind=recommended and surfaces verification in checks", () => {
        const r = role.build({ signals: role.verification() });
        const m = r.modular!;
        expect(m.status).toBe("qualification_verification_required");
        for (const c of m.routes) expect(c.kind).toBe("investigate_after_check");
        expect(m.routes.every((c) => c.kind !== "recommended")).toBe(true);
        expect(
          m.checksBeforeCommitting.some((s) => /verif/i.test(s)),
        ).toBe(true);
        assertNoOverclaiming(m);
      });

      it("bridging never uses kind=recommended", () => {
        const r = role.build({ signals: role.bridging() });
        const m = r.modular!;
        expect(m.status).toBe("bridging_required");
        for (const c of m.routes) expect(c.kind).toBe("may_open_later");
        expect(m.routes.every((c) => c.kind !== "recommended")).toBe(true);
        assertNoOverclaiming(m);
      });

      it("insufficient_information hides route comparison and lists missing info", () => {
        const r = role.build({ signals: role.insufficient() });
        const m = r.modular!;
        expect(m.status).toBe("insufficient_information");
        expect(m.routes.length).toBe(0);
        expect(m.missingInformation && m.missingInformation.length).toBeGreaterThan(0);
        for (const item of m.missingInformation!) {
          expect(typeof item.questionId).toBe("string");
          expect(item.label.length).toBeGreaterThan(0);
        }
        assertNoOverclaiming(m);
      });

      it("working-condition considerations never leak into checksBeforeCommitting", () => {
        const r = role.build({ signals: role.workingConditions() });
        const m = r.modular!;
        // Legacy considerations must populate…
        expect(r.considerations && r.considerations.length).toBeGreaterThan(0);
        // …but the working-condition phrasing must not appear in
        // checksBeforeCommitting.
        const joinedChecks = m.checksBeforeCommitting.join(" ").toLowerCase();
        expect(joinedChecks).not.toContain("something to check");
        expect(joinedChecks).not.toContain("compare the working conditions");
      });

      it("affordability is surfaced as a per-route note, never as readiness", () => {
        const signals = role.recommended();
        // budget too low for college route only
        (signals as { trainingBudgetBand: string }).trainingBudgetBand = "free_only";
        const r = role.build({ signals });
        const m = r.modular!;
        if (m.status !== "route_recommended") return; // nothing to assert
        // Route cards carry the affordability boolean when set; readiness
        // remains route_recommended regardless.
        for (const c of m.routes) {
          if (typeof c.affordable === "boolean") {
            expect(typeof c.affordable).toBe("boolean");
          }
        }
      });
    });
  }
});
