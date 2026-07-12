// PR 2 final-gate proofs.
//
// 1. Authenticated-user RLS matrix — an ordinary signed-in user must not
//    reach any of the six administrative tables, resolve_active_career_pack,
//    resolve_role_pack_binding, or publish_and_bind_career_pack.
// 2. Real reality-check endpoint lifecycle matrix — driven through the
//    exported handler with an injected resolver fixture, no production DB
//    churn.
// 3. Active-version invariant — real DB writes prove the trigger rejects
//    two concurrently servable versions (published + published,
//    published + review_due within grace, and manual rebind of an expired
//    pack via the servability trigger).
// 4. Hash-mismatch handler test — injected resolver returns tampered
//    content; the handler must refuse to evaluate and return 500
//    pack_hash_mismatch with no pack content.

// Env vars are provided by the edge-function test harness; no dotenv load.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRealityCheck, type ResolvedBinding } from "./index.ts";
import { canonicalHash } from "../_shared/career-evaluator/v1/hash.ts";
import midwifePack from "../../../content/career-packs/midwife/1.0.0.json" with { type: "json" };

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")
  ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
if (!URL_ || !SVC || !ANON) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY required");

const svc = createClient(URL_, SVC, { auth: { persistSession: false } });
const uniq = () => crypto.randomUUID().slice(0, 8);

const makeReq = (body: unknown) =>
  new Request("http://x/reality-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });

// ============================================================================
// 1. Authenticated-user RLS matrix
// ============================================================================
Deno.test({
  name: "gate-1: ordinary authenticated user cannot access admin tables or RPCs",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
  const email = `gate-user-${uniq()}@example.test`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  assert(!cErr, `create user: ${cErr?.message}`);

  try {
    const userClient = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
    assert(!signInErr, `sign in: ${signInErr?.message}`);

    const tables = [
      "career_packs",
      "career_pack_publications",
      "career_pack_publication_events",
      "career_pack_identities",
      "role_pack_bindings",
      "career_pack_config",
    ];
    for (const t of tables) {
      const { data: sel, error: selErr } = await userClient.from(t).select("*").limit(1);
      const denied = !!selErr || (Array.isArray(sel) && sel.length === 0);
      assert(denied, `authenticated SELECT on ${t} must be denied or empty`);

      // With RLS enabled and zero applicable policies, INSERT/UPDATE/DELETE
      // may either error explicitly or affect 0 rows (invisible target). Both
      // outcomes prove no data was exposed or mutated.
      const ins = await userClient.from(t).insert({} as never).select();
      assert(!!ins.error || (Array.isArray(ins.data) && ins.data.length === 0),
        `authenticated INSERT on ${t} must be denied or a no-op`);

      const upd = await userClient.from(t)
        .update({} as never).eq("id", "00000000-0000-0000-0000-000000000000").select();
      assert(!!upd.error || (Array.isArray(upd.data) && upd.data.length === 0),
        `authenticated UPDATE on ${t} must be denied or a no-op`);

      const del = await userClient.from(t)
        .delete().eq("id", "00000000-0000-0000-0000-000000000000").select();
      assert(!!del.error || (Array.isArray(del.data) && del.data.length === 0),
        `authenticated DELETE on ${t} must be denied or a no-op`);
    }

    // RPCs — either explicit permission error, or no exposed data. All three
    // are REVOKEd from authenticated, so calling them must fail.
    const rpc1 = await userClient.rpc("resolve_active_career_pack",
      { _role_id: null, _slug: "midwife" });
    assert(rpc1.error, "resolve_active_career_pack must be denied to authenticated");

    const rpc2 = await userClient.rpc("resolve_role_pack_binding",
      { _role_id: null, _slug: "midwife" });
    assert(rpc2.error, "resolve_role_pack_binding must be denied to authenticated");

    const rpc3 = await userClient.rpc("publish_and_bind_career_pack",
      { _pack_id: "00000000-0000-0000-0000-000000000000", _actor: "attacker" });
    assert(rpc3.error, "publish_and_bind_career_pack must be denied to authenticated");
  } finally {
    await svc.auth.admin.deleteUser(created!.user!.id);
  }
  },
});

