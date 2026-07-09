// Product-facing showcase of the seven release-hardened Reality Checks.
// Purpose: make the deterministic coverage visible and commercially legible.
// This is a presentation-only component — it does not change any route logic.

import { Link } from "react-router-dom";
import { FROZEN_DEEP_ROLES } from "@/lib/roles/role-taxonomy";

export type RouteProblemType =
  | "skilled_trades"
  | "digital_portfolio_led"
  | "regulated_healthcare"
  | "public_service_selection"
  | "creative_gig_uncertainty"
  | "regulated_professional_multi_route";

export interface ReviewedShowcaseRole {
  slug: string;
  name: string;
  routeProblem: RouteProblemType;
  routeProblemLabel: string;
  note: string;
}

// Order and copy are stable — tests rely on this list matching FROZEN_DEEP_ROLES.
export const REVIEWED_SHOWCASE_ROLES: ReviewedShowcaseRole[] = [
  {
    slug: "electrician",
    name: "Electrician",
    routeProblem: "skilled_trades",
    routeProblemLabel: "Skilled trades",
    note: "Apprenticeship-led with regulated competence checks.",
  },
  {
    slug: "plumber",
    name: "Plumber",
    routeProblem: "skilled_trades",
    routeProblemLabel: "Skilled trades",
    note: "Apprenticeship-led with gas-work licensing risks.",
  },
  {
    slug: "hvac-engineer",
    name: "HVAC engineer",
    routeProblem: "skilled_trades",
    routeProblemLabel: "Skilled trades",
    note: "F-Gas and refrigerant handling gates paid work.",
  },
  {
    slug: "software-engineer",
    name: "Software engineer",
    routeProblem: "digital_portfolio_led",
    routeProblemLabel: "Digital / portfolio-led",
    note: "Evidence-of-work matters more than a specific qualification.",
  },
  {
    slug: "registered-nurse",
    name: "Registered nurse",
    routeProblem: "regulated_healthcare",
    routeProblemLabel: "Regulated healthcare",
    note: "NMC registration is mandatory; routes hinge on approved study.",
  },
  {
    slug: "police-officer",
    name: "Police officer",
    routeProblem: "public_service_selection",
    routeProblemLabel: "Public-service selection",
    note: "Force-led selection with vetting and residency requirements.",
  },
  {
    slug: "actor",
    name: "Actor",
    routeProblem: "creative_gig_uncertainty",
    routeProblemLabel: "Creative / gig uncertainty",
    note: "Evidence-and-risk checker — no route guarantees auditions or income.",
  },
  {
    slug: "solicitor",
    name: "Solicitor",
    routeProblem: "regulated_professional_multi_route",
    routeProblemLabel: "Regulated professional (multi-route)",
    note: "SQE, apprenticeship, conversion, QWE and LPC transitional routes — SRA decides admission.",
  },
];

export const ROUTE_PROBLEM_TYPES: {
  id: RouteProblemType;
  label: string;
  description: string;
}[] = [
  { id: "skilled_trades", label: "Skilled trades", description: "Electrician · Plumber · HVAC" },
  { id: "digital_portfolio_led", label: "Digital / portfolio-led", description: "Software engineer" },
  { id: "regulated_healthcare", label: "Regulated healthcare", description: "Registered nurse" },
  { id: "public_service_selection", label: "Public-service selection", description: "Police officer" },
  { id: "creative_gig_uncertainty", label: "Creative / gig uncertainty", description: "Actor" },
  { id: "regulated_professional_multi_route", label: "Regulated professional (multi-route)", description: "Solicitor" },
];

export const REVIEWED_PROOF_COPY =
  "Clear Routes now supports deterministic, source-backed route checks across regulated, apprenticeship-led, portfolio-led, selection-led, gig/creative and regulated-professional multi-route careers.";

// Guardrail: keep the showcase list one-to-one with the frozen role set.
// Any drift is caught by the accompanying test — do not silently diverge.
export function assertShowcaseCoversFrozen(): void {
  const showcase = REVIEWED_SHOWCASE_ROLES.map((r) => r.slug).sort();
  const frozen = [...FROZEN_DEEP_ROLES].sort();
  if (showcase.length !== frozen.length || showcase.some((s, i) => s !== frozen[i])) {
    throw new Error(
      `ReviewedShowcase drift: showcase=${showcase.join(",")} frozen=${frozen.join(",")}`,
    );
  }
}

export function ReviewedShowcase() {
  return (
    <section
      data-testid="reviewed-showcase"
      className="py-16 md:py-20 border-t-2 border-ink bg-tint"
    >
      <div className="container mx-auto px-4 md:px-8 max-w-5xl">
        <p className="font-mono text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
          Deep Reality Checks
        </p>
        <h2 className="font-display font-extrabold text-[clamp(1.75rem,4vw,2.75rem)] mt-2.5 text-foreground max-w-[22ch]">
          Eight careers, six different route problems.
        </h2>
        <p className="mt-4 text-[15.5px] text-foreground/80 max-w-[62ch] leading-relaxed">
          {REVIEWED_PROOF_COPY}
        </p>

        {/* Route problem type strip */}
        <ul
          data-testid="route-problem-types"
          className="mt-6 flex flex-wrap gap-2"
        >
          {ROUTE_PROBLEM_TYPES.map((p) => (
            <li
              key={p.id}
              data-problem-type={p.id}
              className="font-mono text-[12px] border-[1.5px] border-ink rounded-full bg-card px-3 py-1.5 text-foreground"
            >
              <span className="font-semibold">{p.label}</span>
              <span className="text-muted-foreground"> · {p.description}</span>
            </li>
          ))}
        </ul>

        {/* Reviewed role cards */}
        <ul className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {REVIEWED_SHOWCASE_ROLES.map((r) => (
            <li key={r.slug}>
              <Link
                to={`/role/${r.slug}/reality-check`}
                data-testid={`reviewed-role-${r.slug}`}
                className="block h-full border-2 border-ink rounded-[6px] bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-lg text-foreground">
                    {r.name}
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-[3px] bg-wood text-white">
                    Reviewed
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
                  {r.routeProblemLabel}
                </p>
                <p className="mt-2 text-[14px] text-foreground/80 leading-relaxed">
                  {r.note}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 font-mono text-xs text-muted-foreground">
          Deterministic route logic · official/public sources · no LLM-generated verdicts.{" "}
          <Link
            to="/how-it-works#methodology"
            className="underline underline-offset-4 hover:text-primary"
          >
            Read the methodology →
          </Link>
        </p>
      </div>
    </section>
  );
}
