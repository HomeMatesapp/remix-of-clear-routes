// Police Officer engine — Vitest suite.
// Enforces the v4 brief contract end-to-end.

import { describe, it, expect } from "vitest";
import fixtures from "../../../../shared/reality-check/police-officer-cases.json";
import {
  ROUTE_TITLES,
  hasLevel3OrEquivalent,
  runPoliceOfficerEngine,
  type PoliceOfficerRouteId,
} from "./police-officer";
import {
  buildPoliceOfficerResult,
  ENGLAND_WALES_SCOPE_NOTE,
} from "./police-officer-adapter";
import type { PoliceOfficerSignals } from "../questionnaire/signals";
import { policeOfficerConfig } from "../questionnaire/roles/police-officer";
import { modularDraftKey } from "../questionnaire/draft-v3";
import {
  FROZEN_DEEP_ROLES,
  getTaxonomyEntry,
} from "@/lib/roles/role-taxonomy";
import { SOURCES, getSourcesForResult } from "../sources";

const base = (
  overrides: Partial<PoliceOfficerSignals> = {},
): PoliceOfficerSignals => ({
  startingPoint: "career_changer",
  highestQualification: "a_level_or_level_3",
  englishMathsStatus: "english_and_maths_met",
  currentPublicServiceExperience: "none",
  routePreference: "fastest_application_route",
  studyPatternAvailable: "work_based_training_preferred",
  regionAvailability: "england_wales_any_force",
  checks_before_applying: [],
  priority: "graduate_as_fast_as_possible",
  ...overrides,
});

const run = (s: PoliceOfficerSignals) =>
  runPoliceOfficerEngine({ signals: s });

const RECOMMENDABLE: readonly PoliceOfficerRouteId[] = [
  "police_constable_entry_programme",
  "police_constable_degree_apprenticeship",
  "degree_holder_entry_programme",
  "professional_policing_degree_then_apply",
  "feeder_public_service_route",
  "police_rejoiner_route",
];

// ── Route eligibility ───────────────────────────────────────────────────────
describe("Police Officer — route eligibility", () => {
  it("A-level + english/maths met → PCEP recommended", () => {
    const out = run(base());
    expect(out.status).toBe("route_recommended");
    expect(out.recommendedRouteId).toBe("police_constable_entry_programme");
  });

  it("A-level + earn_while_training → PCDA recommended", () => {
    const out = run(
      base({ routePreference: "earn_while_training", priority: "avoid_student_debt" }),
    );
    expect(out.recommendedRouteId).toBe("police_constable_degree_apprenticeship");
  });

  it("degree holder → DHEP recommended, PCEP backup", () => {
    const out = run(base({ startingPoint: "graduate", highestQualification: "bachelors_any_subject" }));
    expect(out.recommendedRouteId).toBe("degree_holder_entry_programme");
    expect(out.alternativeRouteIds[0]).toBe("police_constable_entry_programme");
  });

  it("professional_policing_degree is treated as PCEP-ready, NOT DHEP primary", () => {
    const out = run(
      base({ startingPoint: "graduate", highestQualification: "professional_policing_degree" }),
    );
    expect(out.recommendedRouteId).toBe("police_constable_entry_programme");
    const dhep = out.routeEvaluations.find((r) => r.id === "degree_holder_entry_programme")!;
    expect(dhep.eligible).toBe(false);
  });

  it("degree_first + full-time study → Professional Policing Degree primary", () => {
    const out = run(
      base({
        startingPoint: "school_leaver",
        routePreference: "degree_first",
        studyPatternAvailable: "full_time_study_possible",
        priority: "structured_academic_route",
      }),
    );
    expect(out.recommendedRouteId).toBe("professional_policing_degree_then_apply");
  });

  it("Special Constable + GCSE → hasLevel3OrEquivalent unlocks PCEP", () => {
    const s = base({
      startingPoint: "currently_in_public_service",
      highestQualification: "gcse",
      currentPublicServiceExperience: "special_constable",
    });
    expect(hasLevel3OrEquivalent(s)).toBe(true);
    const out = run(s);
    expect(out.status).toBe("route_recommended");
    expect(out.recommendedRouteId).toBe("police_constable_entry_programme");
  });

  it("PCSO experience can also unlock PCEP via hasLevel3OrEquivalent", () => {
    const s = base({
      startingPoint: "currently_in_public_service",
      highestQualification: "gcse",
      currentPublicServiceExperience: "pcso",
    });
    expect(hasLevel3OrEquivalent(s)).toBe(true);
    const out = run(s);
    expect(out.recommendedRouteId).toBe("police_constable_entry_programme");
  });
});

