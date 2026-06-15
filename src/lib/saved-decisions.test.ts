import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the supabase client before importing the module under test.
const insertMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => {
        insertMock(...args);
        return {
          select: () => ({
            single: async () => ({ data: { id: "saved-1" }, error: null }),
          }),
        };
      },
    }),
  },
}));

import {
  __resetFlushGuard,
  clearPendingDecision,
  flushPendingDecision,
  readPendingDecision,
  stashPendingDecision,
} from "./saved-decisions";
import type { RealityCheckAnswers, RealityCheckResult, RoleContext } from "./reality-check/types";

const role: RoleContext = {
  id: "role-1",
  role_slug: "registered-nurse",
  role_name: "Registered Nurse",
};

const answers: RealityCheckAnswers = {
  startingPoint: "graduate",
  incomeNeed: "need_income",
  weeklyHours: "10_20",
  budget: "under_500",
  area: "Manchester",
  commuteFlex: "60_min",
  notes: "",
};

const result = {
  overallVerdict: "Realistic",
  bestRoute: { title: "RNDA Apprenticeship", summary: "", whyThisFits: [], estimatedTime: "", likelyCost: "", mainDifficulty: "", confidence: "high" },
  backupRoute: { title: "MSc pre-reg", summary: "", tradeOff: "" },
  routeToAvoid: { title: "Self-funded BSc", whyRisky: "", whenItMightWork: "" },
  localRealism: { rating: "strong", summary: "", dependsOn: [] },
  firstMoves: ["Search NHS Jobs"],
} as unknown as RealityCheckResult;

beforeEach(() => {
  localStorage.clear();
  insertMock.mockClear();
  __resetFlushGuard();
});

describe("pending decision: stash / read / clear", () => {
  it("stashes and reads back", () => {
    stashPendingDecision(role, answers, result);
    const p = readPendingDecision();
    expect(p?.role.role_slug).toBe("registered-nurse");
    expect(p?.answers.area).toBe("Manchester");
  });

  it("clears pending decision", () => {
    stashPendingDecision(role, answers, result);
    clearPendingDecision();
    expect(readPendingDecision()).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    localStorage.setItem("cr_pending_decision", "{not json");
    expect(readPendingDecision()).toBeNull();
  });
});

describe("flushPendingDecision", () => {
  it("returns false safely when nothing is pending", async () => {
    expect(await flushPendingDecision("user-1")).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("saves exactly once and clears the pending entry", async () => {
    stashPendingDecision(role, answers, result);
    const ok = await flushPendingDecision("user-1");
    expect(ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(readPendingDecision()).toBeNull();
  });

  it("does not double-save when flush is invoked twice concurrently", async () => {
    stashPendingDecision(role, answers, result);
    const [a, b] = await Promise.all([
      flushPendingDecision("user-1"),
      flushPendingDecision("user-1"),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("does not double-save when flush is invoked twice sequentially", async () => {
    stashPendingDecision(role, answers, result);
    await flushPendingDecision("user-1");
    await flushPendingDecision("user-1");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("discards a malformed pending decision without throwing", async () => {
    localStorage.setItem("cr_pending_decision", JSON.stringify({ junk: true }));
    const ok = await flushPendingDecision("user-1");
    expect(ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
    expect(readPendingDecision()).toBeNull();
  });
});
