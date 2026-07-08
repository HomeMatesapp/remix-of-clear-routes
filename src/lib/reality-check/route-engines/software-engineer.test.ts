// Software Engineer engine — Vitest suite.
// Enforces the v3 brief contract end-to-end and runs the shared parity fixture.

import { describe, it, expect } from "vitest";
import fixtures from "../../../../shared/reality-check/software-engineer-cases.json";
import {
  runSoftwareEngineerEngine,
  toEligibilityInput,
  ROUTE_TITLES,
  type SoftwareEngineerEngineInput,
  type SoftwareEngineerRouteId,
} from "./software-engineer";
import type { SoftwareEngineerSignals } from "../questionnaire/signals";
import { softwareEngineerConfig } from "../questionnaire/roles/software-engineer";
import { extractSoftwareEngineerSignals } from "../questionnaire/signals";
import { mathsEnglishQuestion } from "../questionnaire/families/qualifications";
import { modularDraftKey } from "../questionnaire/draft-v3";
import { FROZEN_DEEP_ROLES, getTaxonomyEntry } from "@/lib/roles/role-taxonomy";
import { SOURCES } from "../sources";

const base = (overrides: Partial<SoftwareEngineerSignals> = {}): SoftwareEngineerSignals => ({
  startingPoint: "career_changer",
  codingExperience: "self_taught_6m_plus",
  portfolioState: "deployed",
  highestQualification: "bachelors_non_cs",
  mathsEnglishStatus: "both",
  learningTimeHoursPerWeek: "15_30",
  trainingBudgetGbp: "2k_10k",
  locationFlexibility: "hybrid_region",
  routePriorities: [],
  ...overrides,
});

const run = (s: SoftwareEngineerSignals): SoftwareEngineerEngineInput["signals"] extends never ? never : ReturnType<typeof runSoftwareEngineerEngine> =>
  runSoftwareEngineerEngine({ signals: s });

describe("Software Engineer engine — contract", () => {
  it("engine strips portfolioUrl (defence in depth) and never uses it", () => {
    const withUrl = base({ portfolioUrl: "https://example.com/portfolio" });
    const withoutUrl = base();
    const a = run(withUrl);
    const b = run(withoutUrl);
    expect(a).toEqual(b);
  });

  it("toEligibilityInput removes portfolioUrl", () => {
    const s = base({ portfolioUrl: "https://example.com/x" });
    const stripped = toEligibilityInput(s);
    expect((stripped as { portfolioUrl?: string }).portfolioUrl).toBeUndefined();
  });

  it("no route id is ever 'bridging_beginner'", () => {
    const scenarios: SoftwareEngineerSignals[] = [
      base(),
      base({ codingExperience: "none", portfolioState: "none", learningTimeHoursPerWeek: "lt5", highestQualification: "gcse" }),
      base({ highestQualification: "international" }),
    ];
    for (const s of scenarios) {
      const out = run(s);
      for (const r of out.routeEvaluations) {
        expect(r.id).not.toBe("bridging_beginner");
      }
    }
  });

  it("uses exactly four outcome statuses", () => {
    const statuses = new Set<string>();
    statuses.add(run(base()).status);
    statuses.add(run(base({ startingPoint: null })).status);
    statuses.add(run(base({ codingExperience: "none", portfolioState: "none", learningTimeHoursPerWeek: "lt5", highestQualification: "gcse", mathsEnglishStatus: "neither" })).status);
    statuses.add(run(base({ highestQualification: "international", codingExperience: "none", portfolioState: "none", learningTimeHoursPerWeek: "lt5", mathsEnglishStatus: "not_sure", locationFlexibility: "remote_only" })).status);
    for (const s of statuses) {
      expect(["route_recommended", "qualification_verification_required", "bridging_required", "insufficient_information"]).toContain(s);
    }
  });
});

