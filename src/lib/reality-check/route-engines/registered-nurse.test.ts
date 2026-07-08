// Registered Nurse engine — Vitest suite.
// Enforces the v3 brief contract end-to-end.

import { describe, it, expect } from "vitest";
import fixtures from "../../../../shared/reality-check/registered-nurse-cases.json";
import {
  NMC_APPROVED_FOOTER,
  NON_APPROVED_DIPLOMA_WARNING,
  ROUTE_TITLES,
  runRegisteredNurseEngine,
  type RegisteredNurseRouteId,
} from "./registered-nurse";
import { buildRegisteredNurseResult } from "./registered-nurse-adapter";
import type { RegisteredNurseSignals } from "../questionnaire/signals";
import { registeredNurseConfig } from "../questionnaire/roles/registered-nurse";
import { modularDraftKey } from "../questionnaire/draft-v3";
import {
  FROZEN_DEEP_ROLES,
  ROUTE_FAMILIES,
  getTaxonomyEntry,
} from "@/lib/roles/role-taxonomy";
import { SOURCES } from "../sources";

const base = (
  overrides: Partial<RegisteredNurseSignals> = {},
): RegisteredNurseSignals => ({
  startingPoint: "recently_left_education" as never, // universal-only value; forces valid string
  targetNursingField: "adult",
  highestQualification: "a_level",
  mathsEnglishScienceStatus: "english_maths_science_gcse_met",
  currentHealthcareEmployment: "not_currently_employed_in_healthcare",
  studyPatternAvailable: "full_time_university_possible",
  routePriorities: [],
  ...overrides,
});

const run = (s: RegisteredNurseSignals) =>
  runRegisteredNurseEngine({ signals: s });

