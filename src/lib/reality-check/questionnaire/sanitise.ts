// Sanitisation for modular questionnaire answers.
//
// Enforces:
//   - Answers for questions not in the active config are dropped
//   - Exclusive options clear other selections (and vice versa)
//   - maxSelections is enforced
//   - Inline text is cleared when its trigger option is deselected

import type { AnswerMap, AnswerValue, InlineTextMap, Question } from "./types";

const asArray = (v: AnswerValue | undefined): string[] =>
  Array.isArray(v) ? v : v ? [v] : [];

const exclusiveValues = (q: Question): string[] =>
  (q.options ?? []).filter((o) => o.exclusive).map((o) => o.value);

// Apply exclusive/max rules to a single question's answer.
export const sanitiseAnswer = (q: Question, answer: AnswerValue | undefined): AnswerValue | undefined => {
  if (answer === undefined) return undefined;
  if (q.controlType === "single_select") {
    return typeof answer === "string" ? answer : undefined;
  }
  if (q.controlType === "multi_select") {
    const arr = asArray(answer);
    const exclusives = exclusiveValues(q);
    // If an exclusive value is present, drop everything else.
    const activeExclusive = arr.find((v) => exclusives.includes(v));
    let cleaned = activeExclusive ? [activeExclusive] : arr.filter((v) => !exclusives.includes(v));
    // Enforce maxSelections on non-exclusive selections.
    if (!activeExclusive && q.maxSelections && cleaned.length > q.maxSelections) {
      cleaned = cleaned.slice(0, q.maxSelections);
    }
    return cleaned;
  }
  if (q.controlType === "text") {
    return typeof answer === "string" ? answer : undefined;
  }
  return answer;
};

// When a multi_select gains a new value, this helper resolves the exclusive
// invariant: adding a non-exclusive value clears an active exclusive, and
// vice versa.
export const toggleMultiSelect = (
  q: Question,
  current: string[],
  value: string,
): string[] => {
  const exclusives = exclusiveValues(q);
  const isExclusive = exclusives.includes(value);
  const alreadySelected = current.includes(value);
  if (alreadySelected) return current.filter((v) => v !== value);
  if (isExclusive) return [value];
  const withoutExclusives = current.filter((v) => !exclusives.includes(v));
  if (q.maxSelections && withoutExclusives.length >= q.maxSelections) {
    // Do not silently drop an existing selection.
    return withoutExclusives;
  }
  return [...withoutExclusives, value];
};

// Clear inline text when its triggering option is no longer selected.
export const sanitiseInlineText = (
  questions: readonly Question[],
  answers: AnswerMap,
  inlineText: InlineTextMap,
): InlineTextMap => {
  const cleaned: InlineTextMap = {};
  for (const q of questions) {
    if (!q.conditionalField) continue;
    const answer = answers[q.id];
    const values = asArray(answer);
    const triggered = values.some((v) => q.conditionalField!.showWhenValueIn.includes(v));
    if (triggered && inlineText[q.id]) {
      cleaned[q.id] = inlineText[q.id];
    }
  }
  return cleaned;
};

// Drop answers for questions not in the active config; re-apply exclusives/max.
export const sanitiseAnswerMap = (
  questions: readonly Question[],
  answers: AnswerMap,
): AnswerMap => {
  const validIds = new Set(questions.map((q) => q.id));
  const out: AnswerMap = {};
  for (const [id, v] of Object.entries(answers)) {
    if (!validIds.has(id)) continue;
    const q = questions.find((x) => x.id === id)!;
    const sanitised = sanitiseAnswer(q, v);
    if (sanitised !== undefined) out[id] = sanitised;
  }
  return out;
};

export const isAnswered = (q: Question, answer: AnswerValue | undefined): boolean => {
  if (q.required === false) return true;
  if (answer === undefined) return false;
  if (typeof answer === "string") return answer.length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return false;
};
