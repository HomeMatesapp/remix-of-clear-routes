// Consolidation tests for the six frozen deep-reviewed Reality Checks.
//
// These are cross-cutting assertions: every slug in FROZEN_DEEP_ROLES must
// have a registered questionnaire, a route engine (via engineId), sources
// attached, and be discoverable through the reviewed-deep gate the CTA
// depends on. If any coverage regresses, this suite fails before the app
// can ship — no per-role hand-checking required.

import { describe, expect, it } from "vitest";
import { FROZEN_DEEP_ROLES, getTaxonomyEntry } from "@/lib/roles/role-taxonomy";
import {
  hasReviewedModularRealityCheck,
  resolveConfig,
} from "./questionnaire/registry";
import {
  buildReviewedDeepSummary,
  draftKeyFor,
  formatReviewedDeepSummary,
  isReviewedDeepRole,
  registeredModularRoleSlugs,
} from "./reviewed-deep-summary";

describe("reviewed-deep consolidation", () => {
  it("FROZEN_DEEP_ROLES matches the registered modular role slugs one-to-one", () => {
    expect([...FROZEN_DEEP_ROLES].sort()).toEqual(registeredModularRoleSlugs());
  });

  it.each(FROZEN_DEEP_ROLES)(
    "%s: has a registered questionnaire + engineId + requestBodyKey",
    (slug) => {
      const cfg = resolveConfig(slug);
      expect(cfg, `resolveConfig("${slug}")`).not.toBeNull();
      expect(cfg!.engineId).toMatch(/^[a-z0-9-]+-v\d+$/);
      expect(cfg!.questionnaireVersion).toMatch(/^[a-z0-9-]+-v\d+$/);
      expect(cfg!.requestBodyKey.length).toBeGreaterThan(0);
      expect(typeof cfg!.extractSignals).toBe("function");
      expect(cfg!.questions.length).toBeGreaterThanOrEqual(5);
    },
  );

  it.each(FROZEN_DEEP_ROLES)(
    "%s: reviewed-deep gate is true and modular wizard is authorised to open",
    (slug) => {
      expect(hasReviewedModularRealityCheck(slug)).toBe(true);
      expect(isReviewedDeepRole(slug)).toBe(true);
    },
  );

  it.each(FROZEN_DEEP_ROLES)("%s: taxonomy entry records deep-reviewed depth", (slug) => {
    const t = getTaxonomyEntry(slug);
    expect(t, `taxonomy entry for ${slug}`).toBeDefined();
    expect(t!.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
    expect(t!.primaryFamily).toBeTruthy();
    expect(t!.routeArchetype).toBeTruthy();
  });

  it.each(FROZEN_DEEP_ROLES)(
    "%s: source panel has at least one evidence entry (no legacy gap)",
    (slug) => {
      const row = buildReviewedDeepSummary().find((r) => r.roleSlug === slug)!;
      expect(row.sourceCount, `${slug} sources`).toBeGreaterThan(0);
    },
  );

  it.each(FROZEN_DEEP_ROLES)("%s: draft key follows the documented shape", (slug) => {
    const cfg = resolveConfig(slug)!;
    expect(draftKeyFor(slug, cfg.questionnaireVersion)).toBe(
      `reality-check-draft:${slug}:${cfg.questionnaireVersion}`,
    );
  });

  it("summary export lists exactly the six frozen deep roles with populated fields", () => {
    const rows = buildReviewedDeepSummary();
    expect(rows.map((r) => r.roleSlug).sort()).toEqual([...FROZEN_DEEP_ROLES].sort());
    for (const r of rows) {
      expect(r.family, `${r.roleSlug} family`).toBeTruthy();
      expect(r.archetype, `${r.roleSlug} archetype`).toBeTruthy();
      expect(r.engineId).toBeTruthy();
      expect(r.questionnaireVersion).toBeTruthy();
      expect(r.draftKey).toContain(r.roleSlug);
      expect(r.questionCount).toBeGreaterThan(0);
      expect(r.sourceCount).toBeGreaterThan(0);
    }
  });

  it("formatReviewedDeepSummary renders one header row + one row per frozen role", () => {
    const text = formatReviewedDeepSummary();
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(1 + FROZEN_DEEP_ROLES.length);
    for (const slug of FROZEN_DEEP_ROLES) {
      expect(text).toContain(slug);
    }
  });
});
