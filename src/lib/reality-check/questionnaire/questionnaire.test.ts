// Registry, config resolution, sanitisation tests for the modular questionnaire.

import { describe, expect, it } from "vitest";
import { hasModularConfig, resolveConfig } from "./registry";
import { sanitiseAnswer, sanitiseAnswerMap, sanitiseInlineText, toggleMultiSelect } from "./sanitise";
import type { Question } from "./types";

describe("registry", () => {
  it("resolves Electrician by slug to exactly 9 questions in the specified order", () => {
    const cfg = resolveConfig("electrician");
    expect(cfg).not.toBeNull();
    expect(cfg!.questionnaireVersion).toBe("electrician-v1");
    expect(cfg!.engineId).toBe("electrician-v1");
    expect(cfg!.family).toBe("skilled-trades");
    expect(cfg!.questions.map((q) => q.id)).toEqual([
      "starting_point",
      "relevant_experience",
      "electrical_qualification",
      "maths_english_status",
      "training_availability",
      "training_budget",
      "travel_range",
      "working_conditions_to_check",
      "route_priorities",
    ]);
  });

  it("returns null for unknown role slugs (legacy flow will run)", () => {
    expect(resolveConfig("registered-nurse")).toBeNull();
    expect(hasModularConfig("registered-nurse")).toBe(false);
    expect(hasModularConfig("electrician")).toBe(true);
  });
});

describe("exclusive options in multi-select", () => {
  const q = resolveConfig("electrician")!.questions.find((x) => x.id === "relevant_experience")!;

  it("selecting no_experience clears other selections", () => {
    const next = toggleMultiSelect(q, ["electrical_work", "construction_or_trade"], "no_experience");
    expect(next).toEqual(["no_experience"]);
  });

  it("selecting another option clears no_experience", () => {
    const next = toggleMultiSelect(q, ["no_experience"], "electrical_work");
    expect(next).toEqual(["electrical_work"]);
  });

  it("working_conditions: none and need_more_info are exclusive both ways", () => {
    const wc = resolveConfig("electrician")!.questions.find((x) => x.id === "working_conditions_to_check")!;
    expect(toggleMultiSelect(wc, ["working_at_height", "confined_spaces"], "none")).toEqual(["none"]);
    expect(toggleMultiSelect(wc, ["none"], "working_at_height")).toEqual(["working_at_height"]);
    expect(toggleMultiSelect(wc, ["confined_spaces"], "need_more_info")).toEqual(["need_more_info"]);
    expect(toggleMultiSelect(wc, ["need_more_info"], "confined_spaces")).toEqual(["confined_spaces"]);
  });
});

describe("route_priorities max=2", () => {
  const q = resolveConfig("electrician")!.questions.find((x) => x.id === "route_priorities")!;

  it("cannot select a third; existing selections preserved", () => {
    const next = toggleMultiSelect(q, ["earn_while_training", "low_cost"], "qualify_quickly");
    expect(next).toEqual(["earn_while_training", "low_cost"]);
  });

  it("deselecting then reselecting works", () => {
    let s = ["earn_while_training", "low_cost"];
    s = toggleMultiSelect(q, s, "low_cost");
    expect(s).toEqual(["earn_while_training"]);
    s = toggleMultiSelect(q, s, "qualify_quickly");
    expect(s).toEqual(["earn_while_training", "qualify_quickly"]);
  });

  it("not_sure_yet is exclusive", () => {
    const next = toggleMultiSelect(q, ["earn_while_training"], "not_sure_yet");
    expect(next).toEqual(["not_sure_yet"]);
  });

  it("sanitiseAnswer trims stored values above the max", () => {
    const cleaned = sanitiseAnswer(q, ["a", "b", "c"]);
    expect(Array.isArray(cleaned) && (cleaned as string[]).length).toBe(2);
  });
});

describe("inline text sanitisation", () => {
  const cfg = resolveConfig("electrician")!;
  it("clears qualification name when electrical_qualification becomes none", () => {
    const cleaned = sanitiseInlineText(
      cfg.questions,
      { electrical_qualification: "none" },
      { electrical_qualification: "City & Guilds 2365 L2" },
    );
    expect(cleaned.electrical_qualification).toBeUndefined();
  });

  it("keeps qualification name when a triggering option is selected", () => {
    const cleaned = sanitiseInlineText(
      cfg.questions,
      { electrical_qualification: "level_2" },
      { electrical_qualification: "City & Guilds 2365 L2" },
    );
    expect(cleaned.electrical_qualification).toBe("City & Guilds 2365 L2");
  });

  it("clears something_else text on deselect", () => {
    const cleaned = sanitiseInlineText(
      cfg.questions,
      { relevant_experience: ["electrical_work"] },
      { relevant_experience: "rewired parents garage" },
    );
    expect(cleaned.relevant_experience).toBeUndefined();
  });

  it("clears starting_point none_fit text when option is changed", () => {
    const cleaned = sanitiseInlineText(
      cfg.questions,
      { starting_point: "career_changer" },
      { starting_point: "between roles after a career break" },
    );
    expect(cleaned.starting_point).toBeUndefined();
  });
});

describe("sanitiseAnswerMap drops answers for questions not in the active config", () => {
  const cfg = resolveConfig("electrician")!;
  it("drops legacy answer keys", () => {
    const cleaned = sanitiseAnswerMap(cfg.questions, {
      starting_point: "career_changer",
      englishComfort: "yes" as unknown as string, // legacy stray
      relevantBackground: "psychology degree" as unknown as string,
    });
    expect(cleaned.starting_point).toBe("career_changer");
    expect(cleaned).not.toHaveProperty("englishComfort");
    expect(cleaned).not.toHaveProperty("relevantBackground");
  });
});
