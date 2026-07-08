import { describe, it, expect } from "vitest";
import {
  ROLE_TAXONOMY,
  ROUTE_FAMILIES,
  ROUTE_ARCHETYPES,
  FROZEN_DEEP_ROLES,
  getTaxonomyEntry,
  rubricScore,
  priorityFromScore,
  summarise,
} from "./role-taxonomy";

const FAMILIES = new Set<string>(ROUTE_FAMILIES);
const ARCHETYPES = new Set<string>(ROUTE_ARCHETYPES);
const DEPTHS = new Set([
  "standard_role_page",
  "light_route_checker",
  "deep_reviewed_reality_check",
]);
const PRIORITIES = new Set([
  "not_priority",
  "possible_later",
  "strong_candidate",
  "top_candidate",
]);

describe("role taxonomy structure", () => {
  it("classifies every DB role (1245)", () => {
    expect(ROLE_TAXONOMY.length).toBeGreaterThanOrEqual(1245);
  });

  it("every entry has a valid primaryFamily", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(FAMILIES.has(e.primaryFamily)).toBe(true);
      if (e.secondaryFamily) expect(FAMILIES.has(e.secondaryFamily)).toBe(true);
    }
  });

  it("every entry has a valid routeArchetype", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(ARCHETYPES.has(e.routeArchetype)).toBe(true);
      if (e.secondaryArchetype)
        expect(ARCHETYPES.has(e.secondaryArchetype)).toBe(true);
    }
  });

  it("every entry has a valid depth", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(DEPTHS.has(e.recommendedRealityCheckDepth)).toBe(true);
    }
  });

  it("every entry has a valid rubric", () => {
    for (const e of ROLE_TAXONOMY) {
      const r = e.deepCheckRubric;
      expect(typeof r.regulated).toBe("boolean");
      expect(typeof r.expensiveWrongTurn).toBe("boolean");
      expect([0, 1, 2]).toContain(r.routeConfusion);
      expect([0, 1, 2]).toContain(r.demandLikely);
      expect(typeof r.highConsequenceAdvice).toBe("boolean");
    }
  });

  it("every entry has a valid priority + confidence", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(PRIORITIES.has(e.deepCheckPriority)).toBe(true);
      expect(["high", "needs_review"]).toContain(e.confidence);
    }
  });

  it("no notes field exceeds 200 characters", () => {
    for (const e of ROLE_TAXONOMY) {
      if (e.notes !== undefined) expect(e.notes.length).toBeLessThanOrEqual(200);
    }
  });

  it("has no duplicate slugs", () => {
    const seen = new Set<string>();
    for (const e of ROLE_TAXONOMY) {
      expect(seen.has(e.roleSlug)).toBe(false);
      seen.add(e.roleSlug);
    }
  });
});

describe("rubric → priority derivation", () => {
  it("scores match the derived priority for every entry", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(e.deepCheckPriority).toBe(
        priorityFromScore(rubricScore(e.deepCheckRubric)),
      );
    }
  });
});

describe("depth strictness", () => {
  it("only frozen roles get deep_reviewed_reality_check", () => {
    const deep = ROLE_TAXONOMY.filter(
      (e) => e.recommendedRealityCheckDepth === "deep_reviewed_reality_check",
    );
    const deepSlugs = deep.map((e) => e.roleSlug).sort();
    expect(deepSlugs).toEqual([...FROZEN_DEEP_ROLES].sort());
  });
});

describe("frozen reviewed roles", () => {
  it("Electrician is in skilled_trades with deep depth", () => {
    const e = getTaxonomyEntry("electrician");
    expect(e).toBeDefined();
    expect(e!.primaryFamily).toBe("skilled_trades");
    expect(e!.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
  it("Plumber is in skilled_trades with deep depth", () => {
    const e = getTaxonomyEntry("plumber");
    expect(e).toBeDefined();
    expect(e!.primaryFamily).toBe("skilled_trades");
    expect(e!.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
  it("HVAC keeps slug 'hvac-engineer', name 'Heating & ventilation engineer', deep depth", () => {
    const e = getTaxonomyEntry("hvac-engineer");
    expect(e).toBeDefined();
    expect(e!.roleName.toLowerCase()).toContain("heating");
    expect(e!.roleName.toLowerCase()).toContain("ventilation");
    expect(e!.primaryFamily).toBe("skilled_trades");
    expect(e!.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
});

describe("summary + shortlist", () => {
  const summary = summarise();

  it("shortlist has 15–25 roles", () => {
    expect(summary.shortlist.length).toBeGreaterThanOrEqual(15);
    expect(summary.shortlist.length).toBeLessThanOrEqual(25);
  });

  it("shortlist excludes frozen roles", () => {
    const frozen = new Set<string>(FROZEN_DEEP_ROLES);
    for (const e of summary.shortlist) expect(frozen.has(e.roleSlug)).toBe(false);
  });

  it("shortlist entries are all top_candidate priority", () => {
    for (const e of summary.shortlist) {
      expect(e.deepCheckPriority).toBe("top_candidate");
    }
  });

  it("shortlist is ranked by rubric score descending", () => {
    for (let i = 1; i < summary.shortlist.length; i++) {
      const prev = rubricScore(summary.shortlist[i - 1].deepCheckRubric);
      const cur = rubricScore(summary.shortlist[i].deepCheckRubric);
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("family counts sum to total roles", () => {
    const total = Object.values(summary.byFamily).reduce((a, b) => a + b, 0);
    expect(total).toBe(summary.totalRoles);
  });

  it("no family is empty (undersized signal) or > 250 (oversized signal)", () => {
    // Soft-fail signals as informational — enforce loose bounds only
    for (const [fam, count] of Object.entries(summary.byFamily)) {
      expect(count, `${fam} count`).toBeGreaterThan(0);
      expect(count, `${fam} count`).toBeLessThanOrEqual(250);
    }
  });
});