// ── Route eligibility (§11 tests 1–6) ───────────────────────────────────────
describe("Registered Nurse — route eligibility (one-per-route)", () => {
  it("a_level + gcse met → pre_registration_nursing_degree recommended", () => {
    const out = run(base());
    expect(out.status).toBe("route_recommended");
    expect(out.recommendedRouteId).toBe("pre_registration_nursing_degree");
  });

  it("HCSW + employer support + gcse met → RNDA recommended", () => {
    const out = run(
      base({
        startingPoint: "currently_healthcare_support_worker",
        currentHealthcareEmployment: "employed_healthcare_support_role",
        employerSupport: "employer_support_confirmed",
        studyPatternAvailable: "employer_led_only",
        routePriorities: ["employer_supported"],
      }),
    );
    expect(out.recommendedRouteId).toBe("registered_nurse_degree_apprenticeship");
  });

  it("nursing associate → nursing_associate_to_registered_nurse", () => {
    const out = run(
      base({
        startingPoint: "nursing_associate_or_assistant_practitioner",
        highestQualification: "nursing_associate_foundation_degree",
        currentHealthcareEmployment: "employed_nursing_associate",
        employerSupport: "employer_support_confirmed",
        studyPatternAvailable: "employer_led_only",
      }),
    );
    expect(out.recommendedRouteId).toBe("nursing_associate_to_registered_nurse");
  });

  it("bachelor's health-related + health_related → graduate_shortened", () => {
    const out = run(
      base({
        startingPoint: "graduate_non_nursing",
        highestQualification: "bachelors_health_related",
        degreeBackgroundSubject: "health_related",
        routePriorities: ["fastest_route"],
      }),
    );
    expect(out.recommendedRouteId).toBe("graduate_shortened_nursing_degree");
  });

  it("overseas-trained → overseas route, verification-required", () => {
    const out = run(
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
    expect(out.verificationPrimaryRouteId).toBe(
      "overseas_trained_nurse_registration",
    );
  });

  it("previously registered → return_to_practice, verification-required", () => {
    const out = run(
      base({
        startingPoint: "previously_registered_nurse",
        registrationBackground: "previous_nmc_registration_lapsed",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
    expect(out.verificationPrimaryRouteId).toBe("return_to_practice");
  });
});

// ── Negative / gating ───────────────────────────────────────────────────────
describe("Registered Nurse — negative gating", () => {
  it("GCSE-only, no healthcare employment, complete beginner → bridging_required", () => {
    const out = run(
      base({
        startingPoint: "complete_beginner",
        highestQualification: "gcse",
      }),
    );
    expect(out.status).toBe("bridging_required");
    expect(out.recommendedRouteId).toBeNull();
  });

  it("degree route NOT directly eligible without Level 3 signal", () => {
    const out = run(base({ highestQualification: "gcse", startingPoint: "complete_beginner" }));
    const d = out.routeEvaluations.find(
      (r) => r.id === "pre_registration_nursing_degree",
    )!;
    expect(d.eligible).toBe(false);
  });

  it("RNDA requires healthcare employment AND employer support", () => {
    const outNoEmp = run(
      base({
        startingPoint: "career_changer_generic" as never,
        currentHealthcareEmployment: "not_currently_employed_in_healthcare",
      }),
    );
    const rndaA = outNoEmp.routeEvaluations.find(
      (r) => r.id === "registered_nurse_degree_apprenticeship",
    )!;
    expect(rndaA.eligible).toBe(false);

    const outNoSupport = run(
      base({
        startingPoint: "currently_healthcare_support_worker",
        currentHealthcareEmployment: "employed_healthcare_support_role",
        employerSupport: "no_employer_support",
      }),
    );
    const rndaB = outNoSupport.routeEvaluations.find(
      (r) => r.id === "registered_nurse_degree_apprenticeship",
    )!;
    expect(rndaB.eligible).toBe(false);
  });

  it("graduate route with 'other_subject' → verification-required, not recommended", () => {
    const out = run(
      base({
        startingPoint: "graduate_non_nursing",
        highestQualification: "bachelors_other",
        degreeBackgroundSubject: "other_subject",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
    expect(out.verificationPrimaryRouteId).toBe(
      "graduate_shortened_nursing_degree",
    );
  });

  it("graduate route with 'unsure' subject → verification-required", () => {
    const out = run(
      base({
        startingPoint: "graduate_non_nursing",
        highestQualification: "bachelors_other",
        degreeBackgroundSubject: "unsure",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
  });

  it("nursing-associate progression does NOT appear for complete beginner", () => {
    const out = run(
      base({ startingPoint: "complete_beginner", highestQualification: "gcse" }),
    );
    const nap = out.routeEvaluations.find(
      (r) => r.id === "nursing_associate_to_registered_nurse",
    )!;
    expect(nap.eligible).toBe(false);
  });

  it("return-to-practice does NOT appear for users never previously registered", () => {
    const out = run(base());
    const rtp = out.routeEvaluations.find((r) => r.id === "return_to_practice")!;
    expect(rtp.eligible).toBe(false);
  });

  it("overseas-trained user does NOT get UK beginner degree as primary", () => {
    const out = run(
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
      }),
    );
    expect(out.recommendedRouteId).toBeNull();
    expect(out.verificationPrimaryRouteId).toBe(
      "overseas_trained_nurse_registration",
    );
  });

  it("currently registered other field → verification, no fabricated route", () => {
    const out = run(
      base({
        startingPoint: "already_registered_nurse_other_field",
        registrationBackground: "current_nmc_registration_other_field",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
    expect(out.recommendedRouteId).toBeNull();
  });
});

// ── Contract invariants ─────────────────────────────────────────────────────
describe("Registered Nurse — contract invariants", () => {
  it("priorities reorder eligible routes but never change eligibility", () => {
    const s1 = base({
      startingPoint: "currently_healthcare_support_worker",
      currentHealthcareEmployment: "employed_healthcare_support_role",
      employerSupport: "employer_support_confirmed",
      routePriorities: ["employer_supported"],
    });
    const s2 = { ...s1, routePriorities: ["university_route"] };
    const out1 = run(s1);
    const out2 = run(s2);
    const eligible = (o: ReturnType<typeof run>) =>
      o.routeEvaluations.filter((r) => r.eligible).map((r) => r.id).sort();
    expect(eligible(out1)).toEqual(eligible(out2));
  });

  it("targetNursingField never changes eligibility across all values", () => {
    const fields: RegisteredNurseSignals["targetNursingField"][] = [
      "adult",
      "child",
      "mental_health",
      "learning_disability",
      "not_sure",
    ];
    const eligibleSets = fields.map((f) => {
      const out = run(base({ targetNursingField: f }));
      return out.routeEvaluations
        .filter((r) => r.eligible)
        .map((r) => r.id)
        .sort();
    });
    for (const set of eligibleSets) expect(set).toEqual(eligibleSets[0]);
  });

  it("missing critical signals → insufficient_information", () => {
    for (const key of [
      "startingPoint",
      "highestQualification",
      "mathsEnglishScienceStatus",
      "currentHealthcareEmployment",
      "studyPatternAvailable",
    ] as const) {
      const out = run(base({ [key]: null } as never));
      expect(out.status).toBe("insufficient_information");
    }
  });

  it("bridging_required result renders zero route cards", () => {
    const result = buildRegisteredNurseResult({
      signals: base({
        startingPoint: "complete_beginner",
        highestQualification: "gcse",
      }),
    });
    expect(result.modular!.status).toBe("bridging_required");
    expect(result.modular!.routes.length).toBe(0);
  });
});

// ── Non-approved diploma warning + NMC footer ───────────────────────────────
describe("Registered Nurse — warnings and footer", () => {
  const runResult = (s: RegisteredNurseSignals) =>
    buildRegisteredNurseResult({ signals: s });
  const hasBoth = (checks: string[]) =>
    checks.some((c) => c.includes("nursing diplomas")) &&
    checks.some((c) => c.includes("NMC-approved programmes"));

  it("non-approved warning + NMC footer present in route_recommended", () => {
    const r = runResult(base());
    expect(r.modular!.status).toBe("route_recommended");
    expect(hasBoth(r.modular!.checksBeforeCommitting)).toBe(true);
  });

  it("non-approved warning + NMC footer present in qualification_verification_required", () => {
    const r = runResult(
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
    );
    expect(r.modular!.status).toBe("qualification_verification_required");
    expect(hasBoth(r.modular!.checksBeforeCommitting)).toBe(true);
  });

  it("non-approved warning + NMC footer present in bridging_required", () => {
    const r = runResult(
      base({
        startingPoint: "complete_beginner",
        highestQualification: "gcse",
      }),
    );
    expect(r.modular!.status).toBe("bridging_required");
    expect(hasBoth(r.modular!.checksBeforeCommitting)).toBe(true);
  });

  it("warning strings are exported constants", () => {
    expect(NON_APPROVED_DIPLOMA_WARNING).toMatch(/nursing diplomas/);
    expect(NMC_APPROVED_FOOTER).toMatch(/NMC-approved programmes/);
  });
});

// ── Verification card-kind invariants ───────────────────────────────────────
describe("Registered Nurse — verification card kinds", () => {
  it("qualification_verification_required contains no recommended/backup cards", () => {
    const scenarios: RegisteredNurseSignals[] = [
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
      base({
        startingPoint: "previously_registered_nurse",
        registrationBackground: "previous_nmc_registration_lapsed",
      }),
      base({
        startingPoint: "already_registered_nurse_other_field",
        registrationBackground: "current_nmc_registration_other_field",
      }),
      base({
        startingPoint: "graduate_non_nursing",
        highestQualification: "bachelors_other",
        degreeBackgroundSubject: "other_subject",
      }),
    ];
    for (const s of scenarios) {
      const r = buildRegisteredNurseResult({ signals: s });
      expect(r.modular!.status).toBe("qualification_verification_required");
      for (const c of r.modular!.routes) {
        expect(c.kind).not.toBe("recommended");
        expect(c.kind).not.toBe("backup");
      }
    }
  });

  it("overseas-trained: primary is investigate_after_check, UK routes may_open_later", () => {
    const r = buildRegisteredNurseResult({
      signals: base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
    });
    const primary = r.modular!.routes[0];
    expect(primary.kind).toBe("investigate_after_check");
    expect(primary.title).toBe(
      ROUTE_TITLES.overseas_trained_nurse_registration,
    );
    for (const c of r.modular!.routes.slice(1)) {
      expect(c.kind).toBe("may_open_later");
    }
  });
});

// ── §11 tests 32–37 (v3 corrections) ────────────────────────────────────────
describe("Registered Nurse — v3 correction invariants", () => {
  it("overseas_nursing_qualification never counts as Level 3", () => {
    const statuses = (["english_maths_science_gcse_met", "unsure"] as const).map(
      (m) => {
        const out = run(
          base({
            highestQualification: "overseas_nursing_qualification",
            mathsEnglishScienceStatus: m,
          }),
        );
        const deg = out.routeEvaluations.find(
          (r) => r.id === "pre_registration_nursing_degree",
        )!;
        return deg.eligible;
      },
    );
    for (const eligible of statuses) expect(eligible).toBe(false);
  });

  it("highestQualification=unknown alone → insufficient_information", () => {
    const out = run(base({ highestQualification: "unknown" }));
    expect(out.status).toBe("insufficient_information");
    expect(out.blockersAndChecks.join(" ")).toMatch(
      /highest qualification level/i,
    );
  });

  it("highestQualification=unknown + overseas trigger → verification", () => {
    const out = run(
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "unknown",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
    );
    expect(out.status).toBe("qualification_verification_required");
  });

  it("mathsEnglishScienceStatus=unsure → RNDA not directly eligible", () => {
    const out = run(
      base({
        startingPoint: "currently_healthcare_support_worker",
        currentHealthcareEmployment: "employed_healthcare_support_role",
        employerSupport: "employer_support_confirmed",
        mathsEnglishScienceStatus: "unsure",
      }),
    );
    const rnda = out.routeEvaluations.find(
      (r) => r.id === "registered_nurse_degree_apprenticeship",
    )!;
    expect(rnda.eligible).toBe(false);
  });

  it("mathsEnglishScienceStatus=unsure → degree not directly eligible", () => {
    const out = run(base({ mathsEnglishScienceStatus: "unsure" }));
    const deg = out.routeEvaluations.find(
      (r) => r.id === "pre_registration_nursing_degree",
    )!;
    expect(deg.eligible).toBe(false);
  });

  it("healthcare_clinical is an existing taxonomy family (not a new one)", () => {
    expect(ROUTE_FAMILIES).toContain("healthcare_clinical");
  });

  it("registered-nurse taxonomy entry uses single-value secondaryArchetype='mixed_route'", () => {
    const e = getTaxonomyEntry("registered-nurse")!;
    expect(e.primaryFamily).toBe("healthcare_clinical");
    expect(e.routeArchetype).toBe("regulated_registration_led");
    expect(e.secondaryArchetype).toBe("mixed_route");
    expect(Array.isArray((e as unknown as { secondaryArchetype: unknown }).secondaryArchetype)).toBe(false);
  });

  it("slug / engineId / questionnaireVersion / draft key are consistent", () => {
    expect(registeredNurseConfig.roleSlug).toBe("registered-nurse");
    expect(registeredNurseConfig.engineId).toBe("registered-nurse-v1");
    expect(registeredNurseConfig.questionnaireVersion).toBe(
      "registered-nurse-v1",
    );
    expect(
      modularDraftKey(
        registeredNurseConfig.roleSlug,
        registeredNurseConfig.questionnaireVersion,
      ),
    ).toBe("reality-check-draft:registered-nurse:registered-nurse-v1");
  });
});

// ── Safety static tests (25a/b/c) ───────────────────────────────────────────
describe("Registered Nurse — safety static tests", () => {
  // Allow the `learning_disability` / "Learning disability nursing" NMC
  // field-of-practice token; ban health-condition / disability disclosure
  // language everywhere else.
  const BANNED = [
    /\bhealth condition\b/i,
    /\bmedical history\b/i,
    /\bpregnan/i,
    /\bcriminal/i,
    /\bconviction/i,
    /\bDBS\b/,
    /\boccupational[-\s_]health\b/i,
    /\bimmigration\b/i,
    /\bvisa\b/i,
    /\bright[-\s_]to[-\s_]work\b/i,
  ];
  // Field-of-practice allow-list token that must NOT be caught by BANNED.
  const FIELD_ALLOW = /(learning[-\s_]disability|learning_disability)/i;
  const questionTexts = registeredNurseConfig.questions.flatMap((q) => [
    q.id,
    q.title,
    q.whyWeAsk,
    ...(q.options?.flatMap((o) => [o.value, o.label]) ?? []),
  ]);

  it("no question asks the user to disclose banned kinds", () => {
    for (const text of questionTexts) {
      for (const re of BANNED) {
        expect(text).not.toMatch(re);
      }
    }
  });

  it("no free-form 'disability' disclosure outside the NMC field-of-practice token", () => {
    for (const text of questionTexts) {
      if (/\bdisabilit/i.test(text) && !FIELD_ALLOW.test(text)) {
        throw new Error(`Disallowed disability disclosure text: ${text}`);
      }
    }
  });

  it("healthcare / health_related / health_science vocabulary IS permitted", () => {
    const joined = questionTexts.join(" ");
    expect(joined).toMatch(/healthcare/);
    expect(joined).toMatch(/health-related|health_related/);
    expect(joined).toMatch(/health.{0,10}science|health_science/i);
  });

  it("no result copy contains eligibility/guarantee claims", () => {
    const forbidden = [
      /you are eligible/i,
      /you can register/i,
      /you will be accepted/i,
      /guarantee/i,
    ];
    const scenarios: RegisteredNurseSignals[] = [
      base(),
      base({
        startingPoint: "trained_as_nurse_outside_uk",
        highestQualification: "overseas_nursing_qualification",
        registrationBackground: "overseas_trained_not_on_nmc_register",
      }),
      base({
        startingPoint: "complete_beginner",
        highestQualification: "gcse",
      }),
    ];
    for (const s of scenarios) {
      const r = buildRegisteredNurseResult({ signals: s });
      const text = JSON.stringify(r);
      for (const re of forbidden) expect(text).not.toMatch(re);
    }
  });
});

// ── Regression: existing frozen roles + taxonomy freeze ─────────────────────
describe("Registered Nurse — taxonomy freeze update", () => {
  it("FROZEN_DEEP_ROLES grows by exactly 1 and includes registered-nurse", () => {
    expect(FROZEN_DEEP_ROLES).toContain("registered-nurse");
    expect(FROZEN_DEEP_ROLES.length).toBe(5);
    for (const s of ["electrician", "plumber", "hvac-engineer", "software-engineer"]) {
      expect(FROZEN_DEEP_ROLES).toContain(s);
    }
  });

  it("registered-nurse taxonomy depth is deep_reviewed_reality_check", () => {
    const e = getTaxonomyEntry("registered-nurse")!;
    expect(e.recommendedRealityCheckDepth).toBe("deep_reviewed_reality_check");
  });
});

// ── Sources ─────────────────────────────────────────────────────────────────
describe("Registered Nurse — sources", () => {
  it("registry includes NMC + apprenticeship + careers sources", () => {
    expect(SOURCES.nmc).toBeDefined();
    expect(SOURCES.nmc_becoming_a_nurse).toBeDefined();
    expect(SOURCES.nmc_overseas).toBeDefined();
    expect(SOURCES.nmc_return_to_practice).toBeDefined();
    expect(SOURCES.national_careers).toBeDefined();
    expect(SOURCES.skills_england_rnda).toBeDefined();
  });

  it("registry includes the two source patches required before manual QA", () => {
    expect(SOURCES.nmc_approved_programmes).toBeDefined();
    expect(SOURCES.nmc_approved_programmes.organisation).toMatch(/Nursing and Midwifery Council/);
    expect(SOURCES.national_careers_registered_nurse).toBeDefined();
    expect(SOURCES.national_careers_registered_nurse.organisation).toMatch(/National Careers Service/);
  });

  it("non-approved diploma warning cites the NMC approved-programmes source (by wording)", () => {
    // The warning copy references the NMC approved-programmes list; the
    // `nmc_approved_programmes` source is the citation for that copy.
    expect(NON_APPROVED_DIPLOMA_WARNING).toMatch(/NMC approved-programmes list/i);
    expect(SOURCES.nmc_approved_programmes.usage).toMatch(/non-approved nursing diploma warning/i);
  });

  it("NMC-approved-programme footer cites the NMC approved-programmes source (by wording)", () => {
    expect(NMC_APPROVED_FOOTER).toMatch(/NMC-approved/i);
    expect(SOURCES.nmc_approved_programmes.usage).toMatch(/approved-programme requirement/i);
  });

  it("public route explanation source covers the four public-facing UK nursing routes", () => {
    const usage = SOURCES.national_careers_registered_nurse.usage;
    expect(usage).toMatch(/degree/i);
    expect(usage).toMatch(/apprenticeship/i);
    expect(usage).toMatch(/nursing associate|assistant practitioner/i);
    expect(usage).toMatch(/graduate/i);
  });

  it("getSourcesForResult for Registered Nurse includes both patched sources on a recommended result", async () => {
    const { getSourcesForResult } = await import("../sources");
    const engineOut = run(base());
    // Minimal RealityCheckResult shim — sources selection reads titles only.
    const result = {
      bestRoute: { title: ROUTE_TITLES[engineOut.recommendedRouteId ?? "pre_registration_nursing_degree"] },
      backupRoute: undefined,
    } as unknown as Parameters<typeof getSourcesForResult>[2];
    const role = { role_slug: "registered-nurse", role_name: "Registered Nurse" } as never;
    const ids = getSourcesForResult(role, {} as never, result).map((s) => s.id);
    expect(ids).toContain("nmc_approved_programmes");
    expect(ids).toContain("national_careers_registered_nurse");
    expect(ids).toContain("nmc_becoming_a_nurse");
    expect(ids).toContain("skills_england_rnda");
  });
});

// ── Shared parity fixture ───────────────────────────────────────────────────
describe("Registered Nurse — shared fixture parity", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it.each((fixtures as any[]).map((c) => [c.name, c]))(
    "case: %s",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_name, c: any) => {
      const out = runRegisteredNurseEngine({ signals: c.signals });
      if (c.expected.status !== undefined) {
        expect(out.status).toBe(c.expected.status);
      }
      if (c.expected.recommendedRouteId !== undefined) {
        expect(out.recommendedRouteId).toBe(c.expected.recommendedRouteId);
      }
      if (c.expected.recommendedRouteMustNotBe) {
        expect(out.recommendedRouteId).not.toBe(
          c.expected.recommendedRouteMustNotBe,
        );
      }
      if (c.expected.verificationPrimaryRouteId) {
        expect(out.verificationPrimaryRouteId).toBe(
          c.expected.verificationPrimaryRouteId,
        );
      }
    },
  );
});

// ── ROUTE_TITLES coverage ───────────────────────────────────────────────────
describe("Registered Nurse — ROUTE_TITLES coverage", () => {
  it("exposes titles for every recommendable route id", () => {
    const ids: RegisteredNurseRouteId[] = [
      "pre_registration_nursing_degree",
      "registered_nurse_degree_apprenticeship",
      "nursing_associate_to_registered_nurse",
      "graduate_shortened_nursing_degree",
      "overseas_trained_nurse_registration",
      "return_to_practice",
    ];
    for (const id of ids) expect(ROUTE_TITLES[id]).toBeTruthy();
  });
});
