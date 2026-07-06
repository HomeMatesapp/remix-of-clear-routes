// Registry, config resolution, sanitisation tests for the modular questionnaire.

import { describe, expect, it } from "vitest";
import { hasModularConfig, hasReviewedModularRealityCheck, resolveConfig } from "./registry";
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

describe("registry — plumber", () => {
  it("resolves Plumber by slug to exactly 9 questions in the specified order", () => {
    const cfg = resolveConfig("plumber");
    expect(cfg).not.toBeNull();
    expect(cfg!.questionnaireVersion).toBe("plumber-v1");
    expect(cfg!.engineId).toBe("plumber-v1");
    expect(cfg!.family).toBe("skilled-trades");
    expect(cfg!.questions.map((q) => q.id)).toEqual([
      "starting_point",
      "relevant_experience",
      "plumbing_qualification",
      "maths_english_status",
      "training_availability",
      "training_budget",
      "travel_range",
      "working_conditions_to_check",
      "route_priorities",
    ]);
  });

  it("hasModularConfig returns true for plumber", () => {
    expect(hasModularConfig("plumber")).toBe(true);
  });

  it("Electrician and Plumber declare different working_conditions_to_check options", () => {
    const e = resolveConfig("electrician")!.questions.find((q) => q.id === "working_conditions_to_check")!;
    const p = resolveConfig("plumber")!.questions.find((q) => q.id === "working_conditions_to_check")!;
    const eValues = (e.options ?? []).map((o) => o.value).sort();
    const pValues = (p.options ?? []).map((o) => o.value).sort();
    expect(eValues).not.toEqual(pValues);
    expect(pValues).toContain("emergency_callouts");
    expect(eValues).toContain("working_at_height");
  });

  it("Plumber relevant_experience includes plumbing_work; Electrician includes electrical_work", () => {
    const e = resolveConfig("electrician")!.questions.find((q) => q.id === "relevant_experience")!;
    const p = resolveConfig("plumber")!.questions.find((q) => q.id === "relevant_experience")!;
    expect((p.options ?? []).map((o) => o.value)).toContain("plumbing_work");
    expect((e.options ?? []).map((o) => o.value)).toContain("electrical_work");
  });

  it("plumbing_qualification does not show the inline text field for 'none' or 'not_sure'", () => {
    const q = resolveConfig("plumber")!.questions.find((x) => x.id === "plumbing_qualification")!;
    expect(q.conditionalField).toBeDefined();
    expect(q.conditionalField!.showWhenValueIn).not.toContain("none");
    expect(q.conditionalField!.showWhenValueIn).not.toContain("not_sure");
    expect(q.conditionalField!.showWhenValueIn).toContain("gas_heating");
    expect(q.conditionalField!.showWhenValueIn).toContain("older_unknown");
  });
});

describe("reviewed-modular gate naming and semantics", () => {
  it("hasReviewedModularRealityCheck is true for reviewed roles only", () => {
    expect(hasReviewedModularRealityCheck("electrician")).toBe(true);
    expect(hasReviewedModularRealityCheck("plumber")).toBe(true);
    expect(hasReviewedModularRealityCheck("hvac-engineer")).toBe(true);
    expect(hasReviewedModularRealityCheck("registered-nurse")).toBe(false);
    expect(hasReviewedModularRealityCheck("unknown-role-slug")).toBe(false);
  });

  it("legacy hasModularConfig alias still returns the same values", () => {
    expect(hasModularConfig("electrician")).toBe(hasReviewedModularRealityCheck("electrician"));
    expect(hasModularConfig("registered-nurse")).toBe(hasReviewedModularRealityCheck("registered-nurse"));
  });

  it("gate requires BOTH a questionnaire and a route engine — modular roles always resolve a config", () => {
    for (const slug of ["electrician", "plumber", "hvac-engineer"]) {
      expect(hasReviewedModularRealityCheck(slug)).toBe(true);
      expect(resolveConfig(slug)).not.toBeNull();
    }
  });
});

