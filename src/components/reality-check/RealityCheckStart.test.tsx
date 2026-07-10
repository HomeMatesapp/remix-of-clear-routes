import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RealityCheckStart } from "./RealityCheckStart";

const trackEvent = vi.fn();
vi.mock("@/lib/posthog", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe("RealityCheckStart", () => {
  beforeEach(() => {
    trackEvent.mockClear();
  });

  it("renders the headline, all four value points, and the reassurance copy", () => {
    render(<RealityCheckStart roleName="Solicitor" roleSlug="solicitor" onStart={() => {}} />);

    expect(
      screen.getByRole("heading", { name: /check which routes look realistic for you/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/routes that fit your current qualifications, budget, timeline, and work needs/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/why a route looks realistic, risky, or blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/practical next actions, not just a verdict/i)).toBeInTheDocument();
    expect(
      screen.getByText(/save your result and reassess later if your situation changes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you do not need to know your route yet/i),
    ).toBeInTheDocument();
  });

  it("fires the viewed event once on mount with the role slug", () => {
    render(<RealityCheckStart roleName="Solicitor" roleSlug="solicitor" onStart={() => {}} />);
    const viewed = trackEvent.mock.calls.filter(
      (c) => c[0] === "reality_check_start_screen_viewed",
    );
    expect(viewed).toHaveLength(1);
    expect(viewed[0][1]).toEqual({ role_slug: "solicitor" });
  });

  it("clicking Start fires the click event and enters the questionnaire", async () => {
    const onStart = vi.fn();
    render(<RealityCheckStart roleName="Solicitor" roleSlug="solicitor" onStart={onStart} />);

    await userEvent.click(screen.getByRole("button", { name: /start reality check/i }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("reality_check_start_clicked", {
      role_slug: "solicitor",
    });
  });
});