// ============================================================================
// 2. Endpoint lifecycle matrix (via injected resolver fixture)
// ============================================================================
const fixtureBinding = (
  overrides: Partial<ResolvedBinding> = {},
): ResolvedBinding => ({
  pack_id: "11111111-1111-1111-1111-111111111111",
  role_id: "22222222-2222-2222-2222-222222222222",
  slug: "midwife",
  pack_version: "1.0.0",
  content_hash: "will-be-set",
  content: midwifePack,
  status: "published",
  role_slug: "midwife",
  review_due_at: null,
  is_servable: true,
  geographic_scope: (midwifePack as { geographicScope?: unknown }).geographicScope ?? null,
  ...overrides,
});

const fixtureRequest = (binding: ResolvedBinding) =>
  handleRealityCheck(
    makeReq({ role: { role_name: "Midwife", role_slug: "midwife" } }),
    {
      resolveBinding: async () => binding,
      validatePair: async () => true,
      // PR 3a: the handler now issues an assessment receipt for servable
      // packs. These fixtures use synthetic pack_ids that don't exist in
      // the DB, so we short-circuit issuance + skip the DB config lookup.
      // The receipt-issuing pipeline itself is exercised by the PR 3a
      // test suite.
      issueReceipt: async () => {},
      resolveUserId: async () => null,
      ttlMinutes: 30,
    },
  );

