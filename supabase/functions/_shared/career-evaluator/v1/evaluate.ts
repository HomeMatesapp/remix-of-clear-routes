// Pure deterministic evaluator. No runtime-specific imports.
//
// Contract: evaluate(pack, answers) -> RealityCheckResultV1.
// Ordering, wording and classification are fully determined by the pack rules
// and the answers. Same inputs always produce the same output.

import type {
  AnswerMap,
  AnswerValue,
  CareerDecisionPackV1,
  ImmediateAction,
  Predicate,
  RealityCheckResultV1,
  RouteClassification,
  RouteEvaluation,
} from "./types.ts";
import { CONFIDENCE_PHRASE, TOP_ROUTE_PHRASE } from "./phrases.ts";

const answerMatches = (answer: AnswerValue | undefined, p: Predicate): boolean => {
  if (p.op === "present") return answer !== undefined && answer !== null && answer !== "" && !(Array.isArray(answer) && answer.length === 0);
  if (p.op === "absent") return answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (answer === undefined || answer === null) return p.op === "not_in" || p.op === "neq";
  const asArray = Array.isArray(answer) ? answer : [answer];
  const valArray = Array.isArray(p.value) ? p.value : p.value === undefined ? [] : [p.value];
  switch (p.op) {
    case "eq":     return asArray.length === 1 && asArray[0] === p.value;
    case "neq":    return !(asArray.length === 1 && asArray[0] === p.value);
    case "in":     return asArray.some((a) => valArray.includes(a as string));
    case "not_in": return !asArray.some((a) => valArray.includes(a as string));
  }
};

const classify = (
  concerns: number,
  verifications: number,
  blocked: boolean,
  isTop: boolean,
): RouteClassification => {
  if (blocked) return "not_currently_available_to_you";
  if (verifications > 0 && concerns === 0 && isTop) return "requires_further_verification";
  if (concerns > 0) return "possible_with_trade_offs";
  if (isTop) return "currently_looks_most_workable";
  return "possible_with_trade_offs";
};

/** Deterministic ranking: fewer blockers → fewer concerns → fewer verifications → stable route order. */
const scoreRoute = (r: {
  blocked: boolean;
  concerns: number;
  verifications: number;
  index: number;
}): number => {
  return (
    (r.blocked ? 1_000_000 : 0) +
    r.concerns * 1_000 +
    r.verifications * 10 +
    r.index // stable tie-break
  );
};

export interface EvaluateOptions {
  /** ISO datetime; injectable so tests are deterministic. */
  now?: string;
}

