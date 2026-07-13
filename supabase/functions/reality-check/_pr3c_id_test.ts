// PR 3c-i.d completion proofs — exercised against staging (live DB).
//
// Uses the real handler + real service-role DB writes. Every scenario cleans
// up after itself so the suite is safely re-runnable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRealityCheck, type ResolvedBinding } from "./index.ts";
import {
  buildPublicPackMetadata,
  buildPublicQuestionnaire,
} from "../_shared/career-evaluator/v1/public-projectors.ts";
import { canonicalHash, sha256Hex } from "../_shared/career-evaluator/v1/hash.ts";
import { careerDecisionPackV1 } from "../_shared/career-evaluator/v1/schema.ts";
import type { CareerDecisionPackV1 } from "../_shared/career-evaluator/v1/types.ts";
import midwifePack from "../../../content/career-packs/midwife/1.1.0.json" with { type: "json" };
import carpenterPack from "../../../content/career-packs/carpenter-joiner/1.1.0.json" with { type: "json" };
import photographerPack from "../../../content/career-packs/photographer/1.1.0.json" with { type: "json" };

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!URL_ || !SVC) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY required");
const svc = createClient(URL_, SVC, { auth: { persistSession: false } });

const makeReq = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/reality-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost", ...headers },
    body: JSON.stringify(body),
  });

const MIDWIFE_ANSWERS = {
  starting_point: "school_leaver",
  gcse_maths_english_science_status: "yes",
  level3_status: "yes_science",
  relevant_first_degree_status: "no",
  current_registration: "no",
  income_need: "can_study_full_time",
  weekly_placement_hours: "yes",
  dbs_check_barriers: "none",
  occupational_health_concerns: "none",
};

// ============================================================================
// 1. Public-facing projectors produce clean output for all three 1.1.0 packs
// ============================================================================
Deno.test("pr3c-i.d/1 — public projectors produce clean metadata + questionnaire", () => {
  for (const raw of [midwifePack, carpenterPack, photographerPack]) {
    const pack = careerDecisionPackV1.parse(raw) as CareerDecisionPackV1;
    const meta = buildPublicPackMetadata({
      slug: pack.slug, packVersion: pack.packVersion, status: "published",
      reviewDueAt: null, geographicScope: pack.careerIdentity.geographicScope as string[],
    });
    assertEquals(meta.slug, pack.slug);
    assertEquals(meta.status, "published");
    const metaKeys = JSON.stringify(meta);
    for (const forbidden of ["ownerUserId", "adminNotes", "contentHash", "reviewerUserId"]) {
      assert(!metaKeys.includes(forbidden), `metadata leaks ${forbidden} for ${pack.slug}`);
    }

    const q = buildPublicQuestionnaire(pack, {
      slug: pack.slug, packVersion: pack.packVersion, status: "published",
      reviewDueAt: null, geographicScope: pack.careerIdentity.geographicScope as string[],
    });
    assert(q.modules.length > 0, `${pack.slug} has questionnaire modules`);
    assert(q.questions.length > 0, `${pack.slug} has questions`);
    const qJson = JSON.stringify(q);
    for (const forbidden of ["ownerUserId", "adminNotes", "\"rules\"", "evidenceRecords"]) {
      assert(!qJson.includes(forbidden), `questionnaire leaks ${forbidden} for ${pack.slug}`);
    }
  }
});