describe("Software Engineer engine — eligibility rules", () => {
  it("self_taught: tutorials-only is NOT project evidence", () => {
    const out = run(base({ portfolioState: "tutorials_only", codingExperience: "hobbyist" }));
    const st = out.routeEvaluations.find((r) => r.id === "self_taught_portfolio")!;
    expect(st.eligible).toBe(false);
  });

  it("self_taught: personal_projects + 5–15h is eligible", () => {
    const out = run(base({ portfolioState: "personal_projects", codingExperience: "hobbyist", learningTimeHoursPerWeek: "5_15" }));
    const st = out.routeEvaluations.find((r) => r.id === "self_taught_portfolio")!;
    expect(st.eligible).toBe(true);
  });

  it("bootcamp: budget never gates eligibility (all four bands)", () => {
    for (const b of ["0", "0_2k", "2k_10k", "10k_plus"] as const) {
      const out = run(base({ trainingBudgetGbp: b, learningTimeHoursPerWeek: "15_30" }));
      const bc = out.routeEvaluations.find((r) => r.id === "bootcamp_intensive")!;
      expect(bc.eligible, `budget=${b}`).toBe(true);
    }
  });

  it("bootcamp: 0/0_2k budgets flag as not affordable with funded-vs-private copy", () => {
    for (const b of ["0", "0_2k"] as const) {
      const out = run(base({ trainingBudgetGbp: b, learningTimeHoursPerWeek: "15_30" }));
      const bc = out.routeEvaluations.find((r) => r.id === "bootcamp_intensive")!;
      expect(bc.affordability.affordable).toBe(false);
      const combined = bc.affordability.notes.join(" ");
      expect(combined).toMatch(/funded Skills Bootcamp/i);
      expect(combined).toMatch(/employer-funded/i);
    }
  });

  it("bootcamp caveat: contains both 'private bootcamp' and 'funded Skills Bootcamp'", () => {
    const out = run(base({ learningTimeHoursPerWeek: "15_30" }));
    const bc = out.routeEvaluations.find((r) => r.id === "bootcamp_intensive")!;
    const combined = bc.blockersAndChecks.join(" ");
    expect(combined).toMatch(/private bootcamp/i);
    expect(combined).toMatch(/funded Skills Bootcamp/i);
  });

  it("degree_cs: gcse-only is NOT directly eligible", () => {
    const out = run(base({ highestQualification: "gcse", codingExperience: "hobbyist", portfolioState: "personal_projects" }));
    const d = out.routeEvaluations.find((r) => r.id === "degree_computer_science")!;
    expect(d.eligible).toBe(false);
  });

  it("degree_cs: none-qualification is NOT directly eligible", () => {
    const out = run(base({ highestQualification: "none", codingExperience: "hobbyist", portfolioState: "personal_projects" }));
    const d = out.routeEvaluations.find((r) => r.id === "degree_computer_science")!;
    expect(d.eligible).toBe(false);
  });

  it("degree_cs: a_level + both maths_english IS directly eligible", () => {
    const out = run(base({ highestQualification: "a_level", codingExperience: "hobbyist", portfolioState: "personal_projects" }));
    const d = out.routeEvaluations.find((r) => r.id === "degree_computer_science")!;
    expect(d.eligible).toBe(true);
  });

  it("degree_cs: l3_vocational + both IS directly eligible", () => {
    const out = run(base({ highestQualification: "l3_vocational" }));
    const d = out.routeEvaluations.find((r) => r.id === "degree_computer_science")!;
    expect(d.eligible).toBe(true);
  });

  it("conversion_msc: bachelors_cs is NEVER eligible", () => {
    const out = run(base({ highestQualification: "bachelors_cs" }));
    const c = out.routeEvaluations.find((r) => r.id === "degree_conversion_msc")!;
    expect(c.eligible).toBe(false);
  });

  it("conversion_msc: masters_plus + non_computing IS eligible", () => {
    const out = run(base({ highestQualification: "masters_plus", mastersSubject: "non_computing" }));
    const c = out.routeEvaluations.find((r) => r.id === "degree_conversion_msc")!;
    expect(c.eligible).toBe(true);
  });

  it("conversion_msc: masters_plus + computing is NOT eligible", () => {
    const out = run(base({ highestQualification: "masters_plus", mastersSubject: "computing" }));
    const c = out.routeEvaluations.find((r) => r.id === "degree_conversion_msc")!;
    expect(c.eligible).toBe(false);
  });

  it("conversion_msc: masters_plus + unknown does NOT block other routes", () => {
    const out = run(base({ highestQualification: "masters_plus", mastersSubject: "unknown" }));
    expect(out.status).toBe("route_recommended");
    expect(out.recommendedRouteId).not.toBe("degree_conversion_msc");
    // Top-level blockersAndChecks surfaces the subject-verification note.
    expect(out.blockersAndChecks.join(" ")).toMatch(/computing-related/i);
  });

  it("apprenticeship: complete beginner with zero evidence is NOT eligible", () => {
    const out = run(base({
      startingPoint: "career_changer",
      codingExperience: "none",
      portfolioState: "none",
      highestQualification: "a_level",
    }));
    const a = out.routeEvaluations.find((r) => r.id === "apprenticeship_digital")!;
    expect(a.eligible).toBe(false);
  });

  it("apprenticeship: beginner with SOME evidence IS eligible", () => {
    const out = run(base({
      startingPoint: "career_changer",
      codingExperience: "hobbyist",
      portfolioState: "none",
      highestQualification: "a_level",
    }));
    const a = out.routeEvaluations.find((r) => r.id === "apprenticeship_digital")!;
    expect(a.eligible).toBe(true);
  });

  it("apprenticeship: remote_only rules it out even with evidence", () => {
    const out = run(base({ locationFlexibility: "remote_only" }));
    const a = out.routeEvaluations.find((r) => r.id === "apprenticeship_digital")!;
    expect(a.eligible).toBe(false);
  });

  it("apprenticeship caveat: references L4, L6 and 'employer' + 'provider' variability", () => {
    const out = run(base({ startingPoint: "recently_left_education" }));
    const a = out.routeEvaluations.find((r) => r.id === "apprenticeship_digital")!;
    const combined = a.blockersAndChecks.join(" ");
    expect(combined).toMatch(/Level 4/);
    expect(combined).toMatch(/Level 6/);
    expect(combined).toMatch(/employer/i);
    expect(combined).toMatch(/provider/i);
  });

  it("junior_role_with_training: already_coding_at_work is directly eligible", () => {
    const out = run(base({ startingPoint: "already_coding_at_work", codingExperience: "paid_experience", portfolioState: "personal_projects" }));
    const j = out.routeEvaluations.find((r) => r.id === "junior_role_with_training")!;
    expect(j.eligible).toBe(true);
    expect(out.recommendedRouteId).toBe("junior_role_with_training");
    // Progression-focused immediate action.
    expect(out.immediateAction).toMatch(/progression|line manager|document/i);
  });
});

