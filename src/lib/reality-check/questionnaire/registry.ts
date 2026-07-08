// Resolve a RoleConfig by role slug. Slug is the ONLY primary key —
// display names are copy and may change.

import type { ResolvedConfig, RoleConfig } from "./types";
import { electricianConfig } from "./roles/electrician";
import { plumberConfig } from "./roles/plumber";
import { heatingEngineerConfig } from "./roles/heating-engineer";
import { softwareEngineerConfig } from "./roles/software-engineer";

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  [electricianConfig.roleSlug]: electricianConfig,
  [plumberConfig.roleSlug]: plumberConfig,
  [heatingEngineerConfig.roleSlug]: heatingEngineerConfig,
  [softwareEngineerConfig.roleSlug]: softwareEngineerConfig,
};

/**
 * True iff this role has a reviewed modular Reality-check — meaning both a
 * reviewed questionnaire and a reviewed deterministic route engine exist for it.
 *
 * This gate is deliberately narrow: it authorises use of the modular wizard and
 * bypass of the legacy service-level "not reviewed" gate. It does NOT authorise
 * skipping evidence, coverage, or availability caveats — those are enforced by
 * the engine/result copy independently.
 */
export const hasReviewedModularRealityCheck = (roleSlug: string): boolean =>
  Object.prototype.hasOwnProperty.call(ROLE_CONFIGS, roleSlug);

/** @deprecated Use `hasReviewedModularRealityCheck` — kept for backwards compat. */
export const hasModularConfig = hasReviewedModularRealityCheck;

export const resolveConfig = (roleSlug: string): ResolvedConfig | null =>
  ROLE_CONFIGS[roleSlug] ?? null;

// Exposed for tests.
export const _internal = { ROLE_CONFIGS };
