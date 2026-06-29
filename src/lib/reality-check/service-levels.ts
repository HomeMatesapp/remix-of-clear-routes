// Role coverage levels (mirrors the `role_service_level` Postgres enum).
//
// Source of truth for user-facing copy. Keep aligned with the migration:
//   CREATE TYPE role_service_level AS ENUM ('info_only', 'reality_check', 'full_support');
//
// Promotion criteria (do not skip):
//   - info_only      → reality_check: pilot role with reviewed pathway + entry-requirement logic.
//   - reality_check  → full_support:  salary, requirements and freshness reviewed AND
//                                      verified, active, recently-checked opportunities
//                                      exist in at least one supported region AND
//                                      matching has been manually QA'd.

export type RoleServiceLevel = "info_only" | "reality_check" | "full_support";

export const SERVICE_LEVEL_LABEL: Record<RoleServiceLevel, string> = {
  info_only:     "Info only",
  reality_check: "Reality-check ready",
  full_support:  "Full support",
};

export const SERVICE_LEVEL_DESCRIPTION: Record<RoleServiceLevel, string> = {
  info_only:
    "General role information only. Adaptive Reality-check has not been reviewed for this role yet.",
  reality_check:
    "Adaptive assessment and deterministic route judgement are available. Verified local opportunity coverage may still be limited.",
  full_support:
    "Reviewed route judgement plus current, verified opportunity matching and My Route support.",
};

export const isRealityCheckEnabled = (level: RoleServiceLevel | null | undefined): boolean =>
  level === "reality_check" || level === "full_support";
