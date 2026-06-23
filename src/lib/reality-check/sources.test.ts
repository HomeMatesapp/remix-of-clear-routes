import { describe, it, expect } from "vitest";
import {
  SOURCES,
  getSourcesForResult,
  getInfluencingAnswers,
  getThingsToVerify,
  hasOutdatedSources,
} from "./sources";
import type { RealityCheckAnswers, RealityCheckResult, RoleContext } from "./types";

const baseAnswers: RealityCheckAnswers = {
  startingPoint: "school_leaver",
  relevantBackground: "",
  englishMaths: "both",
  scienceSubjects: "no",
  qualificationLevel: "level_2",
  englishComfort: "yes",
  incomeNeed: "need_income",
  weeklyHours: "20_plus",
  budget: "zero",
  area: "Manchester",
  commuteFlex: "60_min",
  notes: "",
};

const baseResult: RealityCheckResult = {
  overallVerdict: "Realistic",
  bestRoute: {
    title: "Nursing Degree Apprenticeship",
    summary: "Salaried apprenticeship route.",
    whyThisFits: [],
    estimatedTime: "4 years",
    likelyCost: "£0",
    mainDifficulty: "Competition",
    confidence: "medium",
  },
  backupRoute: { title: "BSc Nursing at university", summary: "", tradeOff: "" },
  routeToAvoid: { title: "Generic care assistant job hoping it leads to nurse", whyRisky: "", whenItMightWork: "" },
  localRealism: { rating: "mixed", summary: "", dependsOn: [] },
  firstMoves: [],
};

const nurseRole: RoleContext = {
  role_name: "Registered Nurse",
  salary_entry: 28000,
  demand: "High",
  competition_level: "Moderate",
};

describe("source registry", () => {
  it("includes salary, demand and apprenticeship citations for a nurse apprenticeship verdict", () => {
    const sources = getSourcesForResult(nurseRole, baseAnswers, baseResult);
    const ids = sources.map((s) => s.id);
    expect(ids).toContain("ons_ashe");
    expect(ids).toContain("lmi_for_all");
    expect(ids).toContain("ifate");
    expect(ids).toContain("find_apprenticeship");
    expect(ids).toContain("nhs_careers");
    expect(ids).toContain("nmc");
  });

  it("does not cite ASHE when the role has no salary data", () => {
    const ids = getSourcesForResult({ role_name: "Tester" }, baseAnswers, baseResult).map((s) => s.id);
    expect(ids).not.toContain("ons_ashe");
  });

  it("does not cite Discover Uni when no degree route is recommended", () => {
    const result = { ...baseResult, bestRoute: { ...baseResult.bestRoute, title: "Plumbing apprenticeship" }, backupRoute: { ...baseResult.backupRoute, title: "Local college Level 2" } };
    const ids = getSourcesForResult({ role_name: "Plumber" }, baseAnswers, result).map((s) => s.id);
    expect(ids).not.toContain("discover_uni");
  });

  it("never returns duplicates", () => {
    const sources = getSourcesForResult(nurseRole, baseAnswers, baseResult);
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every registry entry has organisation, period, lastChecked and url", () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.organisation).toBeTruthy();
      expect(s.period).toBeTruthy();
      expect(s.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.url).toMatch(/^https?:\/\//);
    }
  });

  it("flags outdated sources when lastChecked is older than the threshold", () => {
    const outdated = [{ ...SOURCES.ons_ashe, lastChecked: "2020-01-01" }];
    expect(hasOutdatedSources(outdated, new Date("2026-06-01"))).toBe(true);
    expect(hasOutdatedSources([SOURCES.ons_ashe], new Date("2026-06-01"))).toBe(false);
  });
});

describe("influencing answers", () => {
  it("returns the user's actual answers, not raw enum codes", () => {
    const influences = getInfluencingAnswers(baseAnswers);
    const values = influences.map((i) => i.value);
    expect(values).toContain("School leaver");
    expect(values).toContain("£0 budget");
    expect(values.some((v) => v.includes("_"))).toBe(false);
  });

  it("uses cautious, non-absolute wording and never claims eligibility", () => {
    for (const inf of getInfluencingAnswers(baseAnswers)) {
      expect(inf.influence).not.toMatch(/\b(guarantee|guaranteed|will get|qualifies you|eligible for)\b/i);
    }
  });

  it("skips fields the user left blank", () => {
    const sparse: RealityCheckAnswers = { ...baseAnswers, area: "", incomeNeed: null };
    const labels = getInfluencingAnswers(sparse).map((i) => i.label);
    expect(labels).not.toContain("Area");
    expect(labels).not.toContain("Income need");
  });
});

describe("things to verify", () => {
  it("always tells users to confirm entry requirements directly", () => {
    const items = getThingsToVerify(nurseRole, baseAnswers);
    expect(items.some((i) => /confirm.*entry requirements/i.test(i))).toBe(true);
  });

  it("adds a regulator check for regulated clinical roles", () => {
    const items = getThingsToVerify(nurseRole, baseAnswers);
    expect(items.some((i) => /NMC|HCPC|regulator/.test(i))).toBe(true);
  });

  it("never uses absolute or guarantee language", () => {
    for (const i of getThingsToVerify(nurseRole, baseAnswers)) {
      expect(i).not.toMatch(/\b(guarantee|guaranteed|definitely|will be accepted)\b/i);
    }
  });
});
