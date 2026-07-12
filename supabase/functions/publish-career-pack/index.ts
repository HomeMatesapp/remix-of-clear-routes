// Admin-only edge function to import + publish a career pack.
//
// Auth model:
//   The client sends `Authorization: Bearer <CAREER_PACK_PUBLISH_SECRET>`.
//   We compare it in constant time against the dedicated publishing secret,
//   NOT the Supabase service-role key. This limits the blast radius of a
//   compromised publishing credential to this one controlled endpoint —
//   the function itself still uses the service-role key server-side to
//   perform DB writes.
//
// Client input NEVER selects a pack row id. The pack row is created here from
// the submitted pack JSON, and the role_pack_bindings update is done inside
// `publish_and_bind_career_pack` in the database — atomic and transactional.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { careerDecisionPackV1, validatePackCrossRefs } from "../_shared/career-evaluator/v1/schema.ts";
import { evaluate } from "../_shared/career-evaluator/v1/evaluate.ts";
import { canonicalHash } from "../_shared/career-evaluator/v1/hash.ts";
import type { CareerDecisionPackV1 } from "../_shared/career-evaluator/v1/types.ts";

const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

interface PublishRequest {
  pack: unknown;
  environment: "development" | "staging" | "production";
  isTest: boolean;
  importedBy: string;
  dryRun: boolean;
  publish: boolean;
  expectedProjectRef?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const publishSecret = Deno.env.get("CAREER_PACK_PUBLISH_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const projectRef = Deno.env.get("SUPABASE_PROJECT_ID") ?? Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1] ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!publishSecret || !constantTimeEquals(provided, publishSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: PublishRequest;
  try {
    body = await req.json() as PublishRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Environment guard for production
  if (body.environment === "production") {
    if (!body.expectedProjectRef || body.expectedProjectRef !== projectRef) {
      return new Response(JSON.stringify({
        error: "production publish requires matching expectedProjectRef",
        expected: body.expectedProjectRef,
        actual_matches: false,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.isTest) {
      return new Response(JSON.stringify({ error: "test packs cannot be published to production" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Schema + cross-ref validation
  const parsed = careerDecisionPackV1.safeParse(body.pack);
  if (!parsed.success) {
    return new Response(JSON.stringify({
      error: "schema_validation_failed",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const pack = parsed.data as CareerDecisionPackV1;
  const crossRefErrors = validatePackCrossRefs(pack);
  if (crossRefErrors.length > 0) {
    return new Response(JSON.stringify({ error: "cross_ref_validation_failed", issues: crossRefErrors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Test profiles must all evaluate deterministically without throwing.
  for (const profile of pack.testProfiles) {
    try { evaluate(pack, profile.answers, { now: "2026-07-12T00:00:00.000Z" }); }
    catch (e) {
      return new Response(JSON.stringify({ error: "test_profile_failed", profile: profile.id, message: String(e) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const contentHash = await canonicalHash(pack);

  if (body.dryRun) {
    return new Response(JSON.stringify({
      dryRun: true,
      contentHash,
      roleId: pack.roleId,
      slug: pack.slug,
      packVersion: pack.packVersion,
      environment: body.environment,
      isTest: body.isTest,
      testProfilesEvaluated: pack.testProfiles.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  // Upsert identities (idempotent by display_name).
  const upsertIdentity = async (name: string, isTest: boolean): Promise<string> => {
    const { data: existing } = await supabase.from("career_pack_identities")
      .select("id").eq("display_name", name).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase.from("career_pack_identities")
      .insert({ display_name: name, is_test_identity: isTest })
      .select("id").single();
    if (error) throw new Error(`identity insert failed: ${error.message}`);
    return data.id;
  };

  try {
    const ownerId = await upsertIdentity(pack.contentReview.ownerDisplayName, body.isTest);
    const reviewerId = await upsertIdentity(pack.contentReview.reviewerDisplayName, body.isTest);

    // Check for an existing pack by (role_id, pack_version) — idempotent import.
    const { data: existingPack } = await supabase.from("career_packs")
      .select("id, content_hash")
      .eq("role_id", pack.roleId).eq("pack_version", pack.packVersion).maybeSingle();

    let packRowId: string;
    if (existingPack) {
      if (existingPack.content_hash !== contentHash) {
        return new Response(JSON.stringify({
          error: "version_conflict",
          message: `pack ${pack.slug}@${pack.packVersion} already imported with a different content hash. Bump packVersion.`,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      packRowId = existingPack.id;
    } else {
      const { data: inserted, error: insErr } = await supabase.from("career_packs").insert({
        role_id: pack.roleId,
        slug: pack.slug,
        pack_version: pack.packVersion,
        schema_version: pack.schemaVersion,
        archetype_id: pack.archetypeId,
        content_hash: contentHash,
        content: pack,
        owner_identity_id: ownerId,
        reviewer_identity_id: reviewerId,
        environment: body.environment,
        is_test: body.isTest,
        imported_by: body.importedBy,
      }).select("id").single();
      if (insErr) throw new Error(`career_packs insert failed: ${insErr.message}`);
      packRowId = inserted.id;

      const { error: pubErr } = await supabase.from("career_pack_publications").insert({
        pack_id: packRowId, status: "draft",
      });
      if (pubErr) throw new Error(`publications insert failed: ${pubErr.message}`);

      const { error: evtErr } = await supabase.from("career_pack_publication_events").insert({
        pack_id: packRowId, event_type: "imported", to_status: "draft",
        actor: body.importedBy, metadata: { environment: body.environment, is_test: body.isTest },
      });
      if (evtErr) throw new Error(`event insert failed: ${evtErr.message}`);
    }

    if (body.publish) {
      const { error: rpcErr } = await supabase.rpc("publish_and_bind_career_pack", {
        _pack_id: packRowId, _actor: body.importedBy,
      });
      if (rpcErr) throw new Error(`publish_and_bind failed: ${rpcErr.message}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      packRowId,
      contentHash,
      published: body.publish,
      roleId: pack.roleId,
      slug: pack.slug,
      packVersion: pack.packVersion,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "publish_failed", message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
