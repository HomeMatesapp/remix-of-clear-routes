import { supabase } from "@/integrations/supabase/client";
import type {
  RealityCheckAnswers,
  RealityCheckResult,
  RoleContext,
} from "@/lib/reality-check/types";
import {
  ANSWER_SCHEMA_VERSION,
  QUESTIONNAIRE_VERSION,
  type RealityCheckAnswerSnapshotV2,
} from "@/lib/reality-check/answer-snapshot";


const PENDING_KEY = "cr_pending_decision";
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export interface DecisionAnswerSnapshot {
  startingPoint: RealityCheckAnswers["startingPoint"];
  englishMaths: RealityCheckAnswers["englishMaths"];
  qualificationLevel: RealityCheckAnswers["qualificationLevel"];
  incomeNeed: RealityCheckAnswers["incomeNeed"];
  budget: RealityCheckAnswers["budget"];
  region: RealityCheckAnswers["region"];
  area: string;
  commuteFlex: RealityCheckAnswers["commuteFlex"];
  relevantBackground: string;
}

export interface DecisionResultSnapshot {
  readiness?: RealityCheckResult["readiness"];
  readinessReason?: string;
  biggestBlocker?: string;
  immediateAction?: string;
  overallVerdict?: RealityCheckResult["overallVerdict"];
  bestRoute?: { title: string };
  backupRoute?: { title: string };
  routeToAvoid?: { title: string };
  localRealism?: { rating: "strong" | "mixed" | "weak" };
  firstMoves?: string[];
  // Preserved so reviewed modular Reality-check results round-trip through
  // save + reload and can be rendered by ModularResultView. The payload is
  // deterministic and already engine-scrubbed — no further sanitisation.
  modular?: RealityCheckResult["modular"];
  considerations?: string[];
}

export const sanitiseDecisionAnswers = (
  answers: Partial<RealityCheckAnswers>,
): DecisionAnswerSnapshot => ({
  startingPoint: answers.startingPoint ?? null,
  englishMaths: answers.englishMaths ?? null,
  qualificationLevel: answers.qualificationLevel ?? null,
  incomeNeed: answers.incomeNeed ?? null,
  budget: answers.budget ?? null,
  region: answers.region ?? null,
  area: (answers.area ?? "").trim().slice(0, 80),
  commuteFlex: answers.commuteFlex ?? null,
  // Matching only needs to know whether related experience was supplied. Do
  // not persist the user's free-text description.
  relevantBackground: (answers.relevantBackground ?? "").trim() ? "Provided" : "",
});

export const sanitiseDecisionResult = (
  result: DecisionResultSnapshot | RealityCheckResult,
): DecisionResultSnapshot => ({
  readiness: result.readiness,
  readinessReason: result.readinessReason,
  biggestBlocker: result.biggestBlocker,
  immediateAction: result.immediateAction,
  overallVerdict: result.overallVerdict,
  bestRoute: result.bestRoute?.title ? { title: result.bestRoute.title } : undefined,
  backupRoute: result.backupRoute?.title ? { title: result.backupRoute.title } : undefined,
  routeToAvoid: result.routeToAvoid?.title ? { title: result.routeToAvoid.title } : undefined,
  localRealism: result.localRealism?.rating
    ? { rating: result.localRealism.rating }
    : undefined,
  firstMoves: result.firstMoves?.slice(0, 3),
  modular: result.modular,
  considerations: result.considerations,
});


export interface PendingDecision {
  role: {
    id?: string;
    role_slug?: string;
    role_name: string;
  };
  answers: DecisionAnswerSnapshot;
  result: DecisionResultSnapshot;
  // Increment 1b: optional versioned answer snapshot. Existing pending
  // decisions written before Increment 1b (no snapshot) remain valid — the
  // saved row simply has no answer_snapshot column populated.
  answerSnapshot?: RealityCheckAnswerSnapshotV2;
  created_at: string;
}

export const stashPendingDecision = (
  role: RoleContext,
  answers: RealityCheckAnswers,
  result: RealityCheckResult,
  answerSnapshot?: RealityCheckAnswerSnapshotV2,
) => {
  const payload: PendingDecision = {
    role: { id: role.id, role_slug: role.role_slug, role_name: role.role_name },
    answers: sanitiseDecisionAnswers(answers),
    result: sanitiseDecisionResult(result),
    answerSnapshot,
    created_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
};


export const readPendingDecision = (): PendingDecision | null => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDecision;
    const createdAt = Date.parse(parsed.created_at);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingDecision = () => {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
};

export const saveDecision = async (
  userId: string,
  role: { id?: string; role_slug?: string; role_name: string },
  answers: Partial<RealityCheckAnswers>,
  result: DecisionResultSnapshot | RealityCheckResult,
  answerSnapshot?: RealityCheckAnswerSnapshotV2,
) => {
  const safeAnswers = sanitiseDecisionAnswers(answers);
  const safeResult = sanitiseDecisionResult(result);
  // Legacy compatibility columns are ALWAYS populated so old readers keep
  // working. The versioned answer_snapshot is populated when the caller
  // supplies one — new results always will; historical rows read from the DB
  // simply have it as NULL.
  // PR 2 final-gate decision: saved decisions carry an explicit
  // `evaluation_source` discriminator. Legacy engines (electrician, plumber,
  // etc.) continue to write with source = 'legacy_engine' and all pack_*
  // columns NULL — their V1 adapter output is rendering-only until the role
  // is migrated to a generic pack. Only generic-pack results ever populate
  // pack_id/pack_version/pack_content_hash/evaluator_schema_version/result_v1
  // in one atomic write, enforced by saved_decisions_source_shape_chk.
  const row: Record<string, unknown> = {
    user_id: userId,
    role_id: role.id ?? null,
    role_slug: role.role_slug ?? "",
    role_name: role.role_name,
    overall_verdict: safeResult.overallVerdict ?? null,
    best_route_title: safeResult.bestRoute?.title ?? null,
    backup_route_title: safeResult.backupRoute?.title ?? null,
    route_to_avoid_title: safeResult.routeToAvoid?.title ?? null,
    local_realism_rating: safeResult.localRealism?.rating ?? null,
    first_move: safeResult.immediateAction ?? safeResult.firstMoves?.[0] ?? null,
    input_snapshot: safeAnswers as unknown as Record<string, unknown>,
    result_snapshot: safeResult as unknown as Record<string, unknown>,
    evaluation_source: "legacy_engine",
  };
  if (answerSnapshot) {
    row.answer_schema_version = ANSWER_SCHEMA_VERSION;
    row.questionnaire_version = answerSnapshot.questionnaireVersion ?? QUESTIONNAIRE_VERSION;
    row.answer_snapshot = answerSnapshot as unknown as Record<string, unknown>;
  }
  const { data, error } = await supabase
    .from("saved_decisions")
    .insert(row as never)
    .select("id")
    .single();
  if (error) throw error;
  return data;
};


// In-flight guard to prevent duplicate saves if flush is invoked twice
// concurrently (e.g. by both an auth effect and a route effect on login).
let inFlight: Promise<boolean> | null = null;

export const flushPendingDecision = async (userId: string): Promise<boolean> => {
  if (inFlight) return inFlight;
  const pending = readPendingDecision();
  if (!pending) return false;
  if (!pending.role || !pending.role.role_name || !pending.answers || !pending.result) {
    clearPendingDecision();
    return false;
  }
  clearPendingDecision();
  inFlight = (async () => {
    try {
      await saveDecision(userId, pending.role, pending.answers, pending.result, pending.answerSnapshot);
      return true;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};


export const __resetFlushGuard = () => {
  inFlight = null;
};
