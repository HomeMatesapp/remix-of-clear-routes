// Reality-check edge function — Release 1 (deterministic only).
//
// PR 2 final gate: the handler is now exported and takes an injectable
// `deps.resolveBinding` so lifecycle-state and hash-mismatch tests can drive
// it without touching production data. Behaviour in production is unchanged:
// the default resolver hits the `resolve_role_pack_binding` RPC with the
// service role.

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
import { canonicalHash, sha256Hex } from "../_shared/career-evaluator/v1/hash.ts";

const EVALUATOR_SCHEMA_VERSION = "reality-check-result/v1";
const DEFAULT_RECEIPT_TTL_MINUTES = 30;

const base64UrlEncode = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateReceipt = (): string => {
  // 256-bit random token, base64url-encoded (43 chars, no padding).
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

export interface ReceiptIssuer {
  (input: {
    roleId: string;
    roleSlug: string;
    packId: string;
    packVersion: string;
    packContentHash: string;
    resultV1: unknown;
    resultCanonicalHash: string;
    issuedUserId: string | null;
    expiresAt: string;
    receiptHash: string;
  }): Promise<void>;
}

const defaultReceiptIssuer: ReceiptIssuer = async (r) => {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("assessment_receipts").insert({
    receipt_hash: r.receiptHash,
    role_id: r.roleId,
    role_slug: r.roleSlug,
    pack_id: r.packId,
    pack_version: r.packVersion,
    pack_content_hash: r.packContentHash,
    evaluator_schema_version: EVALUATOR_SCHEMA_VERSION,
    evaluation_source: "generic_pack_v1",
    result_v1: r.resultV1,
    result_canonical_hash: r.resultCanonicalHash,
    issued_user_id: r.issuedUserId,
    expires_at: r.expiresAt,
  });
  if (error) throw new Error(`receipt_issue_failed: ${error.message}`);
};

const fetchReceiptTtlMinutes = async (): Promise<number> => {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return DEFAULT_RECEIPT_TTL_MINUTES;
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await sb.from("career_pack_config").select("receipt_ttl_minutes").maybeSingle();
    const n = (data as { receipt_ttl_minutes?: number } | null)?.receipt_ttl_minutes;
    return typeof n === "number" && n > 0 ? n : DEFAULT_RECEIPT_TTL_MINUTES;
  } catch { return DEFAULT_RECEIPT_TTL_MINUTES; }
};

const resolveIssuedUserId = async (req: Request): Promise<string | null> => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!url || !anon || !token) return null;
  try {
    const c = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await c.auth.getUser();
    return data?.user?.id ?? null;
  } catch { return null; }
};

export { answersToLabels } from "./_labels.ts";

export interface ResolvedBinding {
  pack_id: string;
  role_id: string;
  slug: string;
  pack_version: string;
  content_hash: string;
  content: unknown;
  status: string;
  role_slug: string;
  review_due_at: string | null;
  is_servable: boolean;
  geographic_scope: unknown;
}

export type BindingResolver = (
  roleId: string | null,
  roleSlug: string | null,
) => Promise<ResolvedBinding | null>;

