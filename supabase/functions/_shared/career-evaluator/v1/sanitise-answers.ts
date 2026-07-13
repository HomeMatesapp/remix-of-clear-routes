// Authoritative server-side answer sanitiser.
//
// The AUTHORITATIVE pack — never browser state — determines:
//   • which question IDs exist,
//   • the input kind of each question,
//   • the allowed values,
//   • which questions are required,
//   • conditional visibility.
//
// The sanitiser walks the pack's own questionRefs, recomputes visibility from
// declared `visibleWhen` predicates, and rebuilds the answer record entry by
// entry. Any browser-supplied `visibleWhen`, `required`, question/module
// definitions or unknown IDs are structurally discarded because we only ever
// read `rawAnswers[q.id]` for known `q`.

import type {
  AnswerMap,
  AnswerValue,
  CareerDecisionPackV1,
  Predicate,
  QuestionRef,
} from "./types.ts";

export type SanitiseErrorCode =
  | "unknown_question_ignored"
  | "invalid_type"
  | "invalid_option"
  | "invalid_multi_option"
  | "unsupported_input_kind"
  | "missing_required";

export interface SanitiseIssue {
  code: SanitiseErrorCode;
  questionId: string;
  /** Participant-safe display label (never pack internals). */
  displayLabel?: string;
}

export interface SanitiseResult {
  sanitisedAnswers: AnswerMap;
  visibleQuestionIds: readonly string[];
  droppedUnknownIds: readonly string[];
  droppedHiddenIds: readonly string[];
  issues: readonly SanitiseIssue[];
}

/** True when a predicate matches an answer. Same semantics as the evaluator. */
const matches = (answer: AnswerValue | undefined, p: Predicate): boolean => {
  if (p.op === "present") return answer !== undefined && answer !== null && answer !== "" && !(Array.isArray(answer) && answer.length === 0);
  if (p.op === "absent") return answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (answer === undefined || answer === null) return p.op === "not_in" || p.op === "neq";
  const arr = Array.isArray(answer) ? answer : [answer];
  const valArr = Array.isArray(p.value) ? p.value : p.value === undefined ? [] : [p.value];
  switch (p.op) {
    case "eq": return arr.length === 1 && arr[0] === p.value;
    case "neq": return !(arr.length === 1 && arr[0] === p.value);
    case "in": return arr.some((a) => valArr.includes(a as string));
    case "not_in": return !arr.some((a) => valArr.includes(a as string));
  }
};

const isVisible = (q: QuestionRef, current: AnswerMap): boolean => {
  if (!q.visibleWhen || q.visibleWhen.length === 0) return true;
  return q.visibleWhen.every((p) => matches(current[p.questionId], p));
};

/** Sanitise a possibly-hostile answer bag against the authoritative pack.
 *
 *  Policy:
 *    • Unknown question IDs are silently dropped (recorded in
 *      `droppedUnknownIds`). We never trust the browser to name a question.
 *    • Answers for hidden questions are dropped (recorded in
 *      `droppedHiddenIds`). Visibility is recomputed from pack `visibleWhen`,
 *      never from any browser-supplied flag.
 *    • Type-mismatched values become `invalid_type` issues; the answer is
 *      omitted so downstream code sees the question as unanswered.
 *    • Invalid select/multi-select options become `invalid_option` /
 *      `invalid_multi_option` issues; the answer is omitted.
 *    • Multi-select values are de-duplicated deterministically (first
 *      occurrence wins) and sorted for a stable evaluator input.
 *    • Required visible questions with no valid answer become
 *      `missing_required` issues; the caller decides whether to 422.
 *
 *  The evaluator MUST receive `sanitisedAnswers` only — never the raw payload. */
export const sanitisePublicAnswers = (
  pack: CareerDecisionPackV1,
  rawAnswers: unknown,
): SanitiseResult => {
  const raw: Record<string, unknown> =
    rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
      ? { ...(rawAnswers as Record<string, unknown>) }
      : {};

  const packQuestions = new Map<string, QuestionRef>();
  for (const q of pack.questionRefs) packQuestions.set(q.id, q);

  const droppedUnknownIds: string[] = [];
  for (const id of Object.keys(raw)) if (!packQuestions.has(id)) droppedUnknownIds.push(id);

  const issues: SanitiseIssue[] = [];
  const droppedHiddenIds: string[] = [];
  const sanitised: AnswerMap = {};

  // Visibility is computed against the CURRENT sanitised state so a chain of
  // dependent gates behaves predictably. Questions are processed in pack order
  // so `visibleWhen` referencing earlier questions can resolve. Any question
  // whose gate depends on a later question is evaluated against what has
  // already been sanitised (partial dependency chains are permitted only for
  // strictly-ordered forms; the publish schema does not enforce ordering).
  for (const q of pack.questionRefs) {
    if (!isVisible(q, sanitised)) {
      if (raw[q.id] !== undefined) droppedHiddenIds.push(q.id);
      continue;
    }
    const value = raw[q.id];
    if (value === undefined || value === null) continue;

    const kind = q.inputKind;
    if (!kind) {
      issues.push({ code: "unsupported_input_kind", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
      continue;
    }
    const allowed = new Set(q.allowedValues ?? []);

    if (kind === "single_select") {
      if (typeof value !== "string") {
        issues.push({ code: "invalid_type", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
        continue;
      }
      if (!allowed.has(value)) {
        issues.push({ code: "invalid_option", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
        continue;
      }
      sanitised[q.id] = value;
      continue;
    }

    if (kind === "multi_select") {
      if (!Array.isArray(value)) {
        issues.push({ code: "invalid_type", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
        continue;
      }
      const seen = new Set<string>();
      const cleaned: string[] = [];
      let hadInvalidMember = false;
      for (const v of value) {
        if (typeof v !== "string") { hadInvalidMember = true; continue; }
        if (!allowed.has(v)) { hadInvalidMember = true; continue; }
        if (seen.has(v)) continue;
        seen.add(v);
        cleaned.push(v);
      }
      if (hadInvalidMember) {
        issues.push({ code: "invalid_multi_option", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
      }
      cleaned.sort(); // deterministic
      sanitised[q.id] = cleaned;
      continue;
    }

    // Exhaustive: any future kind must add a branch above.
    issues.push({ code: "unsupported_input_kind", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
  }

  // Missing-required pass: recompute visibility over the final sanitised state
  // so late-arriving answers can un-hide requirements consistently.
  const visibleIds: string[] = [];
  for (const q of pack.questionRefs) {
    if (!isVisible(q, sanitised)) continue;
    visibleIds.push(q.id);
    if (q.required === true) {
      const v = sanitised[q.id];
      const missing = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (missing) {
        issues.push({ code: "missing_required", questionId: q.id, displayLabel: q.displayLabel ?? q.label });
      }
    }
  }

  return {
    sanitisedAnswers: sanitised,
    visibleQuestionIds: visibleIds,
    droppedUnknownIds,
    droppedHiddenIds,
    issues,
  };
};

/** Partition sanitisation issues into blocking (participant must fix) vs
 *  informational (safe to proceed and just drop). Callers should 422 on any
 *  blocking issue. */
export const hasBlockingIssues = (issues: readonly SanitiseIssue[]): boolean =>
  issues.some((i) =>
    i.code === "missing_required" ||
    i.code === "invalid_option" ||
    i.code === "invalid_type" ||
    i.code === "unsupported_input_kind"
  );
