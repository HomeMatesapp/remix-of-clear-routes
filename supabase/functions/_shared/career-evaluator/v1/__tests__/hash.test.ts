import { describe, expect, it } from "vitest";
import { canonicalStringify, canonicalHash, sha256Hex } from "../hash";

describe("canonicalStringify", () => {
  it("sorts object keys deterministically at every depth", () => {
    const a = { b: 1, a: { z: 1, y: [3, { m: 1, k: 2 }] } };
    const b = { a: { y: [3, { k: 2, m: 1 }], z: 1 }, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("preserves array order", () => {
    expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("differs when values differ", () => {
    expect(canonicalStringify({ a: 1 })).not.toBe(canonicalStringify({ a: 2 }));
  });
});

describe("sha256Hex", () => {
  it("matches the known digest for the empty string", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("canonicalHash", () => {
  it("is stable across key reorderings", async () => {
    const a = await canonicalHash({ a: 1, b: [1, 2, { x: 1, y: 2 }] });
    const b = await canonicalHash({ b: [1, 2, { y: 2, x: 1 }], a: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
