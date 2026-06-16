import { describe, it, expect } from "vitest";
import { matchRoleAliases } from "./role-aliases";

describe("matchRoleAliases", () => {
  it("matches 'software engineer' as exact alias of software-engineer", () => {
    const m = matchRoleAliases("software engineer");
    expect(m[0]).toMatchObject({ slug: "software-engineer", tier: "exact" });
  });

  it("matches 'software developer' as alias", () => {
    const m = matchRoleAliases("software developer");
    expect(m.find((x) => x.slug === "software-engineer")?.tier).toBeDefined();
  });

  it("matches plain 'developer'", () => {
    const m = matchRoleAliases("developer");
    expect(m.some((x) => x.slug === "software-engineer")).toBe(true);
  });

  it("matches 'programmer'", () => {
    expect(matchRoleAliases("programmer").some((x) => x.slug === "software-engineer")).toBe(true);
  });

  it("matches typo 'devloper'", () => {
    const m = matchRoleAliases("devloper");
    expect(m.some((x) => x.slug === "software-engineer" && x.tier === "fuzzy")).toBe(true);
  });

  it("matches typo 'sotwaree engineer'", () => {
    const m = matchRoleAliases("sotwaree engineer");
    expect(m.some((x) => x.slug === "software-engineer")).toBe(true);
  });

  it("ignores empty / very short queries", () => {
    expect(matchRoleAliases("")).toEqual([]);
    expect(matchRoleAliases("a")).toEqual([]);
  });

  it("does not match unrelated terms", () => {
    expect(matchRoleAliases("nurse")).toEqual([]);
    expect(matchRoleAliases("electrician")).toEqual([]);
  });
});
