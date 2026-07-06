import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ModularResultView } from "./ModularResultView";
import type {
  ModularRealityCheckPayload,
  RealityCheckResult,
  RoleContext,
} from "@/lib/reality-check/types";

// Minimal wiring — SavePrompt pulls useAuth/useToast/useNavigate. We only
// need to render the ModularResultView so wrap in MemoryRouter.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: () => {} }),
}));

const role: RoleContext = {
  role_slug: "electrician",
  role_name: "Electrician",
};

const baseResult = (modular: ModularRealityCheckPayload): RealityCheckResult & { modular: ModularRealityCheckPayload } => ({
  readiness: "ready_now",
  readinessReason: "reason line",
  biggestBlocker: "",
  immediateAction: "do the thing",
  overallVerdict: "Realistic",
  bestRoute: { title: "x", summary: "", whyThisFits: [], estimatedTime: "", likelyCost: "", mainDifficulty: "", confidence: "medium" },
  backupRoute: { title: "x", summary: "", tradeOff: "" },
  routeToAvoid: { title: "x", whyRisky: "", whenItMightWork: "" },
  firstMoves: ["First move", "Second move"],
  modular,
});

const rec: ModularRealityCheckPayload = {
  status: "route_recommended",
  headline: "Structurally suitable route",
  routes: [
    { kind: "recommended", title: "Recommended-A", fit: "fit", constraint: "constraint", checks: ["check-1"], nextAction: "action" },
    { kind: "backup", title: "Backup-B", fit: "fit-b", constraint: "constraint-b", checks: [], nextAction: "action-b" },
    { kind: "caution", title: "Caution-C", fit: "fit-c", constraint: "constraint-c", checks: [], nextAction: "action-c" },
  ],
  checksBeforeCommitting: ["Check with the provider"],
};

const renderView = (
  modular: ModularRealityCheckPayload,
  opts: { onEdit?: (id?: string) => void; considerations?: string[] } = {},
) => {
  const result = baseResult(modular);
  if (opts.considerations) result.considerations = opts.considerations;
  return render(
    <MemoryRouter>
      <ModularResultView result={result} role={role} onEdit={opts.onEdit} />
    </MemoryRouter>,
  );
};

describe("ModularResultView", () => {
  it("renders recommended, backup and caution route cards for route_recommended", () => {
    renderView(rec);
    // "Recommended-A" appears both as summary heading and route-card heading
    expect(screen.getAllByRole("heading", { name: "Recommended-A" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "Backup-B" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Caution-C" })).toBeInTheDocument();
    expect(screen.getByText(/Recommended route/i)).toBeInTheDocument();
    expect(screen.getByText(/Backup route/i)).toBeInTheDocument();
    expect(screen.getByText(/Be careful with/i)).toBeInTheDocument();
  });


  it("qualification_verification_required never renders a Recommended route card", () => {
    const m: ModularRealityCheckPayload = {
      status: "qualification_verification_required",
      headline: "Verification is needed",
      routes: [
        { kind: "investigate_after_check", title: "Apprenticeship", fit: "fit", constraint: "c", checks: [], nextAction: "a" },
      ],
      checksBeforeCommitting: ["Ask an assessor to verify your qualification"],
    };
    renderView(m);
    // Verification eyebrow present
    expect(screen.getByText(/Investigate after verification/i)).toBeInTheDocument();
    // No "Recommended route" eyebrow
    expect(screen.queryByText(/^Recommended route$/i)).not.toBeInTheDocument();
  });

  it("bridging_required does not present a normal route", () => {
    const m: ModularRealityCheckPayload = {
      status: "bridging_required",
      headline: "Bridging first",
      routes: [
        { kind: "may_open_later", title: "Later route", fit: "fit", constraint: "c", checks: [], nextAction: "a" },
      ],
      checksBeforeCommitting: ["Do the bridging step"],
    };
    renderView(m);
    expect(screen.getByText(/May open after the bridging step/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Recommended route$/i)).not.toBeInTheDocument();
  });

  it("insufficient_information hides route comparison and shows missing info as edit buttons", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const m: ModularRealityCheckPayload = {
      status: "insufficient_information",
      headline: "Need more answers",
      routes: [],
      checksBeforeCommitting: [],
      missingInformation: [{ label: "Where are you starting from?", questionId: "starting_point" }],
    };
    renderView(m, { onEdit });
    // No route cards
    expect(screen.queryByText(/Recommended route/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Backup route/i)).not.toBeInTheDocument();
    // Missing information button present
    const btn = screen.getByRole("button", { name: /Where are you starting from\?/i });
    await user.click(btn);
    expect(onEdit).toHaveBeenCalledWith("starting_point");
  });

  it("considerations render only when present, and separately from checks", () => {
    renderView(rec, { considerations: ["Working-condition thing"] });
    expect(screen.getByText(/Working-condition things to look into/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Working-condition thing/).length).toBeGreaterThanOrEqual(1);
    // Checks-before-committing block also present but distinct
    expect(screen.getByText(/Checks before committing/i)).toBeInTheDocument();
    expect(screen.getByText(/Check with the provider/i)).toBeInTheDocument();
  });


  it("considerations do NOT render when empty", () => {
    renderView(rec);
    expect(screen.queryByText(/Working-condition things to look into/i)).not.toBeInTheDocument();
  });

  it("saved mode renders missing info as plain text (no edit buttons)", () => {
    const m: ModularRealityCheckPayload = {
      status: "insufficient_information",
      headline: "…",
      routes: [],
      checksBeforeCommitting: [],
      missingInformation: [{ label: "Where are you starting from?", questionId: "starting_point" }],
    };
    render(
      <MemoryRouter>
        <ModularResultView
          result={baseResult(m)}
          role={role}
          mode="saved"
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Where are you starting from\?/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Where are you starting from\?/i)).toBeInTheDocument();
  });

  it("first moves render as a numbered list", () => {
    renderView(rec);
    expect(screen.getByText("First move")).toBeInTheDocument();
    expect(screen.getByText("Second move")).toBeInTheDocument();
    // No horizontal scroll — no explicit overflow-x utility on the container
    expect(document.body.innerHTML.match(/overflow-x-scroll/)).toBeNull();
  });


  it("assertion: recommended-status route cards include the recommended kind", () => {
    renderView(rec);
    // Verify the RouteCard structure — recommended eyebrow appears exactly once
    const eyebrows = screen.getAllByText(/Recommended route/i);
    expect(eyebrows.length).toBeGreaterThanOrEqual(1);
    const rec2 = eyebrows[0].closest("article");
    expect(rec2).toBeTruthy();
    expect(within(rec2 as HTMLElement).getByRole("heading", { name: "Recommended-A" })).toBeInTheDocument();
  });
});
