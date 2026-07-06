// Role-scoped v3 draft persistence for modular questionnaires.
//
// Keyed by role slug AND questionnaire version so:
//   - starting a Reality Check for one role cannot overwrite another role's draft
//   - a questionnaire content bump (e.g. electrician-v1 → electrician-v2)
//     invalidates only that flow, not every draft
//   - legacy (`cr_rc_progress_${slug}`) v2 drafts remain untouched for
//     non-Electrician roles.

import type { AnswerMap, InlineTextMap } from "./types";

export const MODULAR_DRAFT_SCHEMA_VERSION = 3 as const;
export const MODULAR_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface ModularDraftV3 {
  schemaVersion: 3;
  roleSlug: string;
  questionnaireVersion: string;
  answers: AnswerMap;
  inlineText: InlineTextMap;
  stepId: string;
  savedAt: number;
}

export const modularDraftKey = (roleSlug: string, questionnaireVersion: string): string =>
  `reality-check-draft:${roleSlug}:${questionnaireVersion}`;

export const loadModularDraft = (
  roleSlug: string,
  questionnaireVersion: string,
): ModularDraftV3 | null => {
  try {
    const raw = sessionStorage.getItem(modularDraftKey(roleSlug, questionnaireVersion));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModularDraftV3>;
    if (parsed?.schemaVersion !== MODULAR_DRAFT_SCHEMA_VERSION) {
      sessionStorage.removeItem(modularDraftKey(roleSlug, questionnaireVersion));
      return null;
    }
    // Never cross roles or questionnaire versions, even if the key somehow matched.
    if (parsed.roleSlug !== roleSlug) {
      sessionStorage.removeItem(modularDraftKey(roleSlug, questionnaireVersion));
      return null;
    }
    if (parsed.questionnaireVersion !== questionnaireVersion) {
      sessionStorage.removeItem(modularDraftKey(roleSlug, questionnaireVersion));
      return null;
    }
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : NaN;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MODULAR_DRAFT_TTL_MS) {
      sessionStorage.removeItem(modularDraftKey(roleSlug, questionnaireVersion));
      return null;
    }
    return {
      schemaVersion: 3,
      roleSlug,
      questionnaireVersion,
      answers: (parsed.answers ?? {}) as AnswerMap,
      inlineText: (parsed.inlineText ?? {}) as InlineTextMap,
      stepId: parsed.stepId ?? "",
      savedAt,
    };
  } catch {
    return null;
  }
};

export const saveModularDraft = (draft: Omit<ModularDraftV3, "schemaVersion" | "savedAt">): void => {
  try {
    const full: ModularDraftV3 = {
      schemaVersion: 3,
      savedAt: Date.now(),
      ...draft,
    };
    sessionStorage.setItem(modularDraftKey(draft.roleSlug, draft.questionnaireVersion), JSON.stringify(full));
  } catch {
    /* ignore */
  }
};

export const clearModularDraft = (roleSlug: string, questionnaireVersion: string): void => {
  try {
    sessionStorage.removeItem(modularDraftKey(roleSlug, questionnaireVersion));
  } catch {
    /* ignore */
  }
};

/**
 * Update the persisted stepId on the current modular draft, if any exists.
 * Used when the user clicks a missing-information "Edit" link on the result
 * screen so the wizard re-hydrates directly at that question.
 * No-op if there is no live draft for this role/version.
 */
export const updateModularDraftStepId = (
  roleSlug: string,
  questionnaireVersion: string,
  stepId: string,
): void => {
  try {
    const existing = loadModularDraft(roleSlug, questionnaireVersion);
    if (!existing) return;
    saveModularDraft({
      roleSlug,
      questionnaireVersion,
      answers: existing.answers,
      inlineText: existing.inlineText,
      stepId,
    });
  } catch {
    /* ignore */
  }
};



// Invalidate any legacy v2 (`cr_rc_progress_${slug}`) draft for a role now
// covered by a modular questionnaire — its question set no longer matches.
export const invalidateLegacyDraftForRole = (roleSlug: string): void => {
  try {
    sessionStorage.removeItem(`cr_rc_progress_${roleSlug}`);
  } catch {
    /* ignore */
  }
};