const defaultResolver: BindingResolver = async (roleId, roleSlug) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("resolve_role_pack_binding", {
    _role_id: roleId, _slug: roleSlug,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as ResolvedBinding;
};

const validateRolePair = async (roleId: string, roleSlug: string): Promise<boolean> => {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return true;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.from("roles").select("id,role_slug").eq("id", roleId).maybeSingle();
  if (!data) return true;
  return data.role_slug === roleSlug;
};

export interface HandlerDeps {
  resolveBinding?: BindingResolver;
  validatePair?: (roleId: string, roleSlug: string) => Promise<boolean>;
  issueReceipt?: ReceiptIssuer;
  now?: () => Date;
  ttlMinutes?: number;
  resolveUserId?: (req: Request) => Promise<string | null>;
}

export const handleRealityCheck = async (req: Request, deps: HandlerDeps = {}): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const resolver = deps.resolveBinding ?? defaultResolver;
  const pairValidator = deps.validatePair ?? validateRolePair;

  try {
    const payload = await req.json();
    const {
      role, answers,
      electricianSignals, plumberSignals, heatingEngineerSignals,
      softwareEngineerSignals, registeredNurseSignals, policeOfficerSignals,
      actorSignals, solicitorSignals,
    } = payload;
    if (!role?.role_name) {
      return new Response(JSON.stringify({ error: "role required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleId: string | null = typeof role.id === "string" ? role.id : null;
    const roleSlug: string | null = typeof role.role_slug === "string" ? role.role_slug : null;

    if (roleId && roleSlug) {
      const ok = await pairValidator(roleId, roleSlug);
      if (!ok) {
        return new Response(JSON.stringify({ error: "role_slug_mismatch" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const binding = await resolver(roleId, roleSlug);

    if (binding) {
      if (roleSlug && binding.role_slug !== roleSlug) {
        return new Response(JSON.stringify({ error: "role_slug_mismatch" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!binding.is_servable) {
        // Controlled response — no pack content, no DB details, only the
        // status token the client needs to render an unavailable state.
        return new Response(JSON.stringify({
          error: "pack_unavailable",
          packMetadata: {
            slug: binding.slug,
            status: binding.status,
            reviewDueAt: binding.review_due_at,
          },
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const recomputed = await canonicalHash(binding.content);
      if (recomputed !== binding.content_hash) {
        return new Response(JSON.stringify({
          error: "pack_hash_mismatch",
          pack_version: binding.pack_version,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = evaluateGenericPack(binding.content, answers ?? {});

      // Issue an assessment receipt. The opaque token is returned to the
      // browser; only its SHA-256 hash is stored server-side.
      const receipt = generateReceipt();
      const receiptHash = await sha256Hex(receipt);
      const resultCanonicalHash = await canonicalHash(result);
      const ttl = deps.ttlMinutes ?? await fetchReceiptTtlMinutes();
      const nowFn = deps.now ?? (() => new Date());
      const expiresAt = new Date(nowFn().getTime() + ttl * 60_000).toISOString();
      const issuedUserId = deps.resolveUserId
        ? await deps.resolveUserId(req)
        : await resolveIssuedUserId(req);
      const issuer = deps.issueReceipt ?? defaultReceiptIssuer;
      await issuer({
        roleId: binding.role_id,
        roleSlug: binding.role_slug,
        packId: binding.pack_id,
        packVersion: binding.pack_version,
        packContentHash: binding.content_hash,
        resultV1: result,
        resultCanonicalHash,
        issuedUserId,
        expiresAt,
        receiptHash,
      });

      return new Response(JSON.stringify({
        result,
        assessmentReceipt: receipt,
        assessmentReceiptExpiresAt: expiresAt,
        packMetadata: {
          packVersion: binding.pack_version,
          contentHash: binding.content_hash,
          slug: binding.slug,
          status: binding.status,
          reviewDueAt: binding.review_due_at,
          geographicScope: binding.geographic_scope,
          evaluatorSchemaVersion: EVALUATOR_SCHEMA_VERSION,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Legacy engines (unchanged behaviour for the eight existing careers).
    let result;
    if (role.role_slug === "electrician" && electricianSignals) result = buildElectricianResult({ signals: electricianSignals });
    else if (role.role_slug === "plumber" && plumberSignals) result = buildPlumberResult({ signals: plumberSignals });
    else if (role.role_slug === "hvac-engineer" && heatingEngineerSignals) result = buildHeatingEngineerResult({ signals: heatingEngineerSignals });
    else if (role.role_slug === "software-engineer" && softwareEngineerSignals) result = buildSoftwareEngineerResult({ signals: softwareEngineerSignals });
    else if (role.role_slug === "registered-nurse" && registeredNurseSignals) result = buildRegisteredNurseResult({ signals: registeredNurseSignals });
    else if (role.role_slug === "police-officer" && policeOfficerSignals) result = buildPoliceOfficerResult({ signals: policeOfficerSignals });
    else if (role.role_slug === "actor" && actorSignals) result = buildActorResult({ signals: actorSignals });
    else if (role.role_slug === "solicitor" && solicitorSignals) result = buildSolicitorResult({ signals: solicitorSignals });
    else result = buildResult(answers, role);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve((req) => handleRealityCheck(req));
