// Actor engine — Vitest suite. Enforces Design Brief v3 contract end-to-end.

import { describe, it, expect } from "vitest";
import fixtures from "../../../../shared/reality-check/actor-cases.json";
import {
  ROUTE_TITLES,
  hasLevel3ForDegree,
  runActorEngine,
} from "./actor";
import { buildActorResult, ACTOR_SCOPE_NOTE } from "./actor-adapter";
import type { ActorSignals } from "../questionnaire/signals";
import { actorConfig } from "../questionnaire/roles/actor";
import {
  FROZEN_DEEP_ROLES,
  getTaxonomyEntry,
} from "@/lib/roles/role-taxonomy";
import { SOURCES } from "../sources";

const base = (overrides: Partial<ActorSignals> = {}): ActorSignals => ({
  performerScope: "adult_professional_route",
  highestQualification: "a_level_or_level_3",
  qualificationOrigin: "uk",
  trainingBackground: "short_courses_or_workshops",
  existingCredits: "student_or_amateur_only",
  auditionMaterials: ["headshot", "showreel"],
  representationStatus: "no_agent",
  routePriorities: ["build_credits"],
  incomeExpectation: "mixed_income_expected",
  timeAvailability: "part_time_flexible",
  budgetForTrainingOrMaterials: "under_500",
  checksBeforeCommitting: [],
  ...overrides,
});

const run = (s: ActorSignals) => runActorEngine({ signals: s });

// ── Fixture parity ─────────────────────────────────────────────────────────
describe("Actor — shared fixture parity", () => {
  for (const c of fixtures) {
    it(`fixture: ${c.name}`, () => {
      const out = run(c.signals as ActorSignals);
      if (c.expected.status !== undefined) expect(out.status).toBe(c.expected.status);
      if ("recommendedRouteId" in c.expected) {
        expect(out.recommendedRouteId).toBe(c.expected.recommendedRouteId);
      }
      if ("recommendedRouteMustNotBe" in c.expected) {
        expect(out.recommendedRouteId).not.toBe(c.expected.recommendedRouteMustNotBe);
      }
    });
  }
});

