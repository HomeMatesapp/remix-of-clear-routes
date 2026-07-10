import { describe, expect, it } from "vitest";
import { shouldShowStartScreen } from "./start-screen";

const base = {
  hydrated: true,
  hasResult: false,
  hadSavedProgress: false,
  startAcknowledged: false,
};

describe("shouldShowStartScreen", () => {
  it("shows for a fresh visit once hydration has finished", () => {
    expect(shouldShowStartScreen(base)).toBe(true);
  });

  it("never shows before hydration completes (avoids a flash for resumers)", () => {
    expect(shouldShowStartScreen({ ...base, hydrated: false })).toBe(false);
  });

  it("bypasses when a draft or in-progress answers exist (save/resume preserved)", () => {
    expect(shouldShowStartScreen({ ...base, hadSavedProgress: true })).toBe(false);
  });

  it("bypasses when a session result was restored", () => {
    expect(shouldShowStartScreen({ ...base, hasResult: true })).toBe(false);
  });

  it("hides after the user clicks Start", () => {
    expect(shouldShowStartScreen({ ...base, startAcknowledged: true })).toBe(false);
  });
});
