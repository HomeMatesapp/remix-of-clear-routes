import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ResultForwardDoors } from "./ResultForwardDoors";
import type { RoleContext } from "@/lib/reality-check/types";

const trackEvent = vi.fn();
vi.mock("@/lib/posthog", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const role: RoleContext = { role_slug: "solicitor", role_name: "Solicitor" };

const renderDoors = (
  props: Partial<React.ComponentProps<typeof ResultForwardDoors>> = {},
) =>
  render(
    <MemoryRouter>
      <ResultForwardDoors
        role={role}
        status="route_recommended"
        hasRoutes
        recommendedRouteTitle="Solicitor apprenticeship"
        {...props}
      />
    </MemoryRouter>,
  );

describe("ResultForwardDoors", () => {
  beforeEach(() => {
    trackEvent.mockClear();
  });

  it("renders all four doors for a recommended route", () => {
    renderDoors();
    expect(screen.getByText("Save this result")).toBeInTheDocument();
    expect(screen.getByText("Compare routes")).toBeInTheDocument();
    expect(screen.getByText("Build My Route")).toBeInTheDocument();
    expect(screen.getByText("Reassess later")).toBeInTheDocument();
  });

  it("Compare button uses the canonical label and never the pre-review string (sign-off criterion)", () => {
    renderDoors();
    expect(
      screen.getByRole("button", { name: /review your route cards/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/see your routes side by side/i)).not.toBeInTheDocument();
  });

  it("bridging_required omits Build My Route but keeps Save, Compare and Reassess", () => {
    renderDoors({ status: "bridging_required" });
    expect(screen.getByText("Save this result")).toBeInTheDocument();
    expect(screen.getByText("Compare routes")).toBeInTheDocument();
    expect(screen.queryByText("Build My Route")).not.toBeInTheDocument();
    expect(screen.getByText("Reassess later")).toBeInTheDocument();
  });

  it("qualification_verification_required without route cards shows Save and Reassess only", () => {
    renderDoors({ status: "qualification_verification_required", hasRoutes: false });
    expect(screen.getByText("Save this result")).toBeInTheDocument();
    expect(screen.queryByText("Compare routes")).not.toBeInTheDocument();
    expect(screen.queryByText("Build My Route")).not.toBeInTheDocument();
    expect(screen.getByText("Reassess later")).toBeInTheDocument();
  });

  it("insufficient_information renders nothing", () => {
    const { container } = renderDoors({ status: "insufficient_information" });
    expect(container).toBeEmptyDOMElement();
  });

  it("save door fires a consent-gated door event with role, status and route title", async () => {
    renderDoors();
    await userEvent.click(screen.getByRole("button", { name: /go to save/i }));
    expect(trackEvent).toHaveBeenCalledWith("result_forward_door_clicked", {
      role_slug: "solicitor",
      status: "route_recommended",
      has_recommended_route: true,
      door: "save",
    });
  });

  it("reassess fires both events and swaps to honest confirmation copy with no persistence claim", async () => {
    renderDoors();
    await userEvent.click(screen.getByRole("button", { name: /i'll reassess later/i }));

    expect(trackEvent).toHaveBeenCalledWith(
      "result_forward_door_clicked",
      expect.objectContaining({ door: "reassess" }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      "reassess_intent_clicked",
      expect.objectContaining({ role_slug: "solicitor" }),
    );
    expect(screen.getByText(/run this check again and compare your results/i)).toBeInTheDocument();
    expect(screen.queryByText(/we('|)ll remind you|saved your reminder/i)).not.toBeInTheDocument();
  });

  it("save door copy never references hidden doors (bridging has no Build)", () => {
    renderDoors({ status: "bridging_required" });
    expect(screen.getByText(/come back to it and reassess/i)).toBeInTheDocument();
    expect(screen.queryByText(/build your plan/i)).not.toBeInTheDocument();
  });

  it("uses a real heading and focusable anchor navigation", async () => {
    const target = document.createElement("div");
    target.id = "save-route-check";
    target.tabIndex = -1;
    document.body.appendChild(target);
    renderDoors();
    expect(
      screen.getByRole("heading", { name: /where to go from here/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /go to save/i }));
    expect(document.activeElement).toBe(target);
    target.remove();
  });

  it("Build My Route links to the existing MyRoute page", () => {
    renderDoors();
    expect(screen.getByRole("link", { name: /open my route/i })).toHaveAttribute(
      "href",
      "/my-route",
    );
  });
});
