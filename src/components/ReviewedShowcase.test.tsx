// Product-facing pass: verify the eight release-hardened Reality Checks
// remain visible in the showcase and still open through the reviewed gate.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  REVIEWED_SHOWCASE_ROLES,
  ROUTE_PROBLEM_TYPES,
  REVIEWED_PROOF_COPY,
  ReviewedShowcase,
  assertShowcaseCoversFrozen,
} from "./ReviewedShowcase";
import { FROZEN_DEEP_ROLES } from "@/lib/roles/role-taxonomy";
import { hasReviewedModularRealityCheck } from "@/lib/reality-check/questionnaire/registry";

describe("ReviewedShowcase", () => {
  it("covers exactly the eight frozen deep-reviewed roles", () => {
    expect(FROZEN_DEEP_ROLES).toHaveLength(8);
    expect(REVIEWED_SHOWCASE_ROLES).toHaveLength(FROZEN_DEEP_ROLES.length);
    expect(REVIEWED_SHOWCASE_ROLES.map((r) => r.slug).sort()).toEqual(
      [...FROZEN_DEEP_ROLES].sort(),
    );
    expect(REVIEWED_SHOWCASE_ROLES.map((r) => r.slug)).toContain("solicitor");
    expect(() => assertShowcaseCoversFrozen()).not.toThrow();
  });

  it("includes the regulated_professional_multi_route problem type introduced by Solicitor", () => {
    expect(ROUTE_PROBLEM_TYPES.map((p) => p.id)).toContain(
      "regulated_professional_multi_route",
    );
    const solicitor = REVIEWED_SHOWCASE_ROLES.find((r) => r.slug === "solicitor");
    expect(solicitor?.routeProblem).toBe("regulated_professional_multi_route");
  });

  it("every showcase role still resolves through the reviewed modular gate", () => {
    for (const r of REVIEWED_SHOWCASE_ROLES) {
      expect(
        hasReviewedModularRealityCheck(r.slug),
        `${r.slug} must resolve a reviewed modular Reality Check`,
      ).toBe(true);
    }
  });

  it("declares six distinct route-problem types (one per proven category)", () => {
    const uniqueProblems = new Set(REVIEWED_SHOWCASE_ROLES.map((r) => r.routeProblem));
    expect(uniqueProblems.size).toBe(6);
    expect(ROUTE_PROBLEM_TYPES.map((p) => p.id).sort()).toEqual(
      [...uniqueProblems].sort(),
    );
  });

  it("renders every reviewed role linking to its Reality Check route", () => {
    render(
      <MemoryRouter>
        <ReviewedShowcase />
      </MemoryRouter>,
    );
    for (const r of REVIEWED_SHOWCASE_ROLES) {
      const link = screen.getByTestId(`reviewed-role-${r.slug}`);
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe(`/role/${r.slug}/reality-check`);
      expect(link.textContent).toContain(r.name);
      expect(link.textContent).toContain(r.routeProblemLabel);
    }
  });

  it("renders every route-problem type and the proof copy", () => {
    render(
      <MemoryRouter>
        <ReviewedShowcase />
      </MemoryRouter>,
    );
    const strip = screen.getByTestId("route-problem-types");
    for (const p of ROUTE_PROBLEM_TYPES) {
      expect(strip.querySelector(`[data-problem-type="${p.id}"]`)).toBeTruthy();
    }
    expect(screen.getByText(REVIEWED_PROOF_COPY)).toBeTruthy();
  });
});
