import { describe, it, expect } from "vitest";
import {
  answersToProfile,
  emptyProfileFields,
  hasAnyProfileField,
  profileToAnswers,
  profilesDiffer,
  type DecisionProfileFields,
} from "./profile-mapping";
import type { RealityCheckAnswers } from "./types";

const emptyAnswers: RealityCheckAnswers = {
  startingPoint: null,
  incomeNeed: null,
  weeklyHours: null,
  budget: null,
  area: "",
  commuteFlex: null,
  notes: "",
};

describe("profile-mapping: profileToAnswers", () => {
  it("maps enum codes through unchanged", () => {
    const p: DecisionProfileFields = {
      area: "Manchester",
      starting_point: "graduate",
      need_to_earn: "need_income",
      weekly_hours: "10_20",
      budget_band: "under_500",
      commute_flexibility: "60_min",
    };
    const a = profileToAnswers(p, emptyAnswers);
    expect(a.startingPoint).toBe("graduate");
    expect(a.incomeNeed).toBe("need_income");
    expect(a.weeklyHours).toBe("10_20");
    expect(a.budget).toBe("under_500");
    expect(a.commuteFlex).toBe("60_min");
    expect(a.area).toBe("Manchester");
  });

  it("normalises human labels to enum codes (case-insensitive)", () => {
    const p: DecisionProfileFields = {
      area: "London",
      starting_point: "Graduate",
      need_to_earn: "Yes, I need income",
      weekly_hours: "0–5 hours",
      budget_band: "£0",
      commute_flexibility: "Remote / online only",
    };
    const a = profileToAnswers(p, emptyAnswers);
    expect(a.startingPoint).toBe("graduate");
    expect(a.incomeNeed).toBe("need_income");
    expect(a.weeklyHours).toBe("0_5");
    expect(a.budget).toBe("zero");
    expect(a.commuteFlex).toBe("remote_only");
  });

  it("falls back to base values for unknown / null fields", () => {
    const base: RealityCheckAnswers = { ...emptyAnswers, startingPoint: "graduate", area: "Leeds" };
    const a = profileToAnswers({ ...emptyProfileFields, starting_point: "nonsense" }, base);
    expect(a.startingPoint).toBe("graduate");
    expect(a.area).toBe("Leeds");
  });
});

describe("profile-mapping: answersToProfile", () => {
  it("emits enum codes and trims area", () => {
    const a: RealityCheckAnswers = {
      startingPoint: "career_changer",
      incomeNeed: "part_time_ok",
      weeklyHours: "5_10",
      budget: "500_2000",
      area: "  Bristol  ",
      commuteFlex: "30_min",
      notes: "",
    };
    expect(answersToProfile(a)).toEqual({
      area: "Bristol",
      starting_point: "career_changer",
      need_to_earn: "part_time_ok",
      weekly_hours: "5_10",
      budget_band: "500_2000",
      commute_flexibility: "30_min",
    });
  });

  it("returns null area for whitespace-only input", () => {
    expect(answersToProfile({ ...emptyAnswers, area: "   " }).area).toBeNull();
  });
});

describe("profile-mapping: hasAnyProfileField / profilesDiffer", () => {
  it("hasAnyProfileField is false for null/empty", () => {
    expect(hasAnyProfileField(null)).toBe(false);
    expect(hasAnyProfileField(emptyProfileFields)).toBe(false);
  });
  it("hasAnyProfileField is true when any field set", () => {
    expect(hasAnyProfileField({ ...emptyProfileFields, area: "Hull" })).toBe(true);
  });
  it("profilesDiffer detects changes", () => {
    expect(profilesDiffer(emptyProfileFields, emptyProfileFields)).toBe(false);
    expect(
      profilesDiffer(emptyProfileFields, { ...emptyProfileFields, budget_band: "zero" }),
    ).toBe(true);
  });
});

describe("normalisation bug: label-vs-code should not register as a change", () => {
  // Bug: DB stored "Graduate" (label). Form normalised to "graduate" (code).
  // Naive diff against raw DB row showed a phantom change and prompted
  // the user to update their profile. The fix is to compare against the
  // normalised baseline.
  it("round-trip via profileToAnswers/answersToProfile is idempotent", () => {
    const dbRow: DecisionProfileFields = {
      area: "Manchester",
      starting_point: "Graduate",
      need_to_earn: "Yes, I need income",
      weekly_hours: "10–20 hours",
      budget_band: "£500–£2,000",
      commute_flexibility: "60 minutes",
    };
    const normalised = answersToProfile(profileToAnswers(dbRow, emptyAnswers));
    // First normalisation produces enum codes.
    expect(normalised).toEqual({
      area: "Manchester",
      starting_point: "graduate",
      need_to_earn: "need_income",
      weekly_hours: "10_20",
      budget_band: "500_2000",
      commute_flexibility: "60_min",
    });
    // And the user has changed nothing, so diff against the normalised
    // baseline must be false.
    const userTouchedNothing = answersToProfile(profileToAnswers(dbRow, emptyAnswers));
    expect(profilesDiffer(normalised, userTouchedNothing)).toBe(false);
  });

  it("does detect a real user change", () => {
    const baseline: DecisionProfileFields = {
      ...emptyProfileFields,
      starting_point: "graduate",
      budget_band: "zero",
    };
    const edited: DecisionProfileFields = { ...baseline, budget_band: "under_500" };
    expect(profilesDiffer(baseline, edited)).toBe(true);
  });
});
