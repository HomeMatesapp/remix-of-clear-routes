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
  });
  assertEquals(out, {
    startingPoint: "career changer",
    incomeNeed:    "can study full-time",
    weeklyHours:   "20+ hours per week",
    budget:        "£500–£2,000 budget",
    commuteFlex:   "can relocate",
  });
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
  });
  for (const v of Object.values(out)) {
    if (/_/.test(v) && !/[–\-£]/.test(v)) {
      throw new Error(`label looks like a raw enum: ${v}`);
    }
  }
});

Deno.test("answersToLabels handles null / unknown answers", () => {
  const out = answersToLabels({
    startingPoint: null,
    incomeNeed:    null,
    weeklyHours:   null,
    budget:        null,
    commuteFlex:   null,
    area:          "",
    notes:         "",
  });
  assertEquals(out.startingPoint, "(not given)");
  assertEquals(out.budget,        "(not given)");
  assertEquals(out.commuteFlex,   "(not given)");
});
