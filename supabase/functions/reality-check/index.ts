// Reality-check edge function — Release 1 (deterministic only).
//
// LLM has been disabled per the v3 review. This function now:
//   1. Validates the request shape.
//   2. Runs the deterministic readiness engine (see ./_readiness.ts) which
//      mirrors the runtime-neutral classifier in src/lib/reality-check/readiness.ts.
//   3. Returns a fully-formed RealityCheckResult.
//
// Free-text fields (`notes`, `relevantBackground`, `area`) are accepted but
// only `relevantBackground` is used by the classifier (presence/absence as a
// signal). `notes` is intentionally NOT used to generate prose — Release 1
// produces no long-form generated content.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildResult } from "./_readiness.ts";
import { buildElectricianResult } from "./_electrician.ts";
import { buildPlumberResult } from "./_plumber.ts";
import { buildHeatingEngineerResult } from "./_heating_engineer.ts";
import { buildSoftwareEngineerResult } from "./_software_engineer.ts";
import { buildRegisteredNurseResult } from "./_registered_nurse.ts";
import { buildPoliceOfficerResult } from "./_police_officer.ts";
import { buildActorResult } from "./_actor.ts";
import { buildSolicitorResult } from "./_solicitor.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { evaluateGenericPack } from "./_generic_pack.ts";
import { canonicalHash } from "../_shared/career-evaluator/v1/hash.ts";


// Re-exported so existing tests against answersToLabels keep passing.
export { answersToLabels } from "./_labels.ts";

// Server-side pack resolver.
// SECURITY: never accepts a client-supplied pack row id. Resolves via
// role_pack_bindings using the canonical role_id (preferred) or role_slug.
// Fails closed on hash mismatch, missing binding, or non-servable status.
const resolveActivePack = async (roleId: string | null, roleSlug: string | null) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("resolve_active_career_pack", {
    _role_id: roleId,
    _slug: roleSlug,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as {
    pack_id: string; role_id: string; slug: string;
    pack_version: string; content_hash: string; content: unknown; status: string;
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { role, answers, electricianSignals, plumberSignals, heatingEngineerSignals, softwareEngineerSignals, registeredNurseSignals, policeOfficerSignals, actorSignals, solicitorSignals } = payload;
    if (!role?.role_name) {
      return new Response(JSON.stringify({ error: "role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Server-side generic pack path. Client cannot select the pack.
    //    We only trust role.id (canonical) or role.role_slug (canonical fallback).
    const roleId: string | null = typeof role.id === "string" ? role.id : null;
    const roleSlug: string | null = typeof role.role_slug === "string" ? role.role_slug : null;
    const resolved = await resolveActivePack(roleId, roleSlug);
    if (resolved) {
      // Fail closed on hash mismatch: prevents serving tampered content.
      const recomputed = await canonicalHash(resolved.content);
      if (recomputed !== resolved.content_hash) {
        return new Response(JSON.stringify({
          error: "pack_hash_mismatch",
          pack_version: resolved.pack_version,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const result = evaluateGenericPack(resolved.content, answers ?? {});
      return new Response(JSON.stringify({
        result,
        packMetadata: {
          packVersion: resolved.pack_version,
          contentHash: resolved.content_hash,
          slug: resolved.slug,
          status: resolved.status,
          evaluatorSchemaVersion: "reality-check-result/v1",
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Legacy engines (unchanged behaviour for the eight existing careers).
    let result;
    if (role.role_slug === "electrician" && electricianSignals) {
      result = buildElectricianResult({ signals: electricianSignals });
    } else if (role.role_slug === "plumber" && plumberSignals) {
      result = buildPlumberResult({ signals: plumberSignals });
    } else if (role.role_slug === "hvac-engineer" && heatingEngineerSignals) {
      result = buildHeatingEngineerResult({ signals: heatingEngineerSignals });
    } else if (role.role_slug === "software-engineer" && softwareEngineerSignals) {
      result = buildSoftwareEngineerResult({ signals: softwareEngineerSignals });
    } else if (role.role_slug === "registered-nurse" && registeredNurseSignals) {
      result = buildRegisteredNurseResult({ signals: registeredNurseSignals });
    } else if (role.role_slug === "police-officer" && policeOfficerSignals) {
      result = buildPoliceOfficerResult({ signals: policeOfficerSignals });
    } else if (role.role_slug === "actor" && actorSignals) {
      result = buildActorResult({ signals: actorSignals });
    } else if (role.role_slug === "solicitor" && solicitorSignals) {
      result = buildSolicitorResult({ signals: solicitorSignals });
    } else {
      result = buildResult(answers, role);
    }
    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