describe("Software Engineer engine — priorities cannot promote ineligible routes", () => {
  it("high_pay does not make CS degree eligible for a GCSE-only user", () => {
    const out = run(base({
      startingPoint: "recently_left_education",
      codingExperience: "none",
      portfolioState: "none",
      highestQualification: "gcse",
      learningTimeHoursPerWeek: "15_30",
      routePriorities: ["high_pay"],
    }));
    expect(out.recommendedRouteId).not.toBe("degree_computer_science");
  });

  it("priorities reorder eligible routes only", () => {
    const withSpeed = run(base({
      startingPoint: "career_changer",
      codingExperience: "hobbyist",
      portfolioState: "personal_projects",
      highestQualification: "a_level",
      learningTimeHoursPerWeek: "15_30",
      routePriorities: ["speed"],
    }));
    const withEmployer = run(base({
      startingPoint: "career_changer",
      codingExperience: "hobbyist",
      portfolioState: "personal_projects",
      highestQualification: "a_level",
      learningTimeHoursPerWeek: "15_30",
      routePriorities: ["employer_training"],
    }));
    // Same eligible set both times; only the ranking (recommended) may change.
    const eligA = withSpeed.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    const eligB = withEmployer.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(eligA).toEqual(eligB);
  });
});

describe("Software Engineer engine — outcome precedence", () => {
  it("missing critical signal → insufficient_information", () => {
    const out = run(base({ startingPoint: null }));
    expect(out.status).toBe("insufficient_information");
    expect(out.missingSignals).toContain("starting_point");
  });

  it("international qualification with no other eligible route → verification_required", () => {
    const out = run(base({
      startingPoint: "returning_after_break",
      codingExperience: "none",
      portfolioState: "none",
      highestQualification: "international",
      mathsEnglishStatus: "not_sure",
      learningTimeHoursPerWeek: "lt5",
      trainingBudgetGbp: "0",
      locationFlexibility: "remote_only",
      routePriorities: [],
    }));
    expect(out.status).toBe("qualification_verification_required");
  });

  it("no eligible route otherwise → bridging_required (not verification)", () => {
    const out = run(base({
      startingPoint: "career_changer",
      codingExperience: "none",
      portfolioState: "none",
      highestQualification: "gcse",
      mathsEnglishStatus: "neither",
      learningTimeHoursPerWeek: "lt5",
      trainingBudgetGbp: "0",
      locationFlexibility: "remote_only",
      routePriorities: [],
    }));
    expect(out.status).toBe("bridging_required");
  });
});