export const evaluate = (
  pack: CareerDecisionPackV1,
  answers: AnswerMap,
  opts: EvaluateOptions = {},
): RealityCheckResultV1 => {
  // Per-route accumulators
  const perRoute: Record<string, {
    blocked: boolean;
    supportingReasons: string[];
    concerns: string[];
    verifications: string[];
    evidenceRefs: Set<string>;
    actions: string[];
  }> = {};
  for (const r of pack.routes) {
    perRoute[r.id] = {
      blocked: false,
      supportingReasons: [r.summary],
      concerns: [],
      verifications: [],
      evidenceRefs: new Set(r.evidenceRefs),
      actions: [],
    };
  }

  const considerations: string[] = [];
  const globalActions = new Set<string>();

  for (const rule of pack.rules) {
    const allMatch = rule.when.all.every((p) => answerMatches(answers[p.questionId], p));
    if (!allMatch) continue;
    for (const eff of rule.then) {
      switch (eff.kind) {
        case "block_route": {
          const bucket = perRoute[eff.routeId]; if (!bucket) break;
          bucket.blocked = true;
          bucket.concerns.push(eff.reason);
          for (const e of eff.evidenceRefs) bucket.evidenceRefs.add(e);
          break;
        }
        case "flag_concern": {
          const bucket = perRoute[eff.routeId]; if (!bucket) break;
          bucket.concerns.push(eff.concern);
          for (const e of eff.evidenceRefs) bucket.evidenceRefs.add(e);
          break;
        }
        case "require_verification": {
          const bucket = perRoute[eff.routeId]; if (!bucket) break;
          bucket.verifications.push(eff.check);
          for (const e of eff.evidenceRefs) bucket.evidenceRefs.add(e);
          break;
        }
        case "add_action": {
          if (eff.routeId && perRoute[eff.routeId]) perRoute[eff.routeId].actions.push(eff.actionTemplateId);
          else globalActions.add(eff.actionTemplateId);
          break;
        }
        case "add_consideration": {
          considerations.push(eff.text);
          break;
        }
      }
    }
  }

  // Rank
  const scored = pack.routes.map((r, index) => ({
    route: r,
    index,
    bucket: perRoute[r.id],
    score: scoreRoute({
      blocked: perRoute[r.id].blocked,
      concerns: perRoute[r.id].concerns.length,
      verifications: perRoute[r.id].verifications.length,
      index,
    }),
  }));
  scored.sort((a, b) => a.score - b.score);

  const topId = scored[0]?.route.id;

  const routes: RouteEvaluation[] = scored.map(({ route, bucket }) => ({
    routeId: route.id,
    routeTitle: route.title,
    classification: classify(bucket.concerns.length, bucket.verifications.length, bucket.blocked, route.id === topId),
    supportingReasons: bucket.supportingReasons,
    concerns: bucket.concerns,
    verificationsRequired: bucket.verifications,
    evidenceRefs: [...bucket.evidenceRefs].sort(),
  }));

  // Evidence coverage: proportion of pack question IDs answered.
  const answered = pack.questionRefs.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && a !== "" && !(Array.isArray(a) && a.length === 0);
  }).length;
  const total = pack.questionRefs.length;
  const coverageLevel: "comprehensive" | "adequate" | "limited" =
    total === 0 ? "limited" : answered / total >= 0.85 ? "comprehensive" : answered / total >= 0.5 ? "adequate" : "limited";

  // Immediate actions: dedupe by template id, preserve pack order.
  const actionIds = new Set<string>();
  for (const id of globalActions) actionIds.add(id);
  for (const r of scored) for (const id of r.bucket.actions) actionIds.add(id);
  const immediateActions: ImmediateAction[] = pack.actionTemplates
    .filter((t) => actionIds.has(t.id))
    .map((t) => ({
      actionTemplateId: t.id,
      title: t.title,
      description: t.description,
      evidenceRefs: t.evidenceRefs,
    }));

  const topClass = routes[0]?.classification ?? "requires_further_verification";
  const limitations: string[] = [];
  if (pack.careerIdentity.geographicScope.length === 1 && pack.careerIdentity.geographicScope[0] === "England") {
    limitations.push("This Reality Check has been researched for England only. Rules, funding and regulators differ elsewhere in the UK.");
  }
  if (coverageLevel !== "comprehensive") {
    limitations.push("Some answers were left blank. Filling them in may change which route currently looks most workable.");
  }

  return {
    schemaVersion: "reality-check-result/v1",
    packVersion: pack.packVersion,
    roleId: pack.roleId,
    slug: pack.slug,
    evaluatedAt: opts.now ?? new Date().toISOString(),
    geographicScope: pack.careerIdentity.geographicScope,
    regulatoryStatus: pack.careerIdentity.regulatory.status,
    routes,
    considerations,
    immediateActions,
    evidenceCoverage: {
      level: coverageLevel,
      completedAnswerCount: answered,
      totalAnswerCount: total,
      note: CONFIDENCE_PHRASE[coverageLevel],
    },
    limitations,
    participantLanguage: {
      topRoutePhrase: TOP_ROUTE_PHRASE[topClass],
      confidencePhrase: CONFIDENCE_PHRASE[coverageLevel],
    },
  };
};
