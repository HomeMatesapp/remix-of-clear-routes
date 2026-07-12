// PR 3a — Trusted-save release gate: hostile + race matrix.
//
// These tests exercise the real DB (assessment_receipts, saved_decisions,
// claim_receipt_and_save_decision RPC) plus the save-decision handler with
// injected auth so we can drive multiple simulated users deterministically.
//
// What we prove:
//   • Client-authored evaluation fields (pack_id/version/hash/result_v1/etc.)
//     are IGNORED — the saved row is byte-equivalent to the server-held
//     snapshot after canonicalisation.
//   • Cross-user claim is rejected.
//   • Expired / revoked / unknown receipts are rejected with the same
//     opaque "receipt_invalid" (410) — no oracle for existence.
//   • Replay by same user is idempotent — one row, same id returned.
//   • Concurrent claims serialise — exactly one row created.
//   • Direct browser insert of generic_pack_v1 is blocked by RLS.
//   • Direct browser update from legacy_engine -> generic_pack_v1 is blocked.
//   • Anonymous receipt can be claimed after sign-in.
//   • Authenticated receipt cannot be claimed by a different account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSaveDecision } from "./index.ts";
// Note: we do NOT import from reality-check/index.ts because that module
// calls `serve(...)` at top level and would collide with our own listener.
// Instead we insert receipts directly through the same code path the
// production issuer uses (service-role insert into assessment_receipts).
import { canonicalHash, sha256Hex } from "../_shared/career-evaluator/v1/hash.ts";
import { evaluate } from "../_shared/career-evaluator/v1/evaluate.ts";
import { careerDecisionPackV1 } from "../_shared/career-evaluator/v1/schema.ts";
import type { CareerDecisionPackV1 } from "../_shared/career-evaluator/v1/types.ts";
import midwifePack from "../../../content/career-packs/midwife/1.0.0.json" with { type: "json" };

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")
  ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
if (!URL_ || !SVC || !ANON) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY required");

const svc = createClient(URL_, SVC, { auth: { persistSession: false } });
const uniq = () => crypto.randomUUID().slice(0, 8);

// -- Fixtures -------------------------------------------------------------

interface Fx {
  roleId: string;
  roleSlug: string;
  packId: string;
  packVersion: string;
  packContentHash: string;
}

const setupFixture = async (): Promise<Fx> => {
  // Real Midwife pack row (or reuse an existing published Midwife pack for
  // this role). We insert with a unique slug/role_id to avoid touching prod.
  const roleSlug = `pr3a-role-${uniq()}`;
  const { data: role, error: rErr } = await svc.from("roles").insert({
    role_name: `PR3a Test ${roleSlug}`, role_slug: roleSlug,
  }).select("id").single();
  assert(!rErr, `role insert: ${rErr?.message}`);
  const roleId = role.id;
  // Strict semver required by the career_packs_semver check.
  const packVersion = `9.${Math.floor(Math.random() * 999)}.${Math.floor(Math.random() * 999)}`;
  const packSlug = `pr3a-pack-${uniq()}`;
  const patched = { ...midwifePack, roleId, slug: packSlug, packVersion };
  const packContentHash = await canonicalHash(patched);

  // Identities.
  const mkId = async (name: string) => {
    const { data, error } = await svc.from("career_pack_identities")
      .insert({ display_name: name, is_test_identity: true }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id;
  };
  const ownerId = await mkId(`pr3a-owner-${uniq()}`);
  const reviewerId = await mkId(`pr3a-reviewer-${uniq()}`);

  const { data: pack, error: pErr } = await svc.from("career_packs").insert({
    role_id: roleId, slug: packSlug, pack_version: packVersion,
    schema_version: "career-decision-pack/v1", archetype_id: "generic",
    content_hash: packContentHash, content: patched,
    owner_identity_id: ownerId, reviewer_identity_id: reviewerId,
    environment: "development", is_test: true, imported_by: "pr3a-test",
  }).select("id").single();
  assert(!pErr, `pack insert: ${pErr?.message}`);

  await svc.from("career_pack_publications").insert({ pack_id: pack.id, status: "published" });
  await svc.from("role_pack_bindings").insert({ pack_id: pack.id, role_id: roleId, bound_by: "pr3a-test" });
  return {
    roleId, roleSlug, packId: pack.id, packVersion, packContentHash,
  };
};

const createUser = async (): Promise<{ id: string; email: string; password: string }> => {
  const email = `pr3a-${uniq()}@example.test`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!error, `createUser: ${error?.message}`);
  return { id: data.user!.id, email, password };
};

