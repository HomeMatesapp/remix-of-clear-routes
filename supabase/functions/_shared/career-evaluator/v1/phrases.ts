// Participant-facing phrases. Centralised so a single unit test can enforce
// the language rules from the plan: no "best route", no probability claim.

import type { RouteClassification } from "./types.ts";

export const TOP_ROUTE_PHRASE: Record<RouteClassification, string> = {
  currently_looks_most_workable:
    "Strongest supported route from your answers.",
  possible_with_trade_offs:
    "Possible, with these trade-offs.",
  requires_further_verification:
    "Currently looks workable, but requires further verification.",
  not_currently_available_to_you:
    "Does not currently look available to you.",
};

export const CONFIDENCE_PHRASE: Record<
  "comprehensive" | "adequate" | "limited",
  string
> = {
  comprehensive:
    "Evidence coverage: comprehensive. This describes how much of the pack's evidence was drawn on to reach this result — it is not a prediction of the outcome.",
  adequate:
    "Evidence coverage: adequate. This describes how much of the pack's evidence was drawn on to reach this result — it is not a prediction of the outcome.",
  limited:
    "Evidence coverage: limited. Some checks remain outstanding. This describes coverage of the evidence used to reach this result — it is not a prediction of the outcome.",
};

/**
 * Words that must never appear in generated result text. Enforced by
 * `language-safety.test.ts` for every test profile in every pack.
 */
export const FORBIDDEN_LANGUAGE = [
  "best route",
  "recommended route",
  "optimal route",
  "you will succeed",
  "success rate",
  "guaranteed",
  "probability of success",
  "certain to",
] as const;
