// Resolve a RoleConfig by role slug. Slug is the ONLY primary key —
// display names are copy and may change.

import type { ResolvedConfig, RoleConfig } from "./types";
import { electricianConfig } from "./roles/electrician";
import { plumberConfig } from "./roles/plumber";

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  [electricianConfig.roleSlug]: electricianConfig,
  [plumberConfig.roleSlug]: plumberConfig,
};

export const hasModularConfig = (roleSlug: string): boolean =>
  Object.prototype.hasOwnProperty.call(ROLE_CONFIGS, roleSlug);

export const resolveConfig = (roleSlug: string): ResolvedConfig | null =>
  ROLE_CONFIGS[roleSlug] ?? null;

// Exposed for tests.
export const _internal = { ROLE_CONFIGS };
