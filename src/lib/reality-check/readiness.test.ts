import { describe, it, expect } from "vitest";
import { classifyReadiness, buildResult } from "./readiness";
import type { RealityCheckAnswers, RoleContext } from "./types";

const baseAnswers: RealityCheckAnswers = {
  startingPoint: "career_changer",
  relevantBackground: "healthcare assistant for two years",
  englishMaths: "both",
  scienceSubjects: "some",
  qualificationLevel: "undergrad",
  englishComfort: "yes",
  incomeNeed: "part_time_ok",
  weeklyHours: "10_20",
  budget: "500_2000",
  region: "greater_manchester",
  area: "",
  commuteFlex: "60_min",
  notes: "",
};

const nurse: RoleContext = { role_name: "Registered Nurse" };
const teacher: RoleContext = { role_name: "Primary School Teacher" };
const sparky: RoleContext = { role_name: "Electrician" };
const dev: RoleContext = { role_name: "Software Engineer" };

describe("classifyReadiness", () => {
  it("returns ready_now when no blockers or concerns fire", () => {
    const r = classifyReadiness(baseAnswers, nurse);
    expect(r.readiness).toBe("ready_now");
    expect(r.rules).toEqual([]);
  });

  it("returns nearly_ready when a soft concern fires", () => {
    const a = { ...baseAnswers, weeklyHours: "0_5", incomeNeed: "part_time_ok" } as RealityCheckAnswers;
    const r = classifyReadiness(a, dev);
    expect(r.readiness).toBe("nearly_ready");
  });

  it("returns needs_bridging when one structural blocker fires (clinical, no GCSE)", () => {
    const a = { ...baseAnswers, englishMaths: "no" } as RealityCheckAnswers;
    const r = classifyReadiness(a, nurse);
    expect(r.readiness).toBe("needs_bridging");
    expect(r.rules[0].id).toBe("blocker_no_gcse_clinical");
  });

  it("returns high_risk_now when two structural blockers fire", () => {
    const a = {
      ...baseAnswers,
      englishMaths: "no",
      qualificationLevel: "none",
      relevantBackground: "",
      startingPoint: "no_background",
    } as RealityCheckAnswers;
    const r = classifyReadiness(a, nurse);
    expect(r.readiness).toBe("high_risk_now");
    expect(r.rules.length).toBeGreaterThanOrEqual(2);
  });

  it("flags graduate-without-relevant-background as a bridging concern for clinical roles", () => {
    const a = {
      ...baseAnswers,
      startingPoint: "graduate",
      relevantBackground: "",
    } as RealityCheckAnswers;
    const r = classifyReadiness(a, nurse);
    expect(r.rules.some((x) => x.id === "bridge_unrelated_graduate")).toBe(true);
  });

  it("flags teaching without GCSE as a blocker", () => {
    const a = { ...baseAnswers, englishMaths: "no" } as RealityCheckAnswers;
    const r = classifyReadiness(a, teacher);
    expect(r.rules[0].id).toBe("blocker_no_gcse_teaching");
  });

  it("flags money + time + need-to-earn combo as a blocker", () => {
    const a = {
      ...baseAnswers,
      budget: "zero",
      weeklyHours: "0_5",
      incomeNeed: "need_income",
    } as RealityCheckAnswers;
    const r = classifyReadiness(a, dev);
    expect(r.rules.some((x) => x.id === "blocker_money_time_income")).toBe(true);
  });

  it("trade roles do not require Level 3 quals to avoid the no-quals blocker", () => {
    const a = {
      ...baseAnswers,
      qualificationLevel: "none",
      relevantBackground: "",
      startingPoint: "no_background",
    } as RealityCheckAnswers;
    const r = classifyReadiness(a, sparky);
    expect(r.rules.some((x) => x.id === "blocker_no_quals_no_background")).toBe(false);
  });
});

describe("buildResult", () => {
  it("produces a complete result for the ready_now case", () => {
    const out = buildResult(baseAnswers, nurse);
    expect(out.readiness).toBe("ready_now");
    expect(out.overallVerdict).toBe("Realistic");
    expect(out.bestRoute.title).toBeTruthy();
    expect(out.routeToAvoid.title).toBeTruthy();
    expect(out.firstMoves).toHaveLength(3);
    expect(out.immediateAction).toBeTruthy();
  });

  it("never returns currency or percent figures in prose fields", () => {
    const out = buildResult(baseAnswers, nurse);
    const prose = [
      out.readinessReason,
      out.biggestBlocker,
      out.immediateAction,
      out.bestRoute.summary,
      out.bestRoute.mainDifficulty,
      ...out.bestRoute.whyThisFits,
      out.backupRoute.summary,
      out.backupRoute.tradeOff,
      out.routeToAvoid.whyRisky,
      out.routeToAvoid.whenItMightWork,
      ...out.firstMoves,
    ].join("\n");
    expect(prose).not.toMatch(/£\d/);
    expect(prose).not.toMatch(/\d%/);
  });

  it("recommends a paid route when the user needs income", () => {
    const a = { ...baseAnswers, incomeNeed: "need_income" } as RealityCheckAnswers;
    const out = buildResult(a, sparky);
    expect(out.bestRoute.title.toLowerCase()).toContain("apprentice");
  });

  it("immediateAction for unrelated graduate into nursing points at HCA", () => {
    const a = {
      ...baseAnswers,
      startingPoint: "graduate",
      relevantBackground: "",
    } as RealityCheckAnswers;
    const out = buildResult(a, nurse);
    expect(out.immediateAction.toLowerCase()).toContain("healthcare assistant");
  });
});