// ── Gates ───────────────────────────────────────────────────────────────────
describe("Police Officer — gates", () => {
  it("former_police_officer → verification with rejoiner primary", () => {
    const out = run(base({ startingPoint: "former_police_officer" }));
    expect(out.status).toBe("qualification_verification_required");
    expect(out.verificationPrimaryRouteId).toBe("police_rejoiner_route");
    expect(out.recommendedRouteId).toBeNull();
  });

  it("international qualification → verification, no primary route ID", () => {
    const out = run(base({ highestQualification: "international" }));
    expect(out.status).toBe("qualification_verification_required");
    expect(out.verificationPrimaryRouteId).toBeNull();
    expect(out.isInternationalVerification).toBe(true);
    expect(out.recommendedRouteId).toBeNull();
  });

  it("unknown qualification → insufficient_information (not bridging, not verification)", () => {
    const out = run(base({ highestQualification: "unknown" }));
    expect(out.status).toBe("insufficient_information");
  });

  it("englishMathsStatus == not_sure → insufficient_information", () => {
    const out = run(base({ englishMathsStatus: "not_sure" }));
    expect(out.status).toBe("insufficient_information");
  });

  it("GCSE-only beginner with no equivalent experience → bridging_required (not feeder recommended)", () => {
    const out = run(
      base({
        startingPoint: "school_leaver",
        highestQualification: "gcse",
        currentPublicServiceExperience: "none",
      }),
    );
    expect(out.status).toBe("bridging_required");
    expect(out.recommendedRouteId).toBeNull();
  });

  it("english/maths gap → bridging_required, not route_recommended", () => {
    const out = run(base({ englishMathsStatus: "one_missing" }));
    expect(out.status).toBe("bridging_required");
  });

  it("english/maths gap → PCEP not directly eligible", () => {
    const out = run(base({ englishMathsStatus: "neither_met" }));
    const pcep = out.routeEvaluations.find((r) => r.id === "police_constable_entry_programme")!;
    expect(pcep.eligible).toBe(false);
  });

  it("GCSE only, no L3 equivalent → PCEP and PCDA not directly recommendable", () => {
    const out = run(
      base({ highestQualification: "gcse", startingPoint: "school_leaver" }),
    );
    for (const id of ["police_constable_entry_programme", "police_constable_degree_apprenticeship"] as const) {
      const ev = out.routeEvaluations.find((r) => r.id === id)!;
      expect(ev.eligible).toBe(false);
    }
  });

  it("missing critical signals → insufficient_information", () => {
    for (const key of [
      "startingPoint",
      "highestQualification",
      "englishMathsStatus",
      "currentPublicServiceExperience",
      "routePreference",
      "studyPatternAvailable",
    ] as const) {
      const out = run(base({ [key]: null } as never));
      expect(out.status).toBe("insufficient_information");
    }
  });
});

