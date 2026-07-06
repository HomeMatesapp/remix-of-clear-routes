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
import { buildResult } from "./_readiness.ts";
import { buildElectricianResult } from "./_electrician.ts";
import { getCorsHeaders } from "../_shared/cors.ts";


// Re-exported so existing tests against answersToLabels keep passing.
export { answersToLabels } from "./_labels.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { role, answers, electricianSignals } = await req.json();
    if (!role?.role_name) {
      return new Response(JSON.stringify({ error: "role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Slug-based dispatch: Electrician runs the new modular engine driven by
    // structured signals extracted client-side. Everything else stays on the
    // legacy deterministic readiness engine.
    let result;
    if (role.role_slug === "electrician" && electricianSignals) {
      result = buildElectricianResult({ signals: electricianSignals });
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