Deno.test("gate-2a: published pack evaluates normally with full metadata", async () => {
  const hash = await canonicalHash(midwifePack);
  const res = await fixtureRequest(fixtureBinding({ content_hash: hash }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.result, "expected result");
  assertEquals(body.packMetadata.status, "published");
  assertEquals(body.packMetadata.evaluatorSchemaVersion, "reality-check-result/v1");
  // geographicScope field must be present in packMetadata (may be null when
  // pack has no explicit scope) so ResultV1View can consume it in PR 3.
  assert("geographicScope" in body.packMetadata,
    "packMetadata must expose geographicScope for PR 3 ResultV1View");
});


Deno.test("gate-2b: review_due within grace evaluates and exposes reviewDueAt", async () => {
  const hash = await canonicalHash(midwifePack);
  const dueAt = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(); // 5 days ago, within 30d grace
  const res = await fixtureRequest(fixtureBinding({
    content_hash: hash, status: "review_due", is_servable: true, review_due_at: dueAt,
  }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.packMetadata.status, "review_due");
  assertEquals(body.packMetadata.reviewDueAt, dueAt);
});

for (
  const [label, status] of [
    ["expired review_due", "review_due"],
    ["suspended", "suspended"],
    ["superseded", "superseded"],
    ["archived", "archived"],
  ] as const
) {
  Deno.test(`gate-2c: ${label} returns controlled pack_unavailable`, async () => {
    const res = await fixtureRequest(fixtureBinding({
      content_hash: "irrelevant", status, is_servable: false,
      review_due_at: status === "review_due"
        ? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString() : null,
    }));
    assertEquals(res.status, 409);
    const body = await res.json();
    assertEquals(body.error, "pack_unavailable");
    assertEquals(body.packMetadata.status, status);
    // Must NOT leak pack content, hash, SQL, or internal ids.
    assertEquals(body.packMetadata.pack_id, undefined);
    assertEquals(body.packMetadata.content, undefined);
    assertEquals(body.packMetadata.contentHash, undefined);
    assert(!JSON.stringify(body).toLowerCase().includes("select "), "no SQL leak");
  });
}

// ============================================================================
// 3. Active-version invariant (real DB)
// ============================================================================
Deno.test("gate-3: one actively-serving version per role (published + review_due)", async () => {
  const suffix = uniq();
  const { data: role } = await svc.from("roles").insert({
    role_name: `Gate3 ${suffix}`, role_slug: `gate3-${suffix}`,
  }).select("id").single();
  const { data: owner } = await svc.from("career_pack_identities").insert({
    display_name: `Gate3 owner ${suffix}`, is_test_identity: true,
  }).select("id").single();
  const { data: reviewer } = await svc.from("career_pack_identities").insert({
    display_name: `Gate3 reviewer ${suffix}`, is_test_identity: true,
  }).select("id").single();

  const mkPack = async (version: string) => {
    // Unique per-test content so the global content_hash uniqueness constraint
    // never collides with the real Midwife 1.0.0 row.
    const content = { ...midwifePack, packVersion: version, _testSuffix: suffix };
    const hash = await canonicalHash(content);
    const { data, error } = await svc.from("career_packs").insert({
      role_id: role!.id,
      owner_identity_id: owner!.id,
      reviewer_identity_id: reviewer!.id,
      slug: `gate3-${suffix}`,
      pack_version: version,
      schema_version: (midwifePack as { schemaVersion: string }).schemaVersion,
      archetype_id: (midwifePack as { archetypeId: string }).archetypeId,
      content_hash: hash,
      content,
      environment: "staging",
      is_test: true,
      imported_by: "gate3-test",
    }).select("id").single();
    if (error) throw error;
    return data!.id as string;
  };

  const packA = await mkPack("1.0.0");
  const packB = await mkPack("1.1.0");

  try {
    // A published.
    await svc.from("career_pack_publications").insert({
      pack_id: packA, status: "published", published_at: new Date().toISOString(),
    });

    // Case (i): trying to publish B while A is published → rejected.
    {
      const { error } = await svc.from("career_pack_publications").insert({
        pack_id: packB, status: "published", published_at: new Date().toISOString(),
      });
      assert(error, "second published pack must be rejected");
      assert(/actively-serving|check_violation/i.test(error!.message));
    }

    // Case (ii): B inserted as review_due within grace while A is published → rejected.
    {
      const dueAt = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      const { error } = await svc.from("career_pack_publications").insert({
        pack_id: packB, status: "review_due", review_due_at: dueAt,
      });
      assert(error, "review_due within grace must be rejected while another published");
    }

    // Case (iii): B inserted as review_due OUTSIDE grace → allowed (not serving).
    {
      const expired = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { error } = await svc.from("career_pack_publications").insert({
        pack_id: packB, status: "review_due", review_due_at: expired,
      });
      assert(!error, `expired review_due must be allowed: ${error?.message}`);
    }

    // Case (iv): trying to rebind role to an expired review_due pack → the
    // servability-check trigger on role_pack_bindings must reject.
    await svc.from("role_pack_bindings").insert({
      role_id: role!.id, pack_id: packA, bound_by: "test",
    });
    {
      const { error } = await svc.from("role_pack_bindings").upsert({
        role_id: role!.id, pack_id: packB, bound_by: "test",
      });
      assert(error, "rebinding to non-servable pack must be rejected");
      assert(/servable/i.test(error!.message));
    }
  } finally {
    await svc.from("role_pack_bindings").delete().eq("role_id", role!.id);
    await svc.from("career_pack_publication_events").delete()
      .in("pack_id", [packA, packB]);
    await svc.from("career_pack_publications").delete()
      .in("pack_id", [packA, packB]);
    // career_packs is immutable via trigger, so leave them; role stays too.
  }
});

// ============================================================================
// 4. Hash-mismatch runtime test
// ============================================================================
Deno.test("gate-4: hash mismatch refuses evaluation with controlled response", async () => {
  const trueHash = await canonicalHash(midwifePack);
  const bogusHash = "0".repeat(64);
  assertNotEquals(trueHash, bogusHash);

  const res = await fixtureRequest(fixtureBinding({
    content_hash: bogusHash,   // stored hash disagrees with content
    status: "published", is_servable: true,
  }));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "pack_hash_mismatch");
  assertEquals(body.result, undefined);
  assertEquals(body.content, undefined);
  // No stack, no SQL, no internal ids beyond pack_version.
  const dump = JSON.stringify(body).toLowerCase();
  assert(!dump.includes("select "), "no SQL in error body");
  assert(!dump.includes("stack"), "no stack in error body");
});