const signIn = async (email: string, password: string): Promise<string> => {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  assert(!error, `signIn: ${error?.message}`);
  return data.session!.access_token;
};

const authedClientFor = (token: string) =>
  createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

const saveReq = (body: unknown, token: string) =>
  new Request("http://x/save-decision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "origin": "http://localhost",
    },
    body: JSON.stringify(body),
  });

const invokeSave = (body: unknown, token: string) =>
  handleSaveDecision(saveReq(body, token), {
    serviceClient: svc,
    authClientForToken: (t) => authedClientFor(t),
  });

// Mirror the reality-check handler's issuance path directly (evaluator +
// canonical hash + service-role INSERT into assessment_receipts). This lets
// the save-decision suite exercise the trusted-save flow without importing
// the reality-check module (which would collide on Deno.serve).
const base64Url = (bytes: Uint8Array): string => {
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const issueReceiptViaHandler = async (
  fx: Fx, opts: { userToken?: string } = {},
): Promise<{ receipt: string; expiresAt: string; result: unknown }> => {
  const packRow = await svc.from("career_packs").select("content").eq("id", fx.packId).single();
  const content = packRow.data!.content;
  const parsed = careerDecisionPackV1.parse(content);
  const result = evaluate(parsed as CareerDecisionPackV1, {});
  const receiptBytes = new Uint8Array(32); crypto.getRandomValues(receiptBytes);
  const receipt = base64Url(receiptBytes);
  const receiptHash = await sha256Hex(receipt);
  const resultCanonicalHash = await canonicalHash(result);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  let issuedUserId: string | null = null;
  if (opts.userToken) {
    const { data } = await authedClientFor(opts.userToken).auth.getUser();
    issuedUserId = data?.user?.id ?? null;
  }

  const { error } = await svc.from("assessment_receipts").insert({
    receipt_hash: receiptHash,
    role_id: fx.roleId, role_slug: fx.roleSlug,
    pack_id: fx.packId, pack_version: fx.packVersion,
    pack_content_hash: fx.packContentHash,
    evaluator_schema_version: "reality-check-result/v1",
    evaluation_source: "generic_pack_v1",
    result_v1: result,
    result_canonical_hash: resultCanonicalHash,
    issued_user_id: issuedUserId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`receipt insert failed: ${error.message}`);
  return { receipt, expiresAt, result };
};

// ============================================================================
Deno.test({ name: "3a-1: full happy path — server snapshot is saved verbatim",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const { receipt, result } = await issueReceiptViaHandler(fx, { userToken: token });

  const res = await invokeSave({ receipt }, token);
  assertEquals(res.status, 201);
  const body = await res.json();
  const savedId: string = body.savedDecisionId;
  assert(typeof savedId === "string");

  const { data: row } = await svc.from("saved_decisions").select("*").eq("id", savedId).single();
  assertEquals(row!.user_id, user.id);
  assertEquals(row!.evaluation_source, "generic_pack_v1");
  assertEquals(row!.pack_id, fx.packId);
  assertEquals(row!.pack_version, fx.packVersion);
  assertEquals(row!.pack_content_hash, fx.packContentHash);
  assertEquals(row!.evaluator_schema_version, "reality-check-result/v1");
  // Byte-equivalent snapshot check.
  const savedHash = await canonicalHash(row!.result_v1);
  const originalHash = await canonicalHash(result);
  assertEquals(savedHash, originalHash, "saved result_v1 must be byte-equivalent to server snapshot");
}});

Deno.test({ name: "3a-2: hostile client fields are ignored — pack_id/version/hash/result_v1 spoof",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const { receipt, result } = await issueReceiptViaHandler(fx, { userToken: token });

  const hostileBody = {
    receipt,
    // All of these MUST be ignored by save-decision.
    result_v1: { schemaVersion: "reality-check-result/v1", packVersion: "9.9.9", routes: [{ id: "fake" }] },
    pack_id: "00000000-0000-0000-0000-000000000000",
    pack_version: "9.9.9",
    content_hash: "deadbeef",
    evaluator_schema_version: "reality-check-result/v99",
    user_id: crypto.randomUUID(),
    role_id: crypto.randomUUID(),
    evaluation_source: "legacy_engine",
    routes: [{ id: "spoof", eligibility: "eligible" }],
    strongestRoute: "spoof",
    evidenceReferences: ["fake"],
    label: "my label",
  };
  const res = await invokeSave(hostileBody, token);
  assertEquals(res.status, 201);
  const body = await res.json();
  const { data: row } = await svc.from("saved_decisions").select("*").eq("id", body.savedDecisionId).single();
  assertEquals(row!.user_id, user.id, "user_id from JWT, not body");
  assertEquals(row!.pack_id, fx.packId, "pack_id from receipt, not body");
  assertEquals(row!.pack_version, fx.packVersion);
  assertEquals(row!.pack_content_hash, fx.packContentHash);
  assertEquals(row!.evaluator_schema_version, "reality-check-result/v1");
  assertEquals(row!.evaluation_source, "generic_pack_v1");
  assertEquals(row!.label, "my label", "label is the only participant-authored field allowed");
  const savedHash = await canonicalHash(row!.result_v1);
  const originalHash = await canonicalHash(result);
  assertEquals(savedHash, originalHash, "hostile result_v1 must be ignored");
}});

