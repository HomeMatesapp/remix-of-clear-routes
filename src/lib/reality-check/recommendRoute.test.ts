import { describe, it, expect } from "vitest";
import { preferredPathway, pressureSignals, summariseAnswers } from "./recommendRoute";
import type { RealityCheckAnswers } from "./types";

const base: RealityCheckAnswers = {
  startingPoint: null,
  incomeNeed: null,
  weeklyHours: null,
  budget: null,
  area: "",
  commuteFlex: null,
  notes: "",
  relevantBackground: "",
  englishMaths: null,
  scienceSubjects: null,
  qualificationLevel: null,
  englishComfort: null,
};

describe("preferredPathway", () => {
  it("returns null when starting point is unknown", () => {
    expect(preferredPathway(base)).toBeNull();
  });
  it("maps starting points to pathway keys", () => {
    expect(preferredPathway({ ...base, startingPoint: "school_leaver" })).toBe("school_leaver");
    expect(preferredPathway({ ...base, startingPoint: "graduate" })).toBe("graduate");
    expect(preferredPathway({ ...base, startingPoint: "career_changer" })).toBe("adjacent");
    expect(preferredPathway({ ...base, startingPoint: "adjacent" })).toBe("adjacent");
    expect(preferredPathway({ ...base, startingPoint: "no_background" })).toBe("no_background");
  });
});

describe("pressureSignals", () => {
  it("flags high time pressure on minimal weekly hours", () => {
    const s = pressureSignals({ ...base, weeklyHours: "0_5" });
    expect(s.timePressure).toBe("high");
  });
  it("flags medium and low time pressure correctly", () => {
    expect(pressureSignals({ ...base, weeklyHours: "5_10" }).timePressure).toBe("medium");
    expect(pressureSignals({ ...base, weeklyHours: "20_plus" }).timePressure).toBe("low");
  });
  it("flags high budget pressure on zero / under_500", () => {
    expect(pressureSignals({ ...base, budget: "zero" }).budgetPressure).toBe("high");
    expect(pressureSignals({ ...base, budget: "under_500" }).budgetPressure).toBe("high");
    expect(pressureSignals({ ...base, budget: "500_2000" }).budgetPressure).toBe("medium");
    expect(pressureSignals({ ...base, budget: "2000_plus" }).budgetPressure).toBe("low");
  });
  it("flags needsRemote and needsIncomeNow", () => {
    const s = pressureSignals({ ...base, commuteFlex: "remote_only", incomeNeed: "need_income" });
    expect(s.needsRemote).toBe(true);
    expect(s.needsIncomeNow).toBe(true);
  });
  it("does not flag when constraints are absent", () => {
    const s = pressureSignals({ ...base, commuteFlex: "60_min", incomeNeed: "part_time_ok" });
    expect(s.needsRemote).toBe(false);
    expect(s.needsIncomeNow).toBe(false);
  });
});

describe("summariseAnswers", () => {
  it("only includes provided fields", () => {
    const out = summariseAnswers({ ...base, startingPoint: "graduate", area: "Leeds" });
    expect(out).toContain("Starting point: graduate");
    expect(out).toContain("Area: Leeds");
    expect(out).not.toContain("Budget");
  });
  it("returns empty string when no answers provided", () => {
    expect(summariseAnswers(base)).toBe("");
  });
});