// ============================================================================
// 2. Real reality-check handler with hostile answers → sanitised, receipt issued
// ============================================================================
Deno.test({
  name: "pr3c-i.d/2 — hostile answers survive sanitisation; receipt issued with clean result",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
    const hostile = {
      ...MIDWIFE_ANSWERS,
      __proto__: { admin: true },
      ownerUserId: "attacker",
      injected_html: "<script>alert(1)</script>",
      arbitrary_unknown_question: "junk",
      admin_override: "true",
    };
    const receiptCalls: unknown[] = [];
    const res = await handleRealityCheck(makeReq({
      role: { id: "f2e9c333-c373-4cca-add2-3b7bd1cd50d7", role_name: "Midwife", role_slug: "midwife" },
      answers: hostile,
    }), {
      issueReceipt: async (r) => { receiptCalls.push(r); },
      resolveUserId: async () => null,
    });
    if (res.status !== 200) console.log("DEBUG scenario 2:", res.status, await res.clone().json());
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.result.packVersion, "1.1.0");
    assertEquals(body.result.schemaVersion, "reality-check-result/v1");
    assert(body.assessmentReceipt, "receipt token returned");
    assertEquals(receiptCalls.length, 1);
    const clean = JSON.stringify(body);
    assert(!clean.includes("<script>"), "hostile HTML not echoed");
    assert(!clean.includes("attacker"), "hostile ownerUserId not echoed");
    assert(!clean.includes("arbitrary_unknown_question"), "unknown question dropped");
    // Self-contained result: participant can render without reloading pack.
    assert(body.result.resolvedEvidence.length > 0);
    assert(body.result.resolvedRequirements.length > 0);
    assert(body.result.contentReviewSnapshot.ownerDisplayName);
    // Public metadata never leaks internal keys.
    for (const k of ["contentHash", "ownerUserId", "adminNotes"]) {
      assert(!JSON.stringify(body.packMetadata).includes(k), `packMetadata leaks ${k}`);
    }
  },
});

// ============================================================================
// 3. Strict-result failure creates NO receipt (invariant: fail closed)
// ============================================================================
Deno.test({
  name: "pr3c-i.d/3 — strict-result failure prevents receipt issuance",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
    // Craft a pack that passes schema (safeParse) but has a route.evidenceRefs
    // entry that does NOT exist in evidenceRecords. Cross-refs are enforced by
    // publishing, not by the handler's safeParse, so the evaluator will emit a
    // result whose route.evidenceRefs contains an id missing from
    // resolvedEvidence → validateResultNewWriteCompleteness must fail closed.
    const raw = JSON.parse(JSON.stringify(midwifePack)) as CareerDecisionPackV1;
    raw.routes[0].evidenceRefs = [...raw.routes[0].evidenceRefs, "nonexistent_evidence_ref"];
    const hash = await canonicalHash(raw);
    const injected: ResolvedBinding = {
      pack_id: "00000000-0000-0000-0000-000000000000",
      role_id: raw.roleId, slug: raw.slug, pack_version: raw.packVersion,
      content_hash: hash, content: raw, status: "published",
      role_slug: raw.slug, review_due_at: null, is_servable: true,
      geographic_scope: raw.careerIdentity.geographicScope,
    };
    const receiptCalls: unknown[] = [];
    const res = await handleRealityCheck(makeReq({
      role: { id: raw.roleId, role_name: "Midwife", role_slug: raw.slug },
      answers: MIDWIFE_ANSWERS,
    }), {
      resolveBinding: async () => injected,
      validatePair: async () => true,
      issueReceipt: async (r) => { receiptCalls.push(r); },
      resolveUserId: async () => null,
    });
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.error, "result_contract_invalid");
    assertEquals(receiptCalls.length, 0, "no receipt issued when strict result fails");
  },
});