// ── Qualification-signal invariants ────────────────────────────────────────
describe("Actor — qualification signals", () => {
  it("highest_qualification and qualification_origin are separate", () => {
    const q = actorConfig.questions.map((x) => x.id);
    expect(q).toContain("highest_qualification");
    expect(q).toContain("qualification_origin");
  });

  it("unknown qualification origin never triggers verification", () => {
    const out = run(base({ qualificationOrigin: "unknown" }));
    expect(out.status).not.toBe("qualification_verification_required");
  });

  it("international origin + degree relevance triggers verification", () => {
    const out = run(
      base({
        qualificationOrigin: "international",
        highestQualification: "bachelors_drama_or_acting",
        routePriorities: ["formal_training"],
        timeAvailability: "full_time",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
    expect(out.isInternationalVerification).toBe(true);
    expect(out.recommendedRouteId).toBeNull();
  });

  it("private-course / accreditation uncertainty is be_careful_with, not verification", () => {
    const out = run(base({ trainingBackground: "private_acting_course" }));
    expect(out.status).not.toBe("qualification_verification_required");
    expect(out.showCourseCaution).toBe(true);
  });
});

// ── Degree route eligibility ───────────────────────────────────────────────
describe("Actor — university_drama_degree eligibility", () => {
  it("GCSE-only does not recommend the degree route", () => {
    const out = run(
      base({
        highestQualification: "gcse",
        timeAvailability: "full_time",
        routePriorities: ["formal_training", "stage_work"],
      }),
    );
    expect(out.recommendedRouteId).not.toBe("university_drama_degree");
    expect(out.mayOpenLaterRouteIds).toContain("university_drama_degree");
  });

  it("`none` does not recommend the degree route", () => {
    const out = run(
      base({
        highestQualification: "none",
        trainingBackground: "no_formal_training",
        timeAvailability: "full_time",
        routePriorities: ["formal_training"],
      }),
    );
    expect(out.recommendedRouteId).not.toBe("university_drama_degree");
  });

  it("Level 3 + full time + formal-training priority makes degree route eligible", () => {
    const out = run(
      base({
        highestQualification: "a_level_or_level_3",
        timeAvailability: "full_time",
        routePriorities: ["formal_training", "stage_work"],
      }),
    );
    const degree = out.routeEvaluations.find((r) => r.id === "university_drama_degree")!;
    expect(degree.eligible).toBe(true);
  });

  it("performing_arts_level_3 also opens the degree route", () => {
    const out = run(
      base({
        highestQualification: "performing_arts_level_3",
        timeAvailability: "full_time",
        routePriorities: ["formal_training"],
      }),
    );
    const degree = out.routeEvaluations.find((r) => r.id === "university_drama_degree")!;
    expect(degree.eligible).toBe(true);
  });

  it("hasLevel3ForDegree helper reflects the Level 3+ set", () => {
    expect(hasLevel3ForDegree(base({ highestQualification: "a_level_or_level_3" }))).toBe(true);
    expect(hasLevel3ForDegree(base({ highestQualification: "gcse" }))).toBe(false);
    expect(hasLevel3ForDegree(base({ highestQualification: "unknown" }))).toBe(false);
  });
});

// ── formal_actor_training gating ───────────────────────────────────────────
describe("Actor — formal_actor_training eligibility", () => {
  it("budget alone does not open formal_actor_training", () => {
    const out = run(
      base({
        trainingBackground: "no_formal_training",
        routePriorities: ["build_credits"],
        budgetForTrainingOrMaterials: "2000_plus",
        timeAvailability: "very_limited",
      }),
    );
    const formal = out.routeEvaluations.find((r) => r.id === "formal_actor_training")!;
    expect(formal.eligible).toBe(false);
  });

  it("meaningful time alone does not open formal_actor_training", () => {
    const out = run(
      base({
        trainingBackground: "no_formal_training",
        routePriorities: ["build_credits"],
        timeAvailability: "full_time",
        budgetForTrainingOrMaterials: "none",
      }),
    );
    const formal = out.routeEvaluations.find((r) => r.id === "formal_actor_training")!;
    expect(formal.eligible).toBe(false);
  });

  it("formal_training priority + meaningful time opens the route", () => {
    const out = run(
      base({
        trainingBackground: "no_formal_training",
        routePriorities: ["formal_training"],
        timeAvailability: "full_time",
      }),
    );
    const formal = out.routeEvaluations.find((r) => r.id === "formal_actor_training")!;
    expect(formal.eligible).toBe(true);
  });

  it("budget value never changes eligibility for any route", () => {
    const cheap = run(base({ budgetForTrainingOrMaterials: "none" }));
    const rich = run(base({ budgetForTrainingOrMaterials: "2000_plus" }));
    const asIds = (o: ReturnType<typeof run>) =>
      o.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(asIds(cheap)).toEqual(asIds(rich));
  });
});

// ── Under-18 scope gate ────────────────────────────────────────────────────
describe("Actor — under-18 scope gate", () => {
  it("under_18 scope returns bridging_required with no route recommendations", () => {
    const out = run(
      base({
        performerScope: "under_18_or_child_performer",
        routePriorities: ["formal_training", "agent_and_profile"],
      }),
    );
    expect(out.status).toBe("bridging_required");
    expect(out.recommendedRouteId).toBeNull();
    expect(out.routeEvaluations.every((r) => !r.eligible)).toBe(true);
  });
});

// ── checks_before_committing invariants ────────────────────────────────────
describe("Actor — checks_before_committing has no gating power", () => {
  it("course/accreditation caution fires whenever formal training is recommendable, regardless of checks", () => {
    const withCheck = run(
      base({
        trainingBackground: "school_or_youth_drama",
        routePriorities: ["formal_training"],
        timeAvailability: "full_time",
        checksBeforeCommitting: ["course_accreditation"],
      }),
    );
    const withoutCheck = run(
      base({
        trainingBackground: "school_or_youth_drama",
        routePriorities: ["formal_training"],
        timeAvailability: "full_time",
        checksBeforeCommitting: [],
      }),
    );
    expect(withCheck.showCourseCaution).toBe(true);
    expect(withoutCheck.showCourseCaution).toBe(true);
  });

  it("private_acting_course always triggers course caution regardless of checks", () => {
    const out = run(base({ trainingBackground: "private_acting_course", checksBeforeCommitting: [] }));
    expect(out.showCourseCaution).toBe(true);
  });

  it("checks toggles do not change route eligibility", () => {
    const a = run(base({ checksBeforeCommitting: [] }));
    const b = run(base({ checksBeforeCommitting: ["course_accreditation", "agent_terms_and_fees"] }));
    const asIds = (o: ReturnType<typeof run>) =>
      o.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(asIds(a)).toEqual(asIds(b));
  });
});

// ── Adjacent route wording ─────────────────────────────────────────────────
describe("Actor — adjacent_performance_income_route wording", () => {
  it("copy never mentions drama teacher / teaching drama", () => {
    const out = run(base({ incomeExpectation: "main_income_soon" }));
    const adj = out.routeEvaluations.find((r) => r.id === "adjacent_performance_income_route")!;
    const blob = [adj.displayTitle, adj.evidenceNote, ...adj.blockersAndChecks, adj.immediateAction]
      .join(" ")
      .toLowerCase();
    expect(blob).not.toContain("teacher");
    expect(blob).not.toContain("teaching drama");
  });

  it("copy states adjacent work is not an automatic stepping-stone", () => {
    const out = run(base({ incomeExpectation: "unsure" }));
    const adj = out.routeEvaluations.find((r) => r.id === "adjacent_performance_income_route")!;
    const blob = [adj.evidenceNote, ...adj.blockersAndChecks].join(" ").toLowerCase();
    expect(blob).toContain("not automatic stepping-stone");
  });
});

// ── Copy — banned positive-promise strings ─────────────────────────────────
describe("Actor — banned positive-promise strings", () => {
  const BANNED = [
    "this guarantees",
    "will guarantee",
    "guaranteed route",
    "guaranteed work",
    "you will get auditions",
    "you will get an agent",
    "you will get acting work",
    "you are ready for representation",
    "this course will get you work",
  ];

  const allCopyFromResult = (): string => {
    const r = buildActorResult({ signals: base({ representationStatus: "seeking_agent", auditionMaterials: ["headshot", "showreel"], existingCredits: "some_paid_credits" }) });
    const parts: string[] = [
      r.readinessReason,
      r.biggestBlocker,
      r.immediateAction,
      r.bestRoute.title,
      r.bestRoute.summary,
      ...r.bestRoute.whyThisFits,
      r.bestRoute.mainDifficulty,
      r.backupRoute.title,
      r.backupRoute.summary,
      r.backupRoute.tradeOff,
      r.routeToAvoid.title,
      r.routeToAvoid.whyRisky,
      r.routeToAvoid.whenItMightWork,
      ...r.firstMoves,
      ...(r.considerations ?? []),
    ];
    if (r.modular) {
      parts.push(r.modular.headline, ...r.modular.checksBeforeCommitting);
      for (const c of r.modular.routes) {
        parts.push(c.title, c.fit, c.constraint, c.nextAction, ...c.checks);
      }
    }
    return parts.join(" ").toLowerCase();
  };

  it("no positive-promise strings appear in a full result", () => {
    const blob = allCopyFromResult();
    for (const b of BANNED) expect(blob).not.toContain(b);
  });

  it("defensive `does not promise` / `does not guarantee` wording is permitted", () => {
    const blob = allCopyFromResult();
    // At least one defensive phrase must be present in a full result.
    expect(
      blob.includes("does not promise") ||
        blob.includes("does not guarantee") ||
        blob.includes("no promised outcome"),
    ).toBe(true);
  });
});

// ── Question set / signals coverage ────────────────────────────────────────
describe("Actor — question set and no-protected-fields", () => {
  it("questionnaire has exactly 12 questions in the specified order", () => {
    expect(actorConfig.questions.map((q) => q.id)).toEqual([
      "performer_scope",
      "highest_qualification",
      "qualification_origin",
      "training_background",
      "existing_credits",
      "audition_materials",
      "representation_status",
      "route_priorities",
      "income_expectation",
      "time_availability",
      "budget_for_training_or_materials",
      "checks_before_committing",
    ]);
  });

  it("no question or option label references protected characteristics", () => {
    const banned = /\b(age|gender|sex|ethnic|race|racial|disab|accent|body|weight|height|attractive|casting.type)\b/i;
    for (const q of actorConfig.questions) {
      // performer_scope allows the word "adult" but not protected traits.
      const combined = [
        q.title,
        q.helpText ?? "",
        q.whyWeAsk,
        ...(q.options ?? []).map((o) => `${o.label} ${o.small ?? ""}`),
      ].join(" ");
      expect(banned.test(combined), `question ${q.id} referenced a banned trait`).toBe(false);
    }
  });
});

// ── Taxonomy / frozen roles / sources ──────────────────────────────────────
describe("Actor — taxonomy, frozen roles, sources", () => {
  it("taxonomy entry uses commission_or_gig_led and deep_reviewed depth", () => {
    const t = getTaxonomyEntry("actor")!;
    expect(t.primaryFamily).toBe("creative_media_content");
    expect(t.routeArchetype).toBe("commission_or_gig_led");
    expect(t.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });

  it("FROZEN_DEEP_ROLES now contains actor (grows 6 → 7)", () => {
    expect(FROZEN_DEEP_ROLES).toContain("actor");
    expect(FROZEN_DEEP_ROLES.length).toBe(7);
  });

  it("actor sources exist and CDMT is NOT categorised as regulation", () => {
    expect(SOURCES.national_careers_actor).toBeDefined();
    expect(SOURCES.equity_casting_and_auditions).toBeDefined();
    expect(SOURCES.spotlight_profile_guidance).toBeDefined();
    expect(SOURCES.spotlight_headshot_guidance).toBeDefined();
    expect(SOURCES.cdmt_accredited_training).toBeDefined();
    expect(SOURCES.cdmt_accredited_training.category).not.toBe("regulation");
  });

  it("route titles include all six route IDs and no fake bridging id", () => {
    const ids = Object.keys(ROUTE_TITLES);
    expect(ids.length).toBe(6);
    expect(ids).not.toContain("creative_foundation_bridging");
  });
});

// ── Adapter payload sanity ────────────────────────────────────────────────
describe("Actor — adapter payload", () => {
  it("route_recommended payload includes the scope note in checksBeforeCommitting", () => {
    const r = buildActorResult({ signals: base() });
    expect(r.modular?.checksBeforeCommitting).toContain(ACTOR_SCOPE_NOTE);
  });

  it("agent-route recommendation includes the agent caution card", () => {
    const r = buildActorResult({
      signals: base({
        representationStatus: "seeking_agent",
        auditionMaterials: ["headshot", "showreel", "spotlight_or_equivalent_profile"],
        existingCredits: "some_paid_credits",
        routePriorities: ["agent_and_profile"],
      }),
    });
    const cautionTitles = (r.modular?.routes ?? []).filter((c) => c.kind === "caution").map((c) => c.title);
    expect(cautionTitles.some((t) => /agent/i.test(t))).toBe(true);
  });
});
