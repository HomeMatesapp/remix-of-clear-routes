// Basic recommendation helper. Today this only derives lightweight signals
// (preferred pathway key, time/budget pressure flags) that the edge function
// feeds into the AI prompt. Over time these can become fully deterministic
// rules that bypass the model for clear-cut cases.

import type {
  RealityCheckAnswers,
  StartingPoint,
} from "./types";

export type PathwayKey =
  | "school_leaver"
  | "graduate"
  | "adjacent"
  | "no_background";

const startingToPathway: Record<StartingPoint, PathwayKey> = {
  school_leaver:  "school_leaver",
  graduate:       "graduate",
  career_changer: "adjacent",
  adjacent:       "adjacent",
  no_background:  "no_background",
};

export function preferredPathway(a: RealityCheckAnswers): PathwayKey | null {
  if (!a.startingPoint) return null;
  return startingToPathway[a.startingPoint];
}

export interface PressureSignals {
  timePressure: "low" | "medium" | "high";
  budgetPressure: "low" | "medium" | "high";
  needsRemote: boolean;
  needsIncomeNow: boolean;
}

export function pressureSignals(a: RealityCheckAnswers): PressureSignals {
  const timePressure: PressureSignals["timePressure"] =
    a.weeklyHours === "0_5"
      ? "high"
      : a.weeklyHours === "5_10"
      ? "medium"
      : "low";

  const budgetPressure: PressureSignals["budgetPressure"] =
    a.budget === "zero" || a.budget === "under_500"
      ? "high"
      : a.budget === "500_2000"
      ? "medium"
      : "low";

  return {
    timePressure,
    budgetPressure,
    needsRemote: a.commuteFlex === "remote_only",
    needsIncomeNow: a.incomeNeed === "need_income",
  };
}

// Render answers in a compact, model-friendly bullet list.
export function summariseAnswers(a: RealityCheckAnswers): string {
  const lines: string[] = [];
  if (a.startingPoint) lines.push(`- Starting point: ${a.startingPoint}`);
  if (a.incomeNeed)    lines.push(`- Income need: ${a.incomeNeed}`);
  if (a.weeklyHours)   lines.push(`- Weekly hours available: ${a.weeklyHours}`);
  if (a.budget)        lines.push(`- Budget: ${a.budget}`);
  if (a.area)          lines.push(`- Area: ${a.area}`);
  if (a.commuteFlex)   lines.push(`- Commute / relocation: ${a.commuteFlex}`);
  if (a.notes)         lines.push(`- Other notes: ${a.notes}`);
  return lines.join("\n");
}
