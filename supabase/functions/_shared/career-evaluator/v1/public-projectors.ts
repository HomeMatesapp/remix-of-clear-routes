// Server-side projectors that reduce authoritative pack + binding rows into
// the narrow participant-safe contract shipped to the browser.
//
// These are the ONLY shapes the browser is allowed to see for a live pack.
// Every field is explicitly listed; unknown internal fields are structurally
// impossible to leak because we build the output object key-by-key.

import type {
  CareerDecisionPackV1,
  PublicQuestionInputKind,
  Predicate,
} from "./types.ts";
import { CANONICAL_EVALUATOR_SCHEMA_VERSION } from "./types.ts";

// ── Metadata ──────────────────────────────────────────────────────────────

export interface PublicPackServingStatus {
  status: "published" | "review_due";
  reviewDueAt: string | null;
}

export interface PublicPackBindingInput {
  slug: string;
  packVersion: string;
  status: string;
  reviewDueAt: string | null;
  geographicScope: readonly string[];
}

export interface PublicPackMetadata {
  slug: string;
  packVersion: string;
  evaluatorSchemaVersion: typeof CANONICAL_EVALUATOR_SCHEMA_VERSION;
  geographicScope: readonly string[];
  status: string;
  reviewDueAt: string | null;
}

/** Approved list of participant-facing metadata keys. Any additional key that
 *  appears at runtime must be added here AND to the contract tests. */
export const PUBLIC_PACK_METADATA_KEYS = [
  "slug",
  "packVersion",
  "evaluatorSchemaVersion",
  "geographicScope",
  "status",
  "reviewDueAt",
] as const;

export const buildPublicPackMetadata = (binding: PublicPackBindingInput): PublicPackMetadata => ({
  slug: binding.slug,
  packVersion: binding.packVersion,
  evaluatorSchemaVersion: CANONICAL_EVALUATOR_SCHEMA_VERSION,
  geographicScope: binding.geographicScope,
  status: binding.status,
  reviewDueAt: binding.reviewDueAt,
});

// ── Questionnaire ─────────────────────────────────────────────────────────

export interface PublicQuestionOption { value: string; label: string; description?: string }
export interface PublicVisibleWhen { questionId: string; op: "eq" | "neq" | "in" | "not_in" | "present" | "absent"; value?: unknown }
export interface PublicQuestion {
  id: string;
  moduleId: string;
  displayLabel: string;
  helpText?: string;
  helpTextLong?: string;
  inputKind: PublicQuestionInputKind;
  required: boolean;
  options: readonly PublicQuestionOption[];
  visibleWhen?: readonly PublicVisibleWhen[];
  displayOrder: number;
}

export interface PublicQuestionModule { id: string; title: string; description?: string }

export interface PublicQuestionnaire {
  contractVersion: "public-questionnaire/v1";
  slug: string;
  packVersion: string;
  canonicalTitle: string;
  participantTitle: string;
  participantIntroduction: string;
  whatItCovers: readonly string[];
  whatItCannotConfirm: readonly string[];
  geographicScope: readonly string[];
  status: string;
  reviewDueAt: string | null;
  modules: readonly PublicQuestionModule[];
  questions: readonly PublicQuestion[];
}

const projectVisibleWhen = (v: readonly Predicate[] | undefined): readonly PublicVisibleWhen[] | undefined => {
  if (!v || v.length === 0) return undefined;
  return v.map((p) => {
    const out: PublicVisibleWhen = { questionId: p.questionId, op: p.op };
    if (p.value !== undefined) out.value = p.value;
    return out;
  });
};

export const buildPublicQuestionnaire = (
  pack: CareerDecisionPackV1,
  binding: PublicPackBindingInput,
): PublicQuestionnaire => {
  if (!pack.careerIdentity.introduction || !pack.careerIdentity.whatItCovers || !pack.careerIdentity.whatItCannotConfirm) {
    throw new Error("pack is missing participant introduction/coverage — refusing to project");
  }
  const modules = (pack.questionModules ?? []).map((m) => {
    const out: PublicQuestionModule = { id: m.id, title: m.title };
    if (m.description !== undefined) out.description = m.description;
    return out;
  });
  const questions = pack.questionRefs.map((q, i): PublicQuestion => {
    if (!q.moduleId) throw new Error(`question ${q.id} missing moduleId — refusing to project`);
    if (!q.displayLabel) throw new Error(`question ${q.id} missing displayLabel — refusing to project`);
    if (!q.inputKind) throw new Error(`question ${q.id} missing inputKind — refusing to project`);
    if (q.required === undefined) throw new Error(`question ${q.id} missing required — refusing to project`);
    const options = (q.options ?? []).map((o) => {
      const out: PublicQuestionOption = { value: o.value, label: o.label };
      if (o.description !== undefined) out.description = o.description;
      return out;
    });
    const out: PublicQuestion = {
      id: q.id,
      moduleId: q.moduleId,
      displayLabel: q.displayLabel,
      inputKind: q.inputKind,
      required: q.required,
      options,
      displayOrder: i,
    };
    if (q.helpText !== undefined) out.helpText = q.helpText;
    if (q.helpTextLong !== undefined) out.helpTextLong = q.helpTextLong;
    const vw = projectVisibleWhen(q.visibleWhen);
    if (vw) out.visibleWhen = vw;
    return out;
  });
  return {
    contractVersion: "public-questionnaire/v1",
    slug: pack.slug,
    packVersion: pack.packVersion,
    canonicalTitle: pack.careerIdentity.canonicalTitle,
    participantTitle: pack.careerIdentity.participantTitle,
    participantIntroduction: pack.careerIdentity.introduction,
    whatItCovers: [...pack.careerIdentity.whatItCovers],
    whatItCannotConfirm: [...pack.careerIdentity.whatItCannotConfirm],
    geographicScope: binding.geographicScope,
    status: binding.status,
    reviewDueAt: binding.reviewDueAt,
    modules,
    questions,
  };
};
