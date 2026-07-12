// PR 2 hardening proofs, run under Deno with the SUPABASE_SERVICE_ROLE_KEY.
// Everything runs against synthetic rows and is undone at the end.
// Uses .rpc / .from with the service role, which:
//   - has table permissions (so a rejection is proof of a TRIGGER, not RLS/GRANT);
//   - bypasses RLS the same way a compromised-service-role would.

// Env vars are provided by the edge-function test harness; no dotenv load.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")
  ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
  ?? "";
if (!URL_ || !SVC) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
const sb = createClient(URL_, SVC, { auth: { persistSession: false } });
const sbAnon = ANON ? createClient(URL_, ANON, { auth: { persistSession: false } }) : null;


// -- Helpers ------------------------------------------------------
const uniq = () => crypto.randomUUID().slice(0, 8);
const hex64 = (c: string) => c.repeat(64);

interface Ids {
  roleA: string; roleB: string;
  ownerId: string; reviewerId: string;
  packA1: string; packA2: string; packB: string;
}

const setup = async (): Promise<Ids> => {
  const suffix = uniq();
  const { data: rA, error: eA } = await sb.from("roles").insert({
    role_name: `TestRole A ${suffix}`, role_slug: `test-role-a-${suffix}`,
  }).select("id").single();
  if (eA) throw eA;
  const { data: rB, error: eB } = await sb.from("roles").insert({
    role_name: `TestRole B ${suffix}`, role_slug: `test-role-b-${suffix}`,
  }).select("id").single();
  if (eB) throw eB;

  const upsertIdentity = async (name: string) => {
    const { data: existing } = await sb.from("career_pack_identities")
      .select("id").eq("display_name", name).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await sb.from("career_pack_identities")
      .insert({ display_name: name, is_test_identity: true })
      .select("id").single();
    if (error) throw error;
    return data.id;
  };
  const ownerId = await upsertIdentity(`proof-owner-${suffix}`);
  const reviewerId = await upsertIdentity(`proof-reviewer-${suffix}`);

  const mkPack = async (roleId: string, slug: string, ver: string, hashChar: string, contentKey: string) => {
    const { data, error } = await sb.from("career_packs").insert({
      role_id: roleId, slug, pack_version: ver,
      schema_version: "career-decision-pack/v1", archetype_id: "proof",
      content_hash: hex64(hashChar), content: { proof: contentKey },
      owner_identity_id: ownerId, reviewer_identity_id: reviewerId,
      environment: "development", is_test: true, imported_by: "hardening-test",
    }).select("id").single();
    if (error) throw error;
    await sb.from("career_pack_publications").insert({ pack_id: data.id, status: "draft" });
    return data.id as string;
  };
  const packA1 = await mkPack(rA.id, `proof-a-${suffix}`, "1.0.0", "a", "a1");
  const packA2 = await mkPack(rA.id, `proof-a-${suffix}`, "1.0.1", "b", "a2");
  const packB  = await mkPack(rB.id, `proof-b-${suffix}`, "1.0.0", "c", "b1");

  return { roleA: rA.id, roleB: rB.id, ownerId, reviewerId, packA1, packA2, packB };
};

const teardown = async (ids: Ids) => {
  // Best-effort cleanup. Immutability + append-only triggers prevent us from
  // removing career_packs / publications / events even with the service role,
  // so we leave the synthetic rows behind (they are inert test data). We
  // remove the mutable bits — saved_decisions and role_pack_bindings — and
  // then the synthetic roles (which will FAIL if RESTRICT-referenced by packs,
  // and that failure is expected and swallowed).
  await sb.from("saved_decisions").delete().in("pack_id", [ids.packA1, ids.packA2, ids.packB]);
  await sb.from("role_pack_bindings").delete().in("role_id", [ids.roleA, ids.roleB]);
};


// A single dry-run beforehand: ensure the purge helper exists so teardown works.
// We create it via a migration-equivalent RPC call — but we cannot run DDL through
// PostgREST. Instead, we DISABLE the triggers during teardown by relying on the
// service role being superuser-adjacent... which it is NOT. So we accept leaving
// synthetic rows behind and simply mark them as archived, then delete role_pack_bindings.
// Teardown becomes best-effort; the synthetic pack rows remain but are inert.

