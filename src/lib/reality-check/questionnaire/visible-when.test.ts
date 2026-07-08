// Tests for the visibleWhen visibility gate — added after QA found that
// mastersSubjectQuestion was being shown to non-masters users because the
// modular wizard had no whole-question visibility mechanism.
import { describe, it, expect } from "vitest";
import {
  getVisibleQuestions,
  isQuestionVisible,
  sanitiseAnswerMap,
} from "@/lib/reality-check/questionnaire/sanitise";
import type { Question } from "@/lib/reality-check/questionnaire/types";
import { softwareEngineerConfig } from "@/lib/reality-check/questionnaire/roles/software-engineer";

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  phase: "qualifications",
  title: id,
  whyWeAsk: "why",
  controlType: "single_select",
  options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  ...extra,
});

describe("visibleWhen gate", () => {
  it("hides a question when its gate value is not selected", () => {
    const questions = [
      q("hq"),
      q("follow_up", { visibleWhen: { questionId: "hq", valueIn: ["yes"] } }),
    ];
    expect(isQuestionVisible(questions[1], { hq: "no" })).toBe(false);
    expect(isQuestionVisible(questions[1], { hq: "yes" })).toBe(true);
    expect(getVisibleQuestions(questions, { hq: "no" }).map((x) => x.id)).toEqual(["hq"]);
  });

  it("sanitiseAnswerMap drops answers for hidden questions", () => {
    const questions = [
      q("hq"),
      q("follow_up", { visibleWhen: { questionId: "hq", valueIn: ["yes"] } }),
    ];
    const out = sanitiseAnswerMap(questions, { hq: "no", follow_up: "yes" });
    expect(out).toEqual({ hq: "no" });
  });

  it("mastersSubjectQuestion is only visible when highest_qualification=masters_plus", () => {
    const q = softwareEngineerConfig.questions.find((x) => x.id === "masters_subject")!;
    expect(q.visibleWhen).toEqual({ questionId: "highest_qualification", valueIn: ["masters_plus"] });
    expect(isQuestionVisible(q, { highest_qualification: "gcse" })).toBe(false);
    expect(isQuestionVisible(q, { highest_qualification: "bachelors_non_cs" })).toBe(false);
    expect(isQuestionVisible(q, { highest_qualification: "masters_plus" })).toBe(true);
  });

  it("Software Engineer non-masters answers never reach signals with a stale masters_subject", () => {
    const answers = {
      highest_qualification: "gcse",
      masters_subject: "computing", // stale from a previous selection
      starting_point: "recently_left_education",
    };
    const clean = sanitiseAnswerMap(softwareEngineerConfig.questions, answers);
    expect(clean.masters_subject).toBeUndefined();
    expect(clean.highest_qualification).toBe("gcse");
  });
});
