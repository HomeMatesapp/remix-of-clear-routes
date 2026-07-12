// save-decision — trusted persistence gate (PR 3a).
//
// The browser NEVER submits the authoritative result. It supplies only:
//   - `receipt`: the opaque assessment receipt returned by reality-check
//   - `label`:   optional participant-authored short label
//
// The server:
//   1. Requires a verified Supabase JWT (verify_jwt = true).
//   2. Hashes the receipt and looks up the server-held snapshot.
//   3. Atomically claims + writes the saved_decisions row via the
//      `claim_receipt_and_save_decision` RPC, which enforces:
//        - unknown / revoked / expired / cross-user rejection
//        - idempotent replay by the same user returns the same row
//        - concurrent saves serialise via SELECT ... FOR UPDATE
//        - the saved row copies the exact server-held result_v1
//
// Client-authored evaluation fields (pack_id, pack_version, content_hash,
// result_v1, etc.) are IGNORED. They are never read from the request body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/career-evaluator/v1/hash.ts";

interface SaveRequest {
  receipt?: unknown;
  label?: unknown;
  // Anything else is intentionally ignored.
}

export interface SaveDeps {
  now?: () => Date;
  // Typed as `any` because we compose clients built against distinct
  // generated Database types (tests vs prod) and don't need type safety
  // on the RPC surface at this boundary.
  // deno-lint-ignore no-explicit-any
  serviceClient?: any;
  // deno-lint-ignore no-explicit-any
  authClientForToken?: (token: string) => any;
}

export const handleSaveDecision = async (
  req: Request,
  deps: SaveDeps = {},
): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authClient = deps.authClientForToken
    ? deps.authClientForToken(token)
    : createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: SaveRequest;
  try { body = await req.json() as SaveRequest; }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  }); }

  const receipt = typeof body?.receipt === "string" ? body.receipt.trim() : "";
  if (!receipt || receipt.length < 32 || receipt.length > 128) {
    return new Response(JSON.stringify({ error: "invalid_receipt" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rawLabel = typeof body?.label === "string" ? body.label.trim().slice(0, 120) : "";
  const label = rawLabel.length > 0 ? rawLabel : null;

  const receiptHash = await sha256Hex(receipt);

  const svc = deps.serviceClient ?? createClient(url, svcKey, {
    auth: { persistSession: false },
  });

  const { data: rpc, error: rpcErr } = await svc.rpc("claim_receipt_and_save_decision", {
    _receipt_hash: receiptHash, _user_id: userId, _label: label,
  });
  if (rpcErr) {
    return new Response(JSON.stringify({ error: "save_failed", message: rpcErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rows = Array.isArray(rpc) ? rpc : [rpc];
  const row = rows[0] as { status?: string; saved_decision_id?: string } | null;
  const status: string = row?.status ?? "unknown_error";
  const savedId: string | null = row?.saved_decision_id ?? null;

  // Map RPC status to HTTP semantics.
  switch (status) {
    case "created":
      return new Response(JSON.stringify({ savedDecisionId: savedId, status: "created" }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    case "already_claimed":
      return new Response(JSON.stringify({ savedDecisionId: savedId, status: "already_claimed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    case "unknown_receipt":
    case "revoked_receipt":
    case "expired_receipt":
      return new Response(JSON.stringify({ error: "receipt_invalid" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    case "claimed_by_other":
    case "issued_to_other_user":
      return new Response(JSON.stringify({ error: "receipt_not_yours" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    default:
      return new Response(JSON.stringify({ error: "save_failed", status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
};

serve((req) => handleSaveDecision(req));
