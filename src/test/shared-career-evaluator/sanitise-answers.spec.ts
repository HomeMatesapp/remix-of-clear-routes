import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sanitisePublicAnswers, hasBlockingIssues } from "@shared/career-evaluator/v1/sanitise-answers";
import { evaluate } from "@shared/career-evaluator/v1/evaluate";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (slug: string) =>
  JSON.parse(readFileSync(resolve(__dir, `../../../content/career-packs/${slug}/1.1.0.json`), "utf-8")) as CareerDecisionPackV1;

const midwife = load("midwife");
const carpenter = load("carpenter-joiner");

const validMidwifeAnswers: Record<string, string> = {
  starting_point: "school_leaver",
  gcse_maths_english_science_status: "yes",
  level3_status: "yes_science",
  relevant_first_degree_status: "no",
  current_registration: "no",
  income_need: "can_study_full_time",
  weekly_placement_hours: "yes",
  dbs_check_barriers: "none",
  occupational_health_concerns: "none",
};

describe("sanitisePublicAnswers — happy path", () => {
  it("accepts a fully-valid submission unchanged", () => {
    const r = sanitisePublicAnswers(midwife, validMidwifeAnswers);
    expect(r.issues).toEqual([]);
    expect(r.droppedUnknownIds).toEqual([]);
    // Sanitised is a subset of visible answers.
    for (const [k, v] of Object.entries(r.sanitisedAnswers)) {
      expect(validMidwifeAnswers[k]).toBe(v);
    }
  });
});

describe("sanitisePublicAnswers — hostile-answer matrix", () => {
  it("drops answers for unknown question IDs", () => {
    const r = sanitisePublicAnswers(midwife, { ...validMidwifeAnswers, made_up_question: "yes" });
    expect(r.droppedUnknownIds).toContain("made_up_question");
    expect(r.sanitisedAnswers["made_up_question"]).toBeUndefined();
  });

  it("drops question IDs from another career", () => {
    // physical_capacity is a carpenter question, not a midwife question.
    const r = sanitisePublicAnswers(midwife, { ...validMidwifeAnswers, physical_capacity: "yes_confident" });
    expect(r.droppedUnknownIds).toContain("physical_capacity");
    expect(r.sanitisedAnswers["physical_capacity"]).toBeUndefined();
  });

  it("rejects an invalid single-select option", () => {
    const r = sanitisePublicAnswers(midwife, { ...validMidwifeAnswers, current_registration: "definitely_maybe" });
    expect(r.issues.some((i) => i.code === "invalid_option" && i.questionId === "current_registration")).toBe(true);
    expect(r.sanitisedAnswers["current_registration"]).toBeUndefined();
    expect(hasBlockingIssues(r.issues)).toBe(true);
  });

  it("rejects a value supplied as the wrong primitive type", () => {
    const r = sanitisePublicAnswers(midwife, { ...validMidwifeAnswers, current_registration: 42 as unknown as string });
    expect(r.issues.some((i) => i.code === "invalid_type")).toBe(true);
  });

  it("flags missing required visible answers", () => {
    const partial = { ...validMidwifeAnswers };
    delete (partial as Record<string, unknown>).current_registration;
    const r = sanitisePublicAnswers(midwife, partial);
    expect(r.issues.some((i) => i.code === "missing_required" && i.questionId === "current_registration")).toBe(true);
    expect(hasBlockingIssues(r.issues)).toBe(true);
  });

  it("ignores a browser-supplied fake `visibleWhen` on a question — visibility comes only from the pack", () => {
    const hostile = {
      ...validMidwifeAnswers,
      // Attackers can send garbage top-level payload; sanitiser only reads
      // known question IDs, so any extra `visibleWhen` payload is a no-op.
      visibleWhen: [{ questionId: "starting_point", op: "eq", value: "school_leaver" }],
      questionRefs: [{ id: "starting_point", required: false }],
      required: false,
    } as unknown as Record<string, unknown>;
    const r = sanitisePublicAnswers(midwife, hostile);
    // "visibleWhen", "questionRefs", "required" are dropped as unknown IDs.
    expect(r.droppedUnknownIds).toEqual(expect.arrayContaining(["visibleWhen", "questionRefs", "required"]));
    // starting_point is still enforced by the pack.
    expect(r.sanitisedAnswers.starting_point).toBe("school_leaver");
  });

  it("recomputes visibility from the pack, discarding hidden answers", () => {
    // In carpenter, `local_apprenticeship_known` is hidden unless
    // `has_employer_offer` is 'actively_looking'. Sending "yes_found" when it
    // is hidden should be dropped.
    const answers: Record<string, string> = {
      starting_point: "school_leaver",
      english_maths_status: "yes_level2",
      has_employer_offer: "yes_have_offer",           // hides local_apprenticeship_known
      documented_work_evidence: "none",
      physical_capacity: "yes_confident",
      travel_capability: "yes_reliable_transport",
      tool_budget: "employer_provides",
      income_need: "can_apprentice_wage",
      local_apprenticeship_known: "yes_found",        // hostile: hidden
      willing_workplace_evidence: "yes",
    };
    const r = sanitisePublicAnswers(carpenter, answers);
    expect(r.droppedHiddenIds).toContain("local_apprenticeship_known");
    expect(r.sanitisedAnswers.local_apprenticeship_known).toBeUndefined();
  });

  it("supports a valid conditional branch", () => {
    const answers: Record<string, string> = {
      starting_point: "school_leaver",
      english_maths_status: "yes_level2",
      has_employer_offer: "actively_looking",         // opens local_apprenticeship_known
      documented_work_evidence: "none",
      physical_capacity: "yes_confident",
      travel_capability: "yes_reliable_transport",
      tool_budget: "employer_provides",
      income_need: "can_apprentice_wage",
      local_apprenticeship_known: "yes_found",
      willing_workplace_evidence: "yes",
    };
    const r = sanitisePublicAnswers(carpenter, answers);
    expect(r.sanitisedAnswers.local_apprenticeship_known).toBe("yes_found");
    expect(r.issues.filter((i) => i.code === "missing_required")).toEqual([]);
  });

  it("branch change that hides a previously-supplied answer drops it", () => {
    const answers: Record<string, string> = {
      starting_point: "school_leaver",
      english_maths_status: "yes_level2",
      has_employer_offer: "yes_have_offer",           // hidden branch
      documented_work_evidence: "none",
      physical_capacity: "yes_confident",
      travel_capability: "yes_reliable_transport",
      tool_budget: "employer_provides",
      income_need: "can_apprentice_wage",
      local_apprenticeship_known: "yes_found",
      willing_workplace_evidence: "yes",
    };
    const r = sanitisePublicAnswers(carpenter, answers);
    expect(r.droppedHiddenIds).toContain("local_apprenticeship_known");
  });

  it("evaluator never receives the raw hostile record", () => {
    const hostile = {
      ...validMidwifeAnswers,
      current_registration: "definitely_maybe", // invalid option
      __proto__: { poisoned: true },
    } as Record<string, unknown>;
    const r = sanitisePublicAnswers(midwife, hostile);
    // Callers should refuse to evaluate; but we prove that if we DID pass
    // the sanitised record instead, the invalid answer is absent.
    expect(r.sanitisedAnswers["current_registration"]).toBeUndefined();
    // The sanitised bag is a plain object with no unexpected keys.
    for (const k of Object.keys(r.sanitisedAnswers)) {
      expect(midwife.questionRefs.some((q) => q.id === k)).toBe(true);
    }
    // Provable: evaluate() on sanitised does not use the invalid value.
    const partial: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.sanitisedAnswers)) partial[k] = String(v);
    // Backfill required so evaluator can complete.
    partial["current_registration"] = "no";
    const result = evaluate(midwife, partial, { now: "2026-07-13T00:00:00.000Z" });
    expect(JSON.stringify(result)).not.toContain("definitely_maybe");
  });
});

