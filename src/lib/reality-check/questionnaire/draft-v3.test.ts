// Role-scoped v3 draft persistence tests.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearModularDraft,
  invalidateLegacyDraftForRole,
  loadModularDraft,
  modularDraftKey,
  saveModularDraft,
} from "./draft-v3";

const SLUG = "electrician";
const QV = "electrician-v1";

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe("modular draft v3", () => {
  it("round-trips and uses role+questionnaire scoped keys", () => {
    saveModularDraft({
      roleSlug: SLUG,
      questionnaireVersion: QV,
      answers: { starting_point: "career_changer" },
      inlineText: {},
      stepId: "electrical_qualification",
    });
    const stored = sessionStorage.getItem(modularDraftKey(SLUG, QV));
    expect(stored).not.toBeNull();
    const loaded = loadModularDraft(SLUG, QV);
    expect(loaded?.answers.starting_point).toBe("career_changer");
    expect(loaded?.stepId).toBe("electrical_qualification");
  });

  it("never loads a draft written for a different role slug", () => {
    saveModularDraft({
      roleSlug: "software-engineer",
      questionnaireVersion: QV,
      answers: { starting_point: "career_changer" },
      inlineText: {},
      stepId: "s1",
    });
    // Load with mismatched slug/key
    expect(loadModularDraft(SLUG, QV)).toBeNull();
  });

  it("invalidates when questionnaireVersion differs", () => {
    saveModularDraft({
      roleSlug: SLUG,
      questionnaireVersion: "electrician-v0",
      answers: {},
      inlineText: {},
      stepId: "starting_point",
    });
    // The key differs, so the same slug + a different qv finds nothing.
    expect(loadModularDraft(SLUG, "electrician-v1")).toBeNull();
  });

  it("invalidateLegacyDraftForRole removes cr_rc_progress_<slug>", () => {
    sessionStorage.setItem(`cr_rc_progress_${SLUG}`, JSON.stringify({ schemaVersion: 2 }));
    invalidateLegacyDraftForRole(SLUG);
    expect(sessionStorage.getItem(`cr_rc_progress_${SLUG}`)).toBeNull();
  });

  it("clearModularDraft removes only its own key", () => {
    saveModularDraft({
      roleSlug: SLUG,
      questionnaireVersion: QV,
      answers: {},
      inlineText: {},
      stepId: "starting_point",
    });
    saveModularDraft({
      roleSlug: "other-role",
      questionnaireVersion: QV,
      answers: {},
      inlineText: {},
      stepId: "starting_point",
    });
    clearModularDraft(SLUG, QV);
    expect(loadModularDraft(SLUG, QV)).toBeNull();
    expect(loadModularDraft("other-role", QV)).not.toBeNull();
  });

  it("legacy v2 draft for a non-Electrician role is not touched", () => {
    // We do NOT invalidate legacy drafts globally — only for roles that
    // now have a modular questionnaire.
    sessionStorage.setItem(`cr_rc_progress_registered-nurse`, JSON.stringify({ schemaVersion: 2 }));
    invalidateLegacyDraftForRole(SLUG);
    expect(sessionStorage.getItem(`cr_rc_progress_registered-nurse`)).not.toBeNull();
  });
});
