// Public entry point for the shared career evaluator.
// Consumers should import from "@shared/career-evaluator/v1".

export * from "./types.ts";
export * from "./regulatory.ts";
export * from "./phrases.ts";
export { evaluate } from "./evaluate.ts";
export { careerDecisionPackV1, validatePackCrossRefs } from "./schema.ts";
