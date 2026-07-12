import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseArgs, runCli, type CliArgs } from "../publish-career-pack";

const __dirname_local = dirname(fileURLToPath(import.meta.url));
const PACK = resolve(__dirname_local, "../../content/career-packs/midwife/1.0.0.json");

const originalEnv = { ...process.env };
const withEnv = (env: Record<string, string | undefined>, fn: () => Promise<void>) => async () => {
  process.env = { ...originalEnv, ...env } as NodeJS.ProcessEnv;
  try { await fn(); } finally { process.env = originalEnv; }
};

describe("publish-career-pack CLI — argument parsing", () => {
  it("parses env, flags and actor", () => {
    const args = parseArgs(["bun", "cli", PACK, "--env=staging", "--publish", "--test", "--actor=Alice"]);
    expect(args.env).toBe("staging");
    expect(args.publish).toBe(true);
    expect(args.isTest).toBe(true);
    expect(args.actor).toBe("Alice");
  });
  it("rejects an unknown --env", () => {
    expect(() => parseArgs(["bun", "cli", PACK, "--env=prod"])).toThrow(/--env must be/);
  });
});

describe("publish-career-pack CLI — validation before network", () => {
  it("dry-run against a valid pack sends the correct payload and hash", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: "pub-secret" },
    async () => {
      let seen: { url: string; init: RequestInit } | null = null;
      const fakeFetch: typeof fetch = async (url, init) => {
        seen = { url: String(url), init: init as RequestInit };
        return new Response(JSON.stringify({ dryRun: true, ok: true }), { status: 200 });
      };
      const outcome = await runCli({
        packPath: PACK, env: "staging", isTest: true, publish: false, dryRun: true, actor: "",
      } as CliArgs, { fetchImpl: fakeFetch });
      expect(outcome.status).toBe(200);
      expect(outcome.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(seen).not.toBeNull();
      expect(seen!.url).toContain("/functions/v1/publish-career-pack");
      const headers = seen!.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer pub-secret");
      const body = JSON.parse(seen!.init.body as string);
      expect(body.dryRun).toBe(true);
      expect(body.environment).toBe("staging");
      expect(body.isTest).toBe(true);
      expect(body.pack.slug).toBe("midwife");
    },
  ));

  it("rejects production without expected-project-ref", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: "pub-secret" },
    async () => {
      await expect(runCli({
        packPath: PACK, env: "production", isTest: false, publish: true, dryRun: false, actor: "ops",
      } as CliArgs, { fetchImpl: (async () => new Response("{}")) as typeof fetch })).rejects.toThrow(/expected-project-ref/);
    },
  ));

  it("rejects test packs in production", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: "pub-secret" },
    async () => {
      await expect(runCli({
        packPath: PACK, env: "production", isTest: true, publish: true, dryRun: false, actor: "ops",
        expectedProjectRef: "abc",
      } as CliArgs, { fetchImpl: (async () => new Response("{}")) as typeof fetch })).rejects.toThrow(/test packs cannot/);
    },
  ));

  it("rejects a real publish without actor", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: "pub-secret" },
    async () => {
      await expect(runCli({
        packPath: PACK, env: "staging", isTest: true, publish: true, dryRun: false, actor: "",
      } as CliArgs, { fetchImpl: (async () => new Response("{}")) as typeof fetch })).rejects.toThrow(/--actor is required/);
    },
  ));

  it("fails when the pack file's schema is invalid (via a corrupted copy)", async () => {
    const original = JSON.parse(readFileSync(PACK, "utf-8"));
    delete original.contentReview;
    const tmp = "/tmp/bad-pack.json";
    (await import("node:fs")).writeFileSync(tmp, JSON.stringify(original));
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.CAREER_PACK_PUBLISH_SECRET = "pub-secret";
    await expect(runCli({
      packPath: tmp, env: "staging", isTest: true, publish: false, dryRun: true, actor: "",
    } as CliArgs, { fetchImpl: (async () => new Response("{}")) as typeof fetch })).rejects.toThrow(/schema validation failed/);
    process.env = originalEnv;
  });



  it("rejects when CAREER_PACK_PUBLISH_SECRET is missing (does not fall back to service role)", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: "should-not-be-used" },
    async () => {
      await expect(runCli({
        packPath: PACK, env: "staging", isTest: true, publish: false, dryRun: true, actor: "ops",
      } as CliArgs, { fetchImpl: (async () => new Response("{}")) as typeof fetch })).rejects.toThrow(/CAREER_PACK_PUBLISH_SECRET must be set/);
    },
  ));

  it("never sends the SUPABASE_SERVICE_ROLE_KEY as the bearer credential", withEnv(
    { VITE_SUPABASE_URL: "https://example.supabase.co", CAREER_PACK_PUBLISH_SECRET: "pub-secret", SUPABASE_SERVICE_ROLE_KEY: "SECRET-SERVICE-ROLE-JWT" },
    async () => {
      let seen: RequestInit | null = null;
      const fakeFetch: typeof fetch = async (_url, init) => {
        seen = init as RequestInit;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };
      await runCli({
        packPath: PACK, env: "staging", isTest: true, publish: false, dryRun: true, actor: "ops",
      } as CliArgs, { fetchImpl: fakeFetch });
      const headers = (seen!.headers as Record<string, string>);
      expect(headers.Authorization).toBe("Bearer pub-secret");
      expect(headers.Authorization).not.toContain("SECRET-SERVICE-ROLE-JWT");
      expect(String(seen!.body)).not.toContain("SECRET-SERVICE-ROLE-JWT");
    },
  ));
});