describe("Software Engineer questionnaire config", () => {
  it("uses the shared maths_english_status question id (not a one-off)", () => {
    const q = softwareEngineerConfig.questions.find((x) => x.id === "maths_english_status");
    expect(q).toBe(mathsEnglishQuestion);
  });

  it("uses digital_route_priorities (not the trades route_priorities)", () => {
    const ids = softwareEngineerConfig.questions.map((q) => q.id);
    expect(ids).toContain("digital_route_priorities");
    expect(ids).not.toContain("route_priorities");
  });

  it("draft key uses the modular convention", () => {
    expect(modularDraftKey(softwareEngineerConfig.roleSlug, softwareEngineerConfig.questionnaireVersion))
      .toBe("reality-check-draft:software-engineer:software-engineer-v1");
  });

  it("engineId and questionnaireVersion are software-engineer-v1", () => {
    expect(softwareEngineerConfig.engineId).toBe("software-engineer-v1");
    expect(softwareEngineerConfig.questionnaireVersion).toBe("software-engineer-v1");
  });

  it("extractor picks up already_coding_at_work as a starting_point value", () => {
    const s = extractSoftwareEngineerSignals(
      {
        starting_point: "already_coding_at_work",
        coding_experience: "paid_experience",
        portfolio_state: "personal_projects",
        highest_qualification: "bachelors_non_cs",
        maths_english_status: "both",
        learning_time_available: "5_15",
        training_budget: "0",
        location_flexibility: "hybrid_region",
        digital_route_priorities: ["speed"],
      },
      {},
    );
    expect(s.startingPoint).toBe("already_coding_at_work");
    expect(s.routePriorities).toEqual(["speed"]);
  });

  it("extractor drops portfolioUrl when portfolio_state moves away from a state that supports it", () => {
    const s = extractSoftwareEngineerSignals(
      {
        starting_point: "career_changer",
        coding_experience: "hobbyist",
        portfolio_state: "tutorials_only",
        highest_qualification: "bachelors_non_cs",
        maths_english_status: "both",
        learning_time_available: "5_15",
        training_budget: "0",
        location_flexibility: "hybrid_region",
      },
      { portfolio_state: "https://leftover.example" },
    );
    expect(s.portfolioUrl).toBeUndefined();
  });

  it("extractor keeps portfolioUrl only when portfolio_state supports it", () => {
    const s = extractSoftwareEngineerSignals(
      {
        starting_point: "career_changer",
        coding_experience: "hobbyist",
        portfolio_state: "deployed",
        highest_qualification: "bachelors_non_cs",
        maths_english_status: "both",
        learning_time_available: "5_15",
        training_budget: "0",
        location_flexibility: "hybrid_region",
      },
      { portfolio_state: "https://kept.example" },
    );
    expect(s.portfolioUrl).toBe("https://kept.example");
  });
});

describe("Software Engineer taxonomy freeze", () => {
  it("software-engineer is now a frozen deep role", () => {
    expect(FROZEN_DEEP_ROLES).toContain("software-engineer");
    expect(FROZEN_DEEP_ROLES.length).toBeGreaterThanOrEqual(4);
  });

  it("taxonomy entry has deep_reviewed_reality_check depth", () => {
    const e = getTaxonomyEntry("software-engineer")!;
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
});

describe("Software Engineer sources", () => {
  it("registry includes the v3 brief evidence sources", () => {
    expect(SOURCES.ifate_software_developer).toBeDefined();
    expect(SOURCES.ifate_software_dev_technician).toBeDefined();
    expect(SOURCES.ifate_dtsp_software_engineer).toBeDefined();
    expect(SOURCES.gov_skills_bootcamps).toBeDefined();
    expect(SOURCES.uk_enic).toBeDefined();
    expect(SOURCES.gov_student_finance_ug).toBeDefined();
  });
});

describe("Software Engineer — shared fixture parity", () => {
  it.each((fixtures as any[]).map((c) => [c.name, c]))("case: %s", (_name, c: any) => {
    const out = runSoftwareEngineerEngine({ signals: c.signals });
    expect(out.status).toBe(c.expected.status);
    if (c.expected.recommendedRouteId !== undefined) {
      expect(out.recommendedRouteId).toBe(c.expected.recommendedRouteId);
    }
    if (c.expected.recommendedRouteMustNotBe) {
      expect(out.recommendedRouteId).not.toBe(c.expected.recommendedRouteMustNotBe);
    }
    if (c.expected.recommendedRouteMustBeOneOf) {
      expect(c.expected.recommendedRouteMustBeOneOf).toContain(out.recommendedRouteId);
    }
    if (c.expected.bootcampMustBeEligible) {
      const bc = out.routeEvaluations.find((r) => r.id === "bootcamp_intensive");
      expect(bc?.eligible).toBe(true);
    }
  });
});

describe("ROUTE_TITLES coverage", () => {
  it("exposes titles for every recommendable route id", () => {
    const ids: SoftwareEngineerRouteId[] = [
      "self_taught_portfolio",
      "bootcamp_intensive",
      "degree_computer_science",
      "degree_conversion_msc",
      "apprenticeship_digital",
      "junior_role_with_training",
    ];
    for (const id of ids) expect(ROUTE_TITLES[id]).toBeTruthy();
  });
});