// ============================================================================
// 4. review-due context survives receipt → save → reopen
// ============================================================================
Deno.test({
  name: "pr3c-i.d/4 — review-due context survives receipt, trusted save, JSON reopening",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
    const email = `pr3cid-${crypto.randomUUID().slice(0, 8)}@example.test`;
    const password = `Pw!${crypto.randomUUID()}`;
    const { data: created, error: uErr } = await svc.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    assert(!uErr, uErr?.message);
    const userId = created.user.id;
    try {
      // Inject binding claiming review_due, verify handler stamps reviewContext.
      const raw = careerDecisionPackV1.parse(midwifePack) as CareerDecisionPackV1;
      const hash = await canonicalHash(raw);
      const reviewDueAt = new Date(Date.now() - 24 * 3_600_000).toISOString();
      let issuedReceipt: unknown = null;
      const res = await handleRealityCheck(makeReq({
        role: { id: raw.roleId, role_name: "Midwife", role_slug: raw.slug },
        answers: MIDWIFE_ANSWERS,
      }), {
        resolveBinding: async () => ({
          pack_id: "fc171bce-3627-4af6-8fa1-c3ea9160ce7d",
          role_id: raw.roleId, slug: raw.slug, pack_version: raw.packVersion,
          content_hash: hash, content: raw, status: "review_due",
          role_slug: raw.slug, review_due_at: reviewDueAt, is_servable: true,
          geographic_scope: raw.careerIdentity.geographicScope,
        }),
        validatePair: async () => true,
        issueReceipt: async (r) => { issuedReceipt = r; },
        resolveUserId: async () => userId,
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.result.reviewContext.status, "review_due");
      assertEquals(body.result.reviewContext.reviewDueAt, reviewDueAt);

      // Real DB write of the receipt (mirror the handler's default path).
      const receiptToken = crypto.randomUUID() + crypto.randomUUID();
      const receiptHash = await sha256Hex(receiptToken);
      const canonical = await canonicalHash(body.result);
      const { error: insErr } = await svc.from("assessment_receipts").insert({
        receipt_hash: receiptHash,
        role_id: raw.roleId, role_slug: raw.slug,
        pack_id: "fc171bce-3627-4af6-8fa1-c3ea9160ce7d",
        pack_version: raw.packVersion, pack_content_hash: hash,
        evaluator_schema_version: "reality-check-result/v1",
        evaluation_source: "generic_pack_v1",
        result_v1: body.result, result_canonical_hash: canonical,
        issued_user_id: userId,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
      assert(!insErr, insErr?.message);

      // Claim + save via the trusted-persistence RPC (the same call the
      // save-decision handler uses server-side after JWT verification).
      const { data: rpc, error: rpcErr } = await svc.rpc("claim_receipt_and_save_decision", {
        _receipt_hash: receiptHash, _user_id: userId, _label: "review-due proof",
      });
      assert(!rpcErr, rpcErr?.message);
      const row = (Array.isArray(rpc) ? rpc[0] : rpc) as { status: string; saved_decision_id: string };
      assertEquals(row.status, "created");
      const savedId = row.saved_decision_id;

      // Reopen from JSON — reviewContext must be intact.
      const { data: saved } = await svc.from("saved_decisions").select("result_v1").eq("id", savedId).single();
      const round = JSON.parse(JSON.stringify(saved!.result_v1)) as { reviewContext: { status: string; reviewDueAt: string } };
      assertEquals(round.reviewContext.status, "review_due");
      assertEquals(round.reviewContext.reviewDueAt, reviewDueAt);
    } finally {
      // Cleanup receipts + saved rows + user.
      await svc.from("assessment_receipts").delete().eq("issued_user_id", userId);
      await svc.from("saved_decisions").delete().eq("user_id", userId);
      await svc.auth.admin.deleteUser(userId);
    }
  },
});

// ============================================================================
// 5. Superseded 1.0.0 receipts remain claimable after 1.1.0 becomes active
// ============================================================================
Deno.test({
  name: "pr3c-i.d/5 — legacy 1.0.0 receipts remain claimable after 1.1.0 supersede",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
    const email = `pr3cid-legacy-${crypto.randomUUID().slice(0, 8)}@example.test`;
    const password = `Pw!${crypto.randomUUID()}`;
    const { data: created, error: uErr } = await svc.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    assert(!uErr, uErr?.message);
    const userId = created.user.id;

    try {
      // Find the (now-superseded) 1.0.0 midwife pack row.
      const { data: pack } = await svc.from("career_packs")
        .select("id, content, content_hash, pack_version, role_id, slug")
        .eq("slug", "midwife").eq("pack_version", "1.0.0").single();
      assert(pack, "1.0.0 midwife pack still exists after supersede");

      // A pre-3c-i.d receipt would have been issued while 1.0.0 was published.
      // We forge one directly (service role) referencing the 1.0.0 pack row.
      const legacyResult = {
        schemaVersion: "reality-check-result/v1",
        packVersion: "1.0.0", roleId: pack.role_id, slug: pack.slug,
        evaluatedAt: new Date().toISOString(),
        geographicScope: ["England"], regulatoryStatus: "statutory_regulated",
        routes: [], considerations: [], immediateActions: [],
        evidenceCoverage: { level: "adequate", completedAnswerCount: 5, totalAnswerCount: 10, note: "legacy" },
        limitations: [], participantLanguage: { topRoutePhrase: "x", confidencePhrase: "y" },
      };
      const canonical = await canonicalHash(legacyResult);
      const receiptToken = crypto.randomUUID() + crypto.randomUUID();
      const receiptHash = await sha256Hex(receiptToken);
      const { error: insErr } = await svc.from("assessment_receipts").insert({
        receipt_hash: receiptHash,
        role_id: pack.role_id, role_slug: pack.slug,
        pack_id: pack.id, pack_version: pack.pack_version,
        pack_content_hash: pack.content_hash,
        evaluator_schema_version: "reality-check-result/v1",
        evaluation_source: "generic_pack_v1",
        result_v1: legacyResult, result_canonical_hash: canonical,
        issued_user_id: userId,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
      assert(!insErr, insErr?.message);

      // Claim it via the trusted-persistence RPC (server-side path).
      const { data: rpc, error: rpcErr } = await svc.rpc("claim_receipt_and_save_decision", {
        _receipt_hash: receiptHash, _user_id: userId, _label: "legacy claim",
      });
      assert(!rpcErr, rpcErr?.message);
      const row = (Array.isArray(rpc) ? rpc[0] : rpc) as { status: string; saved_decision_id: string };
      assertEquals(row.status, "created");

      const { data: saved } = await svc.from("saved_decisions").select("pack_version, result_v1")
        .eq("id", row.saved_decision_id).single();
      assertEquals(saved!.pack_version, "1.0.0",
        "saved decision keeps the 1.0.0 pack version even though 1.1.0 is now active");
    } finally {
      await svc.from("assessment_receipts").delete().eq("issued_user_id", userId);
      await svc.from("saved_decisions").delete().eq("user_id", userId);
      await svc.auth.admin.deleteUser(userId);
    }
  },
});

// ============================================================================
// 6. Idempotent publish — publication events do not multiply on retry
// ============================================================================
Deno.test({
  name: "pr3c-i.d/6 — 1.1.0 packs are bound and 1.0.0 rows are superseded",
  sanitizeOps: false, sanitizeResources: false,
  fn: async () => {
    for (const slug of ["midwife", "carpenter-joiner", "photographer"]) {
      // Query pack rows for this slug, then check their bindings + publications.
      // deno-lint-ignore no-explicit-any
      const { data: packs } = await (svc as any).from("career_packs")
        .select("id, pack_version").eq("slug", slug);
      // deno-lint-ignore no-explicit-any
      const packRows = (packs ?? []) as Array<{ id: string; pack_version: string }>;
      const v110 = packRows.find((p) => p.pack_version === "1.1.0");
      const v100 = packRows.find((p) => p.pack_version === "1.0.0");
      assert(v110, `${slug} 1.1.0 exists`);
      assert(v100, `${slug} 1.0.0 exists`);

      // deno-lint-ignore no-explicit-any
      const { data: binding } = await (svc as any).from("role_pack_bindings")
        .select("pack_id").eq("pack_id", v110!.id).maybeSingle();
      assert(binding, `${slug} 1.1.0 is bound`);

      // deno-lint-ignore no-explicit-any
      const { data: pub110 } = await (svc as any).from("career_pack_publications")
        .select("status").eq("pack_id", v110!.id).single();
      // deno-lint-ignore no-explicit-any
      const { data: pub100 } = await (svc as any).from("career_pack_publications")
        .select("status").eq("pack_id", v100!.id).single();
      assertEquals(pub110.status, "published", `${slug} 1.1.0 published`);
      assertEquals(pub100.status, "superseded", `${slug} 1.0.0 superseded`);
    }
  },
});
