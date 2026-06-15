import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { answersToLabels } from "./index.ts";

Deno.test("answersToLabels maps every enum to a human-readable label", () => {
  const out = answersToLabels({
    startingPoint: "career_changer",
    incomeNeed:    "full_time_study",
    weeklyHours:   "20_plus",
    budget:        "500_2000",
    commuteFlex:   "can_relocate",
    area:          "Manchester",
    notes:         "",
    relevantBackground: "psychology degree",
    englishMaths:       "both",
    scienceSubjects:    "yes",
    qualificationLevel: "undergrad",
    englishComfort:     "yes",
  });
  assertEquals(out.startingPoint,      "career changer");
  assertEquals(out.incomeNeed,         "can study full-time");
  assertEquals(out.weeklyHours,        "20+ hours per week");
  assertEquals(out.budget,             "£500–£2,000 budget");
  assertEquals(out.commuteFlex,        "can relocate");
  assertEquals(out.englishMaths,       "has GCSE English and maths (or equivalent)");
  assertEquals(out.scienceSubjects,    "has science or role-related subjects");
  assertEquals(out.qualificationLevel, "undergraduate degree");
  assertEquals(out.englishComfort,     "comfortable studying and working in English");
});

Deno.test("answersToLabels never returns a raw enum code", () => {
  const out = answersToLabels({
    startingPoint: "no_background",
    incomeNeed:    "need_income",
    weeklyHours:   "0_5",
    budget:        "zero",
    commuteFlex:   "remote_only",
    area:          "",
    notes:         "",
    relevantBackground: "",
    englishMaths:       "no",
    scienceSubjects:    "no",
    qualificationLevel: "none",
    englishComfort:     "may_need_support",
  });
  for (const v of Object.values(out)) {
    if (/_/.test(v) && !/[–\-£]/.test(v)) {
      throw new Error(`label looks like a raw enum: ${v}`);
    }
  }
});

Deno.test("answersToLabels handles null / unknown / missing answers", () => {
  const out = answersToLabels({
    startingPoint: null,
    incomeNeed:    null,
    weeklyHours:   null,
    budget:        null,
    commuteFlex:   null,
    area:          "",
    notes:         "",
    // qualifications layer omitted entirely (older saved decisions)
  });
  assertEquals(out.startingPoint,      "(not given)");
  assertEquals(out.budget,             "(not given)");
  assertEquals(out.commuteFlex,        "(not given)");
  assertEquals(out.englishMaths,       "(not given)");
  assertEquals(out.scienceSubjects,    "(not given)");
  assertEquals(out.qualificationLevel, "(not given)");
  assertEquals(out.englishComfort,     "(not given)");
});

Deno.test("graduate with related background vs unrelated background is preserved verbatim in labels", () => {
  // Background is a free-text field — answersToLabels does not transform it.
  // We assert via the user message that the prompt distinguishes the two.
  const related = answersToLabels({
    startingPoint: "graduate",
    incomeNeed: "need_income",
    weeklyHours: "10_20",
    budget: "under_500",
    area: "Leeds",
    commuteFlex: "60_min",
    notes: "",
    relevantBackground: "psychology degree, healthcare assistant",
    englishMaths: "both",
    scienceSubjects: "some",
    qualificationLevel: "undergrad",
    englishComfort: "yes",
  });
  assertEquals(related.englishMaths, "has GCSE English and maths (or equivalent)");

  const unrelated = answersToLabels({
    startingPoint: "graduate",
    incomeNeed: "need_income",
    weeklyHours: "10_20",
    budget: "under_500",
    area: "Leeds",
    commuteFlex: "60_min",
    notes: "",
    relevantBackground: "history degree, no healthcare experience",
    englishMaths: "no",
    scienceSubjects: "no",
    qualificationLevel: "undergrad",
    englishComfort: "yes",
  });
  assertEquals(unrelated.englishMaths,    "does not have GCSE English or maths");
  assertEquals(unrelated.scienceSubjects, "does not have science or role-related subjects");
});