// ── Contract invariants ─────────────────────────────────────────────────────
describe("Police Officer — contract invariants", () => {
  it("qualification_verification_required results have no recommended/backup card kinds", () => {
    const scenarios: PoliceOfficerSignals[] = [
      base({ startingPoint: "former_police_officer" }),
      base({ highestQualification: "international" }),
    ];
    for (const s of scenarios) {
      const r = buildPoliceOfficerResult({ signals: s });
      expect(r.modular!.status).toBe("qualification_verification_required");
      for (const c of r.modular!.routes) {
        expect(c.kind).not.toBe("recommended");
        expect(c.kind).not.toBe("backup");
      }
    }
  });

  it("bridging_required results have no recommended/backup card kinds", () => {
    const r = buildPoliceOfficerResult({
      signals: base({
        startingPoint: "school_leaver",
        highestQualification: "gcse",
      }),
    });
    expect(r.modular!.status).toBe("bridging_required");
    for (const c of r.modular!.routes) {
      expect(c.kind).not.toBe("recommended");
      expect(c.kind).not.toBe("backup");
    }
  });

  it("international qualification result includes equivalence-check copy", () => {
    const r = buildPoliceOfficerResult({
      signals: base({ highestQualification: "international" }),
    });
    const text = [
      ...r.modular!.checksBeforeCommitting,
      r.modular!.headline,
    ].join(" ");
    expect(text.toLowerCase()).toMatch(/equivalence|maps to a uk level/);
  });

  it("international result does NOT fabricate a qualification_verification_required route ID", () => {
    const r = buildPoliceOfficerResult({
      signals: base({ highestQualification: "international" }),
    });
    for (const c of r.modular!.routes) {
      expect(RECOMMENDABLE).toContain(c.title === ROUTE_TITLES.police_rejoiner_route
        ? "police_rejoiner_route"
        : Object.keys(ROUTE_TITLES).find((k) => ROUTE_TITLES[k as PoliceOfficerRouteId] === c.title)!);
    }
  });

  it("checks_before_applying never affects eligibility", () => {
    const withNone = run(base({ checks_before_applying: [] }));
    const withAll = run(
      base({
        checks_before_applying: [
          "fitness_or_medical_process",
          "vetting_process",
          "national_eligibility_criteria",
          "driving_licence_process",
        ],
      }),
    );
    expect(withNone.recommendedRouteId).toBe(withAll.recommendedRouteId);
    expect(
      withNone.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort(),
    ).toEqual(
      withAll.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort(),
    );
  });

  it("region_availability never affects eligibility", () => {
    const setEligible = (r: PoliceOfficerSignals["regionAvailability"]) =>
      run(base({ regionAvailability: r })).routeEvaluations
        .filter((e) => e.eligible).map((e) => e.id).sort();
    expect(setEligible("england_wales_any_force")).toEqual(setEligible("specific_region"));
    expect(setEligible("england_wales_any_force")).toEqual(setEligible("not_sure"));
  });

  it("priorities reorder eligible routes but never change eligibility", () => {
    const s1 = base({ priority: "avoid_student_debt", routePreference: "earn_while_training" });
    const s2 = { ...s1, priority: "graduate_as_fast_as_possible" as const };
    const eligible = (s: PoliceOfficerSignals) =>
      run(s).routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(eligible(s1)).toEqual(eligible(s2));
  });
});

// ── Sensitive disclosure ban ────────────────────────────────────────────────
describe("Police Officer — sensitive disclosure ban", () => {
  const BANNED = [
    /\bhealth condition\b/i,
    /\bmedical history\b/i,
    /\bdisability\b/i,
    /\bpregnan/i,
    /\bcriminal record\b/i,
    /\bconviction/i,
    /\bcaution\b/i,
    /\bDBS\b/,
    /\bvetting outcome\b/i,
    /\bnationality\b/i,
    /\bresidency\b/i,
    /\bimmigration\b/i,
    /\bvisa\b/i,
    /\bright[-\s_]to[-\s_]work\b/i,
  ];
  const texts = policeOfficerConfig.questions.flatMap((q) => [
    q.id,
    q.title,
    q.whyWeAsk,
    q.helpText ?? "",
    ...(q.options?.flatMap((o) => [o.value, o.label]) ?? []),
  ]);

  it("no question asks the user to disclose sensitive items", () => {
    for (const t of texts) {
      for (const re of BANNED) expect(t).not.toMatch(re);
    }
  });

  it("no result copy contains unsafe eligibility/guarantee claims", () => {
    const forbidden = [
      /you are eligible/i,
      /you will pass/i,
      /you qualify/i,
      /guarantee/i,
    ];
    const scenarios: PoliceOfficerSignals[] = [
      base(),
      base({ startingPoint: "former_police_officer" }),
      base({ highestQualification: "international" }),
      base({ startingPoint: "school_leaver", highestQualification: "gcse" }),
    ];
    for (const s of scenarios) {
      const r = buildPoliceOfficerResult({ signals: s });
      const text = JSON.stringify(r);
      for (const re of forbidden) expect(text).not.toMatch(re);
    }
  });
});

// ── Scope note ──────────────────────────────────────────────────────────────
describe("Police Officer — England/Wales scope note", () => {
  it("appears in wizard intro (scopeNote)", () => {
    expect(policeOfficerConfig.scopeNote).toMatch(/England and Wales/);
    expect(policeOfficerConfig.scopeNote).toMatch(/Scotland/);
    expect(policeOfficerConfig.scopeNote).toMatch(/PSNI/);
    expect(policeOfficerConfig.scopeNote).toMatch(/[Dd]etective/);
  });

  it("appears in result methodology for every non-insufficient status", () => {
    const scenarios: PoliceOfficerSignals[] = [
      base(),
      base({ startingPoint: "former_police_officer" }),
      base({ highestQualification: "international" }),
      base({ startingPoint: "school_leaver", highestQualification: "gcse" }),
    ];
    for (const s of scenarios) {
      const r = buildPoliceOfficerResult({ signals: s });
      if (r.modular!.status === "insufficient_information") continue;
      expect(r.modular!.checksBeforeCommitting.join(" ")).toContain(ENGLAND_WALES_SCOPE_NOTE);
    }
  });
});

