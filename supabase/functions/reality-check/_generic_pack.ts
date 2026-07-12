// Edge-runtime wrapper for the shared generic career-pack evaluator.
//
// PR 1 exposes this only as a bundling-and-execution proof. PR 2 will call it
// from `index.ts` after server-side pack resolution via role_pack_bindings.
// The client NEVER supplies pack IDs; resolution is server-only.

import { evaluate } from "../_shared/career-evaluator/v1/evaluate.ts";
import { careerDecisionPackV1 } from "../_shared/career-evaluator/v1/schema.ts";
import type {
  AnswerMap,
  CareerDecisionPackV1,
  RealityCheckResultV1,
} from "../_shared/career-evaluator/v1/types.ts";

export const evaluateGenericPack = (
  packJson: unknown,
  answers: AnswerMap,
): RealityCheckResultV1 => {
  const parsed = careerDecisionPackV1.safeParse(packJson);
  if (!parsed.success) {
    throw new Error(
      "generic pack failed schema validation: " +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return evaluate(parsed.data as CareerDecisionPackV1, answers);
};