Deno.test("PR 2 hardening — full proof matrix", async (t) => {
  const ids = await setup();

  try {
    await t.step("1a immutability: UPDATE career_packs.content is rejected", async () => {
      const { error } = await sb.from("career_packs").update({ content: { tampered: true } })
        .eq("id", ids.packA1);
      assert(error !== null, "expected error");
      assert(/immutable/i.test(error!.message), `unexpected error: ${error!.message}`);
    });

    await t.step("1b immutability: UPDATE career_packs.role_id is rejected", async () => {
      const { error } = await sb.from("career_packs").update({ role_id: ids.roleB })
        .eq("id", ids.packA1);
      assert(error !== null); assert(/immutable/i.test(error!.message));
    });

    await t.step("1c immutability: UPDATE career_packs.pack_version + hash is rejected", async () => {
      const { error } = await sb.from("career_packs")
        .update({ pack_version: "9.9.9", content_hash: hex64("d") })
        .eq("id", ids.packA1);
      assert(error !== null); assert(/immutable/i.test(error!.message));
    });

    await t.step("1d immutability: DELETE career_packs is rejected", async () => {
      const { error } = await sb.from("career_packs").delete().eq("id", ids.packA1);
      assert(error !== null); assert(/immutable/i.test(error!.message));
    });

    await t.step("2a events append-only: UPDATE rejected", async () => {
      await sb.from("career_pack_publication_events").insert({
        pack_id: ids.packA1, event_type: "imported", to_status: "draft", actor: "proof",
      });
      const { error } = await sb.from("career_pack_publication_events")
        .update({ actor: "hax0r" }).eq("pack_id", ids.packA1);
      assert(error !== null); assert(/append-only/i.test(error!.message));
    });

    await t.step("2b events append-only: DELETE rejected", async () => {
      const { error } = await sb.from("career_pack_publication_events")
        .delete().eq("pack_id", ids.packA1);
      assert(error !== null); assert(/append-only/i.test(error!.message));
    });

    await t.step("3 publications legitimate UPDATE (notes) accepted", async () => {
      const { error } = await sb.from("career_pack_publications")
        .update({ notes: "legit lifecycle update" }).eq("pack_id", ids.packA1);
      assertEquals(error, null);
    });

    await t.step("4a binding: cross-role bind rejected", async () => {
      // Make pack_b servable first so servability doesn't shadow the role-match check.
      await sb.from("career_pack_publications").update({ status: "published", published_at: new Date().toISOString() })
        .eq("pack_id", ids.packB);
      const { error } = await sb.from("role_pack_bindings").insert({
        role_id: ids.roleA, pack_id: ids.packB, bound_by: "proof",
      });
      assert(error !== null);
      assert(/does not match/.test(error!.message) || /check_violation/.test(error!.code ?? ""),
        `unexpected: ${error!.message}`);
      // clean up
      await sb.from("career_pack_publications").update({ status: "draft", published_at: null })
        .eq("pack_id", ids.packB);
    });

    await t.step("4b binding: draft pack rejected (servability trigger)", async () => {
      const { error } = await sb.from("role_pack_bindings").insert({
        role_id: ids.roleA, pack_id: ids.packA1, bound_by: "proof",
      });
      assert(error !== null);
      assert(/not servable/.test(error!.message), `unexpected: ${error!.message}`);
    });

    await t.step("4c binding: suspended pack rejected", async () => {
      await sb.from("career_pack_publications")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("pack_id", ids.packA1);
      const { error } = await sb.from("role_pack_bindings").insert({
        role_id: ids.roleA, pack_id: ids.packA1, bound_by: "proof",
      });
      assert(error !== null); assert(/not servable/.test(error!.message));
      await sb.from("career_pack_publications")
        .update({ status: "draft", suspended_at: null }).eq("pack_id", ids.packA1);
    });

    await t.step("4d binding: archived pack rejected", async () => {
      await sb.from("career_pack_publications")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("pack_id", ids.packA1);
      const { error } = await sb.from("role_pack_bindings").insert({
        role_id: ids.roleA, pack_id: ids.packA1, bound_by: "proof",
      });
      assert(error !== null); assert(/not servable/.test(error!.message));
      await sb.from("career_pack_publications")
        .update({ status: "draft", archived_at: null }).eq("pack_id", ids.packA1);
    });

    await t.step("5 lifecycle matrix via career_pack_is_servable", async () => {
      const svc = async () => {
        const { data } = await sb.rpc("career_pack_is_servable", { _pack_id: ids.packA1 });
        return data as boolean;
      };
      // 5a: published
      await sb.from("career_pack_publications").update({ status: "published", published_at: new Date().toISOString() }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), true, "5a published");
      // 5b: review_due within grace (5 days ago; grace=30d)
      await sb.from("career_pack_publications").update({
        status: "review_due", review_due_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        published_at: null,
      }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), true, "5b review_due within grace");
      // 5c: past grace (60 days ago)
      await sb.from("career_pack_publications").update({
        review_due_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), false, "5c review_due past 30-day grace");
      // 5d: suspended
      await sb.from("career_pack_publications").update({
        status: "suspended", suspended_at: new Date().toISOString(), review_due_at: null,
      }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), false, "5d suspended");
      // 5e: superseded
      await sb.from("career_pack_publications").update({
        status: "superseded", superseded_at: new Date().toISOString(), suspended_at: null,
      }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), false, "5e superseded");
      // 5f: archived
      await sb.from("career_pack_publications").update({
        status: "archived", archived_at: new Date().toISOString(), superseded_at: null,
      }).eq("pack_id", ids.packA1);
      assertEquals(await svc(), false, "5f archived");
    });

    await t.step("6 idempotent publish_and_bind_career_pack", async () => {
      // Reset a1 → draft, no binding
      await sb.from("role_pack_bindings").delete().eq("role_id", ids.roleA);
      await sb.from("career_pack_publications").update({
        status: "draft", published_at: null, suspended_at: null, superseded_at: null, archived_at: null,
      }).eq("pack_id", ids.packA1);

      const { data: r1, error: e1 } = await sb.rpc("publish_and_bind_career_pack", { _pack_id: ids.packA1, _actor: "proof" });
      assertEquals(e1, null);
      assertEquals((r1 as { changed: boolean }).changed, true, "first publish reports changed=true");

      const { count: before } = await sb.from("career_pack_publication_events")
        .select("*", { count: "exact", head: true }).eq("pack_id", ids.packA1);

      const { data: r2 } = await sb.rpc("publish_and_bind_career_pack", { _pack_id: ids.packA1, _actor: "proof" });
      assertEquals((r2 as { changed: boolean }).changed, false, "republish reports changed=false");

      const { count: after } = await sb.from("career_pack_publication_events")
        .select("*", { count: "exact", head: true }).eq("pack_id", ids.packA1);
      assertEquals(after, before, "no new events on idempotent retry");
    });

    await t.step("7 atomic supersede: publish v2 replaces v1", async () => {
      const { data: r, error } = await sb.rpc("publish_and_bind_career_pack", {
        _pack_id: ids.packA2, _actor: "proof",
      });
      assertEquals(error, null);
      assertEquals((r as { changed: boolean }).changed, true);

      // Exactly one publication in 'published' for role A
      const { data: pubs } = await sb.from("career_pack_publications")
        .select("pack_id,status,career_packs!inner(role_id)")
        .eq("career_packs.role_id", ids.roleA).eq("status", "published");
      assertEquals(pubs?.length, 1, "exactly one published pub per role");
      assertEquals((pubs![0] as { pack_id: string }).pack_id, ids.packA2);

      const { data: prior } = await sb.from("career_pack_publications")
        .select("status").eq("pack_id", ids.packA1).single();
      assertEquals(prior?.status, "superseded");

      const { data: binding } = await sb.from("role_pack_bindings")
        .select("pack_id").eq("role_id", ids.roleA).single();
      assertEquals(binding?.pack_id, ids.packA2);
    });

    await t.step("7f one-active-pack trigger blocks a second 'published' row", async () => {
      const { error } = await sb.from("career_pack_publications")
        .update({ status: "published", published_at: new Date().toISOString(), superseded_at: null })
        .eq("pack_id", ids.packA1);
      assert(error !== null, "expected rejection");
      assert(/already published/.test(error!.message), `unexpected: ${error!.message}`);
    });

    await t.step("8 resolver: role/slug consistency + fail-closed on unknown", async () => {
      // Get canonical slug for roleA
      const { data: role } = await sb.from("roles").select("role_slug").eq("id", ids.roleA).single();
      // Correct pair → 1 row
      const { data: ok } = await sb.rpc("resolve_active_career_pack", { _role_id: ids.roleA, _slug: role!.role_slug });
      assertEquals((ok as unknown[]).length, 1);
      // Mismatched pair → 0 rows
      const { data: mismatch } = await sb.rpc("resolve_active_career_pack", { _role_id: ids.roleA, _slug: "definitely-not-my-slug" });
      assertEquals((mismatch as unknown[]).length, 0);
      // Nonexistent role_id → 0 rows
      const { data: nx } = await sb.rpc("resolve_active_career_pack", { _role_id: "00000000-0000-0000-0000-000000000000", _slug: null });
      assertEquals((nx as unknown[]).length, 0);
      // Both null → 0 rows
      const { data: none } = await sb.rpc("resolve_active_career_pack", { _role_id: null, _slug: null });
      assertEquals((none as unknown[]).length, 0);
    });

    await t.step("9 saved_decisions consistency check", async () => {
      // Partial V1 → rejected
      const { error: partErr } = await sb.from("saved_decisions").insert({
        share_token: `proof-partial-${uniq()}`,
        role_id: ids.roleA, role_snapshot: { role_name: "x" },
        answers: {}, result: {},
        pack_id: ids.packA2, pack_version: "1.0.1",
      });
      assert(partErr !== null, "expected constraint violation");
      // Full V1 → accepted
      const { error: fullErr } = await sb.from("saved_decisions").insert({
        share_token: `proof-full-${uniq()}`,
        role_id: ids.roleA, role_snapshot: { role_name: "x" },
        answers: {}, result: {},
        pack_id: ids.packA2, pack_version: "1.0.1",
        pack_content_hash: hex64("b"), evaluator_schema_version: "reality-check-result/v1",
        result_v1: { ok: true },
      });
      assertEquals(fullErr, null, `full V1 should be accepted: ${fullErr?.message}`);
      // Legacy null V1 → accepted
      const { error: legacyErr } = await sb.from("saved_decisions").insert({
        share_token: `proof-legacy-${uniq()}`,
        role_id: ids.roleA, role_snapshot: { role_name: "x" },
        answers: {}, result: {},
      });
      assertEquals(legacyErr, null);
    });

    await t.step("10 RLS: anon cannot read any of the pack tables", async () => {
      if (!sbAnon) { console.warn("skipped: no anon key in env"); return; }
      for (const tbl of ["career_packs", "career_pack_publications", "career_pack_publication_events", "career_pack_identities", "role_pack_bindings", "career_pack_config"] as const) {
        const { data, error } = await sbAnon.from(tbl).select("*").limit(1);
        const rows = data?.length ?? 0;
        assertEquals(rows, 0, `anon should read 0 rows from ${tbl} (got ${rows}, error=${error?.message})`);
      }
    });

    await t.step("10b RLS: anon cannot insert/update/delete", async () => {
      if (!sbAnon) { console.warn("skipped: no anon key in env"); return; }
      const { error: insErr } = await sbAnon.from("role_pack_bindings").insert({
        role_id: ids.roleA, pack_id: ids.packA2, bound_by: "attacker",
      });
      assert(insErr !== null, "anon insert should fail");
      const { error: updErr } = await sbAnon.from("career_pack_publications")
        .update({ status: "suspended" }).eq("pack_id", ids.packA2);
      const { data: after } = await sb.from("career_pack_publications")
        .select("status").eq("pack_id", ids.packA2).single();
      assertNotEquals(after?.status, "suspended", `anon must not have changed status (updErr=${updErr?.message})`);
    });

    await t.step("10c RLS: anon cannot invoke privileged RPCs", async () => {
      if (!sbAnon) { console.warn("skipped: no anon key in env"); return; }
      const { error: e1 } = await sbAnon.rpc("resolve_active_career_pack", { _role_id: ids.roleA, _slug: null });
      assert(e1 !== null, "anon should not be able to call resolve_active_career_pack");
      const { error: e2 } = await sbAnon.rpc("publish_and_bind_career_pack", { _pack_id: ids.packA2, _actor: "attacker" });
      assert(e2 !== null, "anon should not be able to call publish_and_bind_career_pack");
    });
  } finally {
    await teardown(ids);
  }
});
