#!/usr/bin/env bun
// Career-pack publish CLI.
//
// Usage:
//   bun run scripts/publish-career-pack.ts <pack-json> \
//     --env=<development|staging|production> \
//     [--test]                     # mark identities/pack as test
//     [--publish]                   # actually flip to published + bind role
//     [--dry-run]                   # validate + hash, do not write
//     [--actor="name <email>"]      # required for real writes
//     [--expected-project-ref=<ref>] # required if --env=production
//
// The CLI:
//   1. Reads the pack from disk.
//   2. Validates schema + cross-refs locally (fast fail before any network).
//   3. Runs every testProfile through the evaluator.
//   4. Computes the canonical content hash.
//   5. Posts to the `publish-career-pack` edge function using the dedicated
//      `CAREER_PACK_PUBLISH_SECRET` from the local environment.
//      The service-role key is NEVER sent from the CLI; the edge function
//      holds its own service-role credential internally.
//
// The server independently re-validates everything before touching the DB.
// The CLI's local checks are for developer ergonomics, not trust.

import { readFileSync } from "node:fs";
import { z } from "zod";
import { careerDecisionPackV1, validatePackCrossRefs } from "../supabase/functions/_shared/career-evaluator/v1/schema";
import { evaluate } from "../supabase/functions/_shared/career-evaluator/v1/evaluate";
import { canonicalHash } from "../supabase/functions/_shared/career-evaluator/v1/hash";
import type { CareerDecisionPackV1 } from "../supabase/functions/_shared/career-evaluator/v1/types";

interface CliArgs {
  packPath: string;
  env: "development" | "staging" | "production";
  isTest: boolean;
  publish: boolean;
  dryRun: boolean;
  actor: string;
  expectedProjectRef?: string;
}

const parseArgs = (argv: string[]): CliArgs => {
  const [, , packPath, ...rest] = argv;
  if (!packPath) throw new Error("usage: publish-career-pack <pack.json> --env=<env> [--publish] [--test] [--dry-run] --actor=<name>");
  const flags: Record<string, string | boolean> = {};
  for (const arg of rest) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  const env = String(flags.env ?? "");
  if (env !== "development" && env !== "staging" && env !== "production") {
    throw new Error(`--env must be development|staging|production (got ${env})`);
  }
  return {
    packPath,
    env: env as CliArgs["env"],
    isTest: Boolean(flags.test),
    publish: Boolean(flags.publish),
    dryRun: Boolean(flags["dry-run"]),
    actor: String(flags.actor ?? ""),
    expectedProjectRef: flags["expected-project-ref"] ? String(flags["expected-project-ref"]) : undefined,
  };
};

export interface CliOutcome {
  contentHash: string;
  serverResponse: unknown;
  status: number;
}

export const runCli = async (args: CliArgs, opts: { fetchImpl?: typeof fetch } = {}): Promise<CliOutcome> => {
  const raw = JSON.parse(readFileSync(args.packPath, "utf-8"));
  const parsed = careerDecisionPackV1.safeParse(raw);
  if (!parsed.success) {
    throw new Error("schema validation failed:\n" + parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  const pack = parsed.data as CareerDecisionPackV1;
  const crossRefErrors = validatePackCrossRefs(pack);
  if (crossRefErrors.length > 0) throw new Error("cross-ref validation failed:\n  " + crossRefErrors.join("\n  "));

  for (const p of pack.testProfiles) {
    try { evaluate(pack, p.answers, { now: "2026-07-12T00:00:00.000Z" }); }
    catch (e) { throw new Error(`test profile ${p.id} failed: ${(e as Error).message}`); }
  }

  const hash = await canonicalHash(pack);

  if (!args.dryRun && !args.actor) throw new Error("--actor is required for non-dry-run publishes");
  if (args.env === "production" && !args.expectedProjectRef) {
    throw new Error("--expected-project-ref is required for --env=production");
  }
  if (args.env === "production" && args.isTest) {
    throw new Error("test packs cannot be published to production");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishSecret = process.env.CAREER_PACK_PUBLISH_SECRET;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL or SUPABASE_URL must be set in the environment");
  if (!publishSecret) throw new Error("CAREER_PACK_PUBLISH_SECRET must be set in the environment");

  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${supabaseUrl}/functions/v1/publish-career-pack`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${publishSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pack,
      environment: args.env,
      isTest: args.isTest,
      importedBy: args.actor || "cli-dry-run",
      dryRun: args.dryRun,
      publish: args.publish,
      expectedProjectRef: args.expectedProjectRef,
    }),
  });
  const status = res.status;
  const serverResponse = await res.json();
  return { contentHash: hash, serverResponse, status };
};

// Executed only when run as a script (not when imported by tests).
if (import.meta.main) {
  runCli(parseArgs(process.argv))
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: r.status < 400, ...r }, null, 2));
      process.exit(r.status < 400 ? 0 : 1);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(String(e));
      process.exit(1);
    });
}

export { parseArgs };
export type { CliArgs };