// ── Taxonomy freeze ─────────────────────────────────────────────────────────
describe("Police Officer — taxonomy freeze update", () => {
  it("FROZEN_DEEP_ROLES grows 5 → 6 and includes police-officer", () => {
    expect(FROZEN_DEEP_ROLES.length).toBe(6);
    expect(FROZEN_DEEP_ROLES).toContain("police-officer");
    for (const s of ["electrician", "plumber", "hvac-engineer", "software-engineer", "registered-nurse"]) {
      expect(FROZEN_DEEP_ROLES).toContain(s);
    }
  });

  it("police-officer taxonomy entry uses deep depth and expected archetypes", () => {
    const e = getTaxonomyEntry("police-officer")!;
    expect(e.primaryFamily).toBe("public_service_security");
    expect(e.routeArchetype).toBe("selection_led");
    expect(e.secondaryArchetype).toBe("mixed_route");
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });

  it("slug / engineId / questionnaireVersion / draft key are consistent", () => {
    expect(policeOfficerConfig.roleSlug).toBe("police-officer");
    expect(policeOfficerConfig.engineId).toBe("police-officer-v1");
    expect(policeOfficerConfig.questionnaireVersion).toBe("police-officer-v1");
    expect(
      modularDraftKey(policeOfficerConfig.roleSlug, policeOfficerConfig.questionnaireVersion),
    ).toBe("reality-check-draft:police-officer:police-officer-v1");
  });
});

// ── Sources ─────────────────────────────────────────────────────────────────
describe("Police Officer — sources", () => {
  it("registry includes the required police + equivalence sources", () => {
    expect(SOURCES.joining_the_police_entry_routes).toBeDefined();
    expect(SOURCES.college_of_policing_pcda).toBeDefined();
    expect(SOURCES.college_of_policing_dhep).toBeDefined();
    expect(SOURCES.college_of_policing_professional_policing_degree).toBeDefined();
    expect(SOURCES.national_careers_police_officer).toBeDefined();
    expect(SOURCES.uk_enic).toBeDefined();
  });

  it("getSourcesForResult includes the police sources on a recommended result", () => {
    const engineOut = run(base());
    const result = {
      bestRoute: { title: ROUTE_TITLES[engineOut.recommendedRouteId ?? "police_constable_entry_programme"] },
      backupRoute: undefined,
    } as unknown as Parameters<typeof getSourcesForResult>[2];
    const role = { role_slug: "police-officer", role_name: "Police Officer" } as never;
    const ids = getSourcesForResult(role, {} as never, result).map((s) => s.id);
    expect(ids).toContain("joining_the_police_entry_routes");
    expect(ids).toContain("college_of_policing_pcda");
    expect(ids).toContain("college_of_policing_dhep");
    expect(ids).toContain("uk_enic");
  });
});

// ── Existing five deep roles unchanged ──────────────────────────────────────
describe("Police Officer — regression guard for existing deep roles", () => {
  const priorSlugs = ["electrician", "plumber", "hvac-engineer", "software-engineer", "registered-nurse"];
  it("each prior deep role still has a deep taxonomy entry", () => {
    for (const s of priorSlugs) {
      const e = getTaxonomyEntry(s)!;
      expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
    }
  });
});

// ── Shared parity fixture ───────────────────────────────────────────────────
describe("Police Officer — shared fixture parity", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it.each((fixtures as any[]).map((c) => [c.name, c]))(
    "case: %s",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_name, c: any) => {
      const out = runPoliceOfficerEngine({ signals: c.signals });
      if (c.expected.status !== undefined) expect(out.status).toBe(c.expected.status);
      if (c.expected.recommendedRouteId !== undefined) {
        expect(out.recommendedRouteId).toBe(c.expected.recommendedRouteId);
      }
      if (c.expected.verificationPrimaryRouteId) {
        expect(out.verificationPrimaryRouteId).toBe(c.expected.verificationPrimaryRouteId);
      }
    },
  );
});

// ── ROUTE_TITLES coverage ───────────────────────────────────────────────────
describe("Police Officer — ROUTE_TITLES coverage", () => {
  it("exposes titles for every route id", () => {
    for (const id of RECOMMENDABLE) expect(ROUTE_TITLES[id]).toBeTruthy();
  });
});
