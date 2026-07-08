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
    }
  });

  it("every entry has a valid depth", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(DEPTHS.has(e.recommendedRealityCheckDepth)).toBe(true);
    }
  });

  it("every entry has a valid rubric including productProofValue", () => {
    for (const e of ROLE_TAXONOMY) {
      const r = e.deepCheckRubric;
      expect(typeof r.regulated).toBe("boolean");
      expect(typeof r.expensiveWrongTurn).toBe("boolean");
      expect([0, 1, 2]).toContain(r.routeConfusion);
      expect([0, 1, 2]).toContain(r.demandLikely);
      expect(typeof r.highConsequenceAdvice).toBe("boolean");
      expect([0, 1, 2]).toContain(r.productProofValue);
    }
  });

  it("every entry has a valid priority + confidence", () => {
    for (const e of ROLE_TAXONOMY) {
      expect(PRIORITIES.has(e.deepCheckPriority)).toBe(true);
      expect(["high", "needs_review"]).toContain(e.confidence);
    }
  });

  it("no notes exceed 200 characters", () => {
    for (const e of ROLE_TAXONOMY) {
      expect((e.notes ?? "").length, e.roleSlug).toBeLessThanOrEqual(200);
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

  it("productProofValue contributes 2x to the score", () => {
    const base = {
      regulated: false,
      expensiveWrongTurn: false,
      routeConfusion: 0 as const,
      demandLikely: 0 as const,
      highConsequenceAdvice: false,
      productProofValue: 0 as const,
    };
    expect(rubricScore(base)).toBe(0);
    expect(rubricScore({ ...base, productProofValue: 1 })).toBe(2);
    expect(rubricScore({ ...base, productProofValue: 2 })).toBe(4);
  });

  it("max possible score is 14", () => {
    const max = rubricScore({
      regulated: true,
      expensiveWrongTurn: true,
      routeConfusion: 2,
      demandLikely: 2,
      highConsequenceAdvice: true,
      productProofValue: 2,
    });
    expect(max).toBe(14);
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
    const e = getTaxonomyEntry("electrician")!;
    expect(e.primaryFamily).toBe("skilled_trades");
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
  it("Plumber is in skilled_trades with deep depth", () => {
    const e = getTaxonomyEntry("plumber")!;
    expect(e.primaryFamily).toBe("skilled_trades");
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
  it("HVAC keeps slug 'hvac-engineer', deep depth", () => {
    const e = getTaxonomyEntry("hvac-engineer")!;
    expect(e.roleName.toLowerCase()).toContain("heating");
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
});

describe("summary + shortlists", () => {
  const summary = summarise();

  it("overallTop25 has 15–25 roles and excludes frozen", () => {
    expect(summary.overallTop25.length).toBeGreaterThanOrEqual(15);
    expect(summary.overallTop25.length).toBeLessThanOrEqual(25);
    const frozen = new Set<string>(FROZEN_DEEP_ROLES);
    for (const e of summary.overallTop25) expect(frozen.has(e.roleSlug)).toBe(false);
  });

  it("overallTop25 is ranked by rubric score descending", () => {
    for (let i = 1; i < summary.overallTop25.length; i++) {
      const prev = summary.overallTop25[i - 1].score;
      const cur = summary.overallTop25[i].score;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("overallTop25 entries all have top_candidate priority", () => {
    for (const e of summary.overallTop25) {
      expect(e.deepCheckPriority).toBe("top_candidate");
    }
  });

  it("every overallTop25 entry has a rubric-based justification and trades-diff note", () => {
    for (const e of summary.overallTop25) {
      expect(e.whyCandidate).toContain(`Score ${e.score}/14`);
      expect(e.differentFromTradesModule.length).toBeGreaterThan(20);
    }
  });

  it("balancedTop25 caps each primaryFamily at 3", () => {
    const counts: Record<string, number> = {};
    for (const e of summary.balancedTop25) {
      counts[e.primaryFamily] = (counts[e.primaryFamily] ?? 0) + 1;
    }
    for (const [fam, n] of Object.entries(counts)) {
      expect(n, `${fam} in balancedTop25`).toBeLessThanOrEqual(3);
    }
    expect(summary.balancedTop25.length).toBeLessThanOrEqual(25);
    expect(summary.balancedTop25.length).toBeGreaterThanOrEqual(10);
  });

  it("balancedTop25 draws from more distinct families than overallTop25", () => {
    const overallFams = new Set(summary.overallTop25.map((e) => e.primaryFamily));
    const balancedFams = new Set(summary.balancedTop25.map((e) => e.primaryFamily));
    expect(balancedFams.size).toBeGreaterThanOrEqual(overallFams.size);
  });

  it("strategicProofShortlist has 10–15 roles, excludes frozen, all with productProofValue >= 1", () => {
    const list = summary.strategicProofShortlist;
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.length).toBeLessThanOrEqual(15);
    const frozen = new Set<string>(FROZEN_DEEP_ROLES);
    for (const e of list) {
      expect(frozen.has(e.roleSlug)).toBe(false);
      expect(e.deepCheckRubric.productProofValue).toBeGreaterThanOrEqual(1);
    }
  });

  it("strategicProofShortlist has one entry per (family, archetype) pair", () => {
    const pairs = new Set<string>();
    for (const e of summary.strategicProofShortlist) {
      const key = `${e.primaryFamily}::${e.routeArchetype}`;
      expect(pairs.has(key), `duplicate pair ${key}`).toBe(false);
      pairs.add(key);
    }
  });

  it("family counts sum to total roles", () => {
    const total = Object.values(summary.byFamily).reduce((a, b) => a + b, 0);
    expect(total).toBe(summary.totalRoles);
  });

  it("productProof counts sum to total roles", () => {
    const total =
      summary.byProductProof[0] + summary.byProductProof[1] + summary.byProductProof[2];
    expect(total).toBe(summary.totalRoles);
  });

  it("no family is empty or > 250", () => {
    for (const [fam, count] of Object.entries(summary.byFamily)) {
      expect(count, `${fam} count`).toBeGreaterThan(0);
      expect(count, `${fam} count`).toBeLessThanOrEqual(250);
    }
  });
});