Deno.test({ name: "3a-3: idempotent replay by same user returns same id, no duplicate row",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const { receipt } = await issueReceiptViaHandler(fx, { userToken: token });

  const a = await invokeSave({ receipt }, token);
  const b = await invokeSave({ receipt }, token);
  const ab = await a.json(); const bb = await b.json();
  assertEquals(a.status, 201);
  assertEquals(b.status, 200);
  assertEquals(ab.savedDecisionId, bb.savedDecisionId);
  const { count } = await svc.from("saved_decisions").select("id", { count: "exact", head: true })
    .eq("id", ab.savedDecisionId);
  assertEquals(count, 1);
}});

Deno.test({ name: "3a-4: concurrent saves of same receipt create only one row",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const { receipt } = await issueReceiptViaHandler(fx, { userToken: token });

  const [r1, r2, r3] = await Promise.all([
    invokeSave({ receipt }, token),
    invokeSave({ receipt }, token),
    invokeSave({ receipt }, token),
  ]);
  const b1 = await r1.json(); const b2 = await r2.json(); const b3 = await r3.json();
  const ids = [b1.savedDecisionId, b2.savedDecisionId, b3.savedDecisionId];
  assertEquals(new Set(ids).size, 1, "all three responses reference the same saved id");
  const { data: rows } = await svc.from("saved_decisions").select("id")
    .eq("id", ids[0]);
  assertEquals(rows!.length, 1);
}});

Deno.test({ name: "3a-5: cross-user claim rejected — user B cannot save user A's receipt",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const userA = await createUser();
  const userB = await createUser();
  const tokenA = await signIn(userA.email, userA.password);
  const tokenB = await signIn(userB.email, userB.password);
  const { receipt } = await issueReceiptViaHandler(fx, { userToken: tokenA });

  const res = await invokeSave({ receipt }, tokenB);
  assertEquals(res.status, 403);
  await res.body?.cancel();

  // A can still save it, and once A saves, B still can't.
  const ok = await invokeSave({ receipt }, tokenA);
  assertEquals(ok.status, 201);
  await ok.body?.cancel();
  const stealAttempt = await invokeSave({ receipt }, tokenB);
  assertEquals(stealAttempt.status, 403);
  await stealAttempt.body?.cancel();
}});

Deno.test({ name: "3a-6: anonymous receipt can be claimed after sign-in, but only by the claimant",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  // No user token during issue = anonymous.
  const { receipt } = await issueReceiptViaHandler(fx, {});

  const userA = await createUser();
  const userB = await createUser();
  const tokenA = await signIn(userA.email, userA.password);
  const tokenB = await signIn(userB.email, userB.password);

  const claim = await invokeSave({ receipt }, tokenA);
  assertEquals(claim.status, 201);
  await claim.body?.cancel();
  // Now B cannot re-use.
  const steal = await invokeSave({ receipt }, tokenB);
  assertEquals(steal.status, 403);
  await steal.body?.cancel();
}});

