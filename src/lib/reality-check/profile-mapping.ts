// Mapping helpers between the Reality-check answers and the user's
// reusable Decision Profile row (`decision_profiles`).

import {
  BUDGETS,
  COMMUTE_FLEX,
  INCOME_NEEDS,
  STARTING_POINTS,
  WEEKLY_HOURS,
  type RealityCheckAnswers,
} from "./types";

export interface DecisionProfileFields {
  area: string | null;
  starting_point: string | null;
  need_to_earn: string | null;
  weekly_hours: string | null;
  budget_band: string | null;
  commute_flexibility: string | null;
}

export const emptyProfileFields: DecisionProfileFields = {
  area: null,
  starting_point: null,
  need_to_earn: null,
  weekly_hours: null,
  budget_band: null,
  commute_flexibility: null,
};

function matchEnum<T extends string>(
  options: { value: T; label: string }[],
  v: string | null | undefined,
): T | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  const byValue = options.find((o) => o.value === trimmed);
  if (byValue) return byValue.value;
  const lower = trimmed.toLowerCase();
  const byLabel = options.find((o) => o.label.toLowerCase() === lower);
  return byLabel ? byLabel.value : null;
}

export function profileToAnswers(
  p: DecisionProfileFields,
  base: RealityCheckAnswers,
): RealityCheckAnswers {
  return {
    ...base,
    area: p.area ?? base.area,
    startingPoint: matchEnum(STARTING_POINTS, p.starting_point) ?? base.startingPoint,
    incomeNeed: matchEnum(INCOME_NEEDS, p.need_to_earn) ?? base.incomeNeed,
    weeklyHours: matchEnum(WEEKLY_HOURS, p.weekly_hours) ?? base.weeklyHours,
    budget: matchEnum(BUDGETS, p.budget_band) ?? base.budget,
    commuteFlex: matchEnum(COMMUTE_FLEX, p.commute_flexibility) ?? base.commuteFlex,
  };
}

export function answersToProfile(a: RealityCheckAnswers): DecisionProfileFields {
  return {
    // Free-text town stored alongside the closed-enum region (region isn't
    // persisted to decision_profiles yet — added when the column lands).
    area: a.area.trim() || null,
    starting_point: a.startingPoint,
    need_to_earn: a.incomeNeed,
    weekly_hours: a.weeklyHours,
    budget_band: a.budget,
    commute_flexibility: a.commuteFlex,
  };
}

export function hasAnyProfileField(p: DecisionProfileFields | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.area || p.starting_point || p.need_to_earn || p.weekly_hours || p.budget_band || p.commute_flexibility,
  );
}

export function profilesDiffer(a: DecisionProfileFields, b: DecisionProfileFields): boolean {
  const k: (keyof DecisionProfileFields)[] = [
    "area",
    "starting_point",
    "need_to_earn",
    "weekly_hours",
    "budget_band",
    "commute_flexibility",
  ];
  return k.some((key) => (a[key] ?? "") !== (b[key] ?? ""));
}