describe("registry — heating engineer (slug: hvac-engineer)", () => {
  it("resolves Heating Engineer by slug to exactly 9 questions in the specified order", () => {
    const cfg = resolveConfig("hvac-engineer");
    expect(cfg).not.toBeNull();
    expect(cfg!.questionnaireVersion).toBe("heating-engineer-v1");
    expect(cfg!.engineId).toBe("heating-engineer-v1");
    expect(cfg!.family).toBe("skilled-trades");
    expect(cfg!.questions.map((q) => q.id)).toEqual([
      "starting_point",
      "relevant_experience",
      "heating_qualification",
      "maths_english_status",
      "training_availability",
      "training_budget",
      "travel_range",
      "working_conditions_to_check",
      "route_priorities",
    ]);
  });

  it("shared maths/English question is reused (same object identity across roles)", () => {
    const e = resolveConfig("electrician")!.questions.find((q) => q.id === "maths_english_status")!;
    const p = resolveConfig("plumber")!.questions.find((q) => q.id === "maths_english_status")!;
    const h = resolveConfig("hvac-engineer")!.questions.find((q) => q.id === "maths_english_status")!;
    expect(h).toBe(e);
    expect(h).toBe(p);
  });

  it("Heating Engineer working_conditions differ from Electrician and Plumber", () => {
    const e = resolveConfig("electrician")!.questions.find((q) => q.id === "working_conditions_to_check")!;
    const p = resolveConfig("plumber")!.questions.find((q) => q.id === "working_conditions_to_check")!;
    const h = resolveConfig("hvac-engineer")!.questions.find((q) => q.id === "working_conditions_to_check")!;
    const hVals = (h.options ?? []).map((o) => o.value);
    expect(hVals).toContain("safety_critical_systems");
    expect((e.options ?? []).map((o) => o.value)).not.toContain("safety_critical_systems");
    expect((p.options ?? []).map((o) => o.value)).not.toContain("safety_critical_systems");
  });

  it("heating_qualification does not show inline field for 'none' or 'not_sure'", () => {
    const q = resolveConfig("hvac-engineer")!.questions.find((x) => x.id === "heating_qualification")!;
    expect(q.conditionalField).toBeDefined();
    expect(q.conditionalField!.showWhenValueIn).not.toContain("none");
    expect(q.conditionalField!.showWhenValueIn).not.toContain("not_sure");
    expect(q.conditionalField!.showWhenValueIn).toContain("gas_or_gas_safe_claimed");
    expect(q.conditionalField!.showWhenValueIn).toContain("heat_pump_or_low_carbon");
    expect(q.conditionalField!.showWhenValueIn).toContain("international");
  });

  it("Heating Engineer relevant_experience includes heating/gas/plumbing/building-services options", () => {
    const q = resolveConfig("hvac-engineer")!.questions.find((x) => x.id === "relevant_experience")!;
    const vals = (q.options ?? []).map((o) => o.value);
    for (const v of [
      "heating_install_service",
      "plumbing_or_domestic_heat",
      "gas_appliance_or_systems",
      "building_services_hvac",
      "electrical_controls",
    ]) {
      expect(vals).toContain(v);
    }
  });

  it("working_conditions exclusive options behave both ways", () => {
    const wc = resolveConfig("hvac-engineer")!.questions.find((x) => x.id === "working_conditions_to_check")!;
    expect(toggleMultiSelect(wc, ["safety_critical_systems", "emergency_callouts"], "none")).toEqual(["none"]);
    expect(toggleMultiSelect(wc, ["none"], "safety_critical_systems")).toEqual(["safety_critical_systems"]);
    expect(toggleMultiSelect(wc, ["confined_or_plant_rooms"], "need_more_info")).toEqual(["need_more_info"]);
    expect(toggleMultiSelect(wc, ["need_more_info"], "customer_sites")).toEqual(["customer_sites"]);
  });

  it("adding Heating Engineer does not alter Electrician or Plumber question sequences", () => {
    expect(resolveConfig("electrician")!.questions.map((q) => q.id)).toEqual([
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
    expect(resolveConfig("plumber")!.questions.map((q) => q.id)).toEqual([
      "starting_point",
      "relevant_experience",
      "plumbing_qualification",
      "maths_english_status",
      "training_availability",
      "training_budget",
      "travel_range",
      "working_conditions_to_check",
      "route_priorities",
    ]);
  });

  it("heating_qualification inline text clears when no longer relevant", () => {
    const cfg = resolveConfig("hvac-engineer")!;
    const cleared = sanitiseInlineText(
      cfg.questions,
      { heating_qualification: "none" },
      { heating_qualification: "ACS CCN1" },
    );
    expect(cleared.heating_qualification).toBeUndefined();
    const kept = sanitiseInlineText(
      cfg.questions,
      { heating_qualification: "gas_or_gas_safe_claimed" },
      { heating_qualification: "ACS CCN1" },
    );
    expect(kept.heating_qualification).toBe("ACS CCN1");
  });
});