describe("sanitisePublicAnswers — multi-select behaviour (contract-level)", () => {
  // No current pack ships a multi_select question; simulate one to prove the
  // contract handles it correctly for when a future pack does.
  const syntheticPack = {
    ...midwife,
    questionRefs: [
      {
        id: "colours",
        label: "Colours",
        displayLabel: "Colours",
        allowedValues: ["red", "green", "blue"],
        options: [
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "blue", label: "Blue" },
        ],
        required: true,
        moduleId: "m",
        inputKind: "multi_select" as const,
      },
      ...midwife.questionRefs,
    ],
  } as CareerDecisionPackV1;

  it("de-duplicates and sorts multi-select values", () => {
    const r = sanitisePublicAnswers(syntheticPack, { ...validMidwifeAnswers, colours: ["blue", "red", "blue", "green"] });
    expect(r.sanitisedAnswers.colours).toEqual(["blue", "green", "red"]);
  });

  it("flags invalid multi-select members", () => {
    const r = sanitisePublicAnswers(syntheticPack, { ...validMidwifeAnswers, colours: ["red", "purple"] });
    expect(r.issues.some((i) => i.code === "invalid_multi_option")).toBe(true);
    expect(r.sanitisedAnswers.colours).toEqual(["red"]);
  });

  it("flags a non-array value for a multi-select question", () => {
    const r = sanitisePublicAnswers(syntheticPack, { ...validMidwifeAnswers, colours: "red" });
    expect(r.issues.some((i) => i.code === "invalid_type" && i.questionId === "colours")).toBe(true);
  });
});