Deno.test({ name: "3a-7: expired / revoked / unknown receipts all return 410",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);

  // Unknown.
  const unknownReceipt = "u".repeat(43);
  const rU = await invokeSave({ receipt: unknownReceipt }, token);
  assertEquals(rU.status, 410); await rU.body?.cancel();

  // Expired: insert directly with expires_at in the past.
  const expiredToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expiredHash = await sha256Hex(expiredToken);
  await svc.from("assessment_receipts").insert({
    receipt_hash: expiredHash, role_id: fx.roleId, role_slug: fx.roleSlug,
    pack_id: fx.packId, pack_version: fx.packVersion,
    pack_content_hash: fx.packContentHash,
    evaluator_schema_version: "reality-check-result/v1",
    result_v1: { schemaVersion: "reality-check-result/v1" },
    result_canonical_hash: "x",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  });
  const rE = await invokeSave({ receipt: expiredToken }, token);
  assertEquals(rE.status, 410); await rE.body?.cancel();

  // Revoked.
  const revokedToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const revokedHash = await sha256Hex(revokedToken);
  await svc.from("assessment_receipts").insert({
    receipt_hash: revokedHash, role_id: fx.roleId, role_slug: fx.roleSlug,
    pack_id: fx.packId, pack_version: fx.packVersion,
    pack_content_hash: fx.packContentHash,
    evaluator_schema_version: "reality-check-result/v1",
    result_v1: { schemaVersion: "reality-check-result/v1" },
    result_canonical_hash: "x",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: new Date().toISOString(),
  });
  const rR = await invokeSave({ receipt: revokedToken }, token);
  assertEquals(rR.status, 410); await rR.body?.cancel();
}});

Deno.test({ name: "3a-8: unauthenticated save is rejected",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const res = await handleSaveDecision(new Request("http://x/save-decision", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ receipt: "x".repeat(43) }),
  }), { serviceClient: svc });
  assertEquals(res.status, 401);
  await res.body?.cancel();
}});

Deno.test({ name: "3a-9: RLS blocks direct browser insert of generic_pack_v1 and legacy->generic mutation",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const fx = await setupFixture();
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const client = authedClientFor(token);

  // Direct generic_pack_v1 insert must be denied.
  const ins = await client.from("saved_decisions").insert({
    user_id: user.id, role_id: fx.roleId, role_slug: fx.roleSlug, role_name: "x",
    evaluation_source: "generic_pack_v1",
    pack_id: fx.packId, pack_version: fx.packVersion, pack_content_hash: fx.packContentHash,
    evaluator_schema_version: "reality-check-result/v1",
    result_v1: { schemaVersion: "reality-check-result/v1" },
  } as never).select();
  assert(!!ins.error || (Array.isArray(ins.data) && ins.data.length === 0),
    "direct generic_pack_v1 insert must be denied");

  // Legacy insert allowed.
  const legacy = await client.from("saved_decisions").insert({
    user_id: user.id, role_id: fx.roleId, role_slug: fx.roleSlug, role_name: "x",
    evaluation_source: "legacy_engine",
  } as never).select("id").single();
  assert(!legacy.error, `legacy insert failed: ${legacy.error?.message}`);

  // Attempt legacy -> generic mutation via UPDATE.
  const upd = await client.from("saved_decisions").update({
    evaluation_source: "generic_pack_v1",
    pack_id: fx.packId, pack_version: fx.packVersion, pack_content_hash: fx.packContentHash,
    evaluator_schema_version: "reality-check-result/v1",
    result_v1: { schemaVersion: "reality-check-result/v1" },
  } as never).eq("id", legacy.data!.id).select();
  assert(!!upd.error || (Array.isArray(upd.data) && upd.data.length === 0),
    "direct legacy->generic mutation must be denied");

  const { data: after } = await svc.from("saved_decisions").select("evaluation_source").eq("id", legacy.data!.id).single();
  assertEquals(after!.evaluation_source, "legacy_engine", "row unchanged");
}});

Deno.test({ name: "3a-10: assessment_receipts is invisible to authenticated users",
  sanitizeOps: false, sanitizeResources: false, async fn() {
  const user = await createUser();
  const token = await signIn(user.email, user.password);
  const client = authedClientFor(token);
  const { data, error } = await client.from("assessment_receipts").select("*").limit(1);
  const denied = !!error || (Array.isArray(data) && data.length === 0);
  assert(denied, "assessment_receipts must be invisible to signed-in users");
}});
