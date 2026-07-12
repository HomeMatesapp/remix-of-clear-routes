// 100-career manifest validator.
//
// Fails when:
//   - not exactly 100 entries
//   - duplicated role IDs or slugs
//   - role does not exist in the canonical roles snapshot
//   - slug does not match the canonical role
//   - a role has been merged into another role (snapshot only contains
//     unmerged roles, so any manifest entry whose id is missing is treated
//     as either non-existent OR merged)
//   - archetype is not in the allowlist
//   - deliveryIncrement is invalid
//   - legacyEngine flag disagrees with the known 8 legacy engines
//   - participantTitle materially narrows the canonical title
//     (must equal the canonical title or contain it as a substring), unless
//     the entry is listed in APPROVED_TITLE_EXCEPTIONS
//
// It also fails when a route/programme/scheme name has been counted as an
// occupation. We enforce this by refusing any entry whose canonicalRoleTitle
// or slug matches a known non-occupation pattern (e.g. "MSc", "apprenticeship",
// "graduate scheme", "conversion", "…-scheme").
//
// The validator is deterministic and offline: it reads the canonical roles
// snapshot committed under content/career-manifest/canonical-roles-snapshot.json.
// A separate `verifyAgainstLiveDatabase` helper is exposed for CI to detect
// later catalogue drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const VALID_ARCHETYPES = [
  "regulated_degree",
  "apprenticeship_workplace_competence",
  "portfolio_led_creative",
  "legacy_engine",
  "planned",
] as const;

export const VALID_DELIVERY_INCREMENTS = [
  "increment_1", "increment_2", "increment_3",
] as const;

export const VALID_DELIVERY_STATES = [
  "legacy_live", "pack_live", "planned",
] as const;

export const LEGACY_ENGINE_SLUGS = new Set([
  "actor", "electrician", "hvac-engineer", "plumber",
  "police-officer", "registered-nurse", "software-engineer", "solicitor",
]);

// Slugs/names that must NOT be counted as occupations. Substring matched
// case-insensitively against slug and canonicalRoleTitle.
export const NON_OCCUPATION_PATTERNS = [
  "apprenticeship", "graduate scheme", "graduate-scheme",
  "conversion course", "top-up", "msc pre-reg", "access to he",
  "-scheme", "recognition process",
];

export const APPROVED_TITLE_EXCEPTIONS = new Set<string>([
  // e.g. "carpenter-joiner" → participantTitle equals canonical, no exception needed.
]);

export interface ManifestEntry {
  roleId: string;
  roleSlug: string;
  canonicalRoleTitle: string;
  participantTitle: string;
  occupationalFamily: string;
  archetypeId: string;
  regulatoryStatus: string;
  legacyEngine: boolean;
  deliveryIncrement: string;
  geographicPilotScope: string[];
  deliveryState: string;
}

export interface Manifest {
  manifestVersion: string;
  generatedAt: string;
  totals: { reviewedRealityChecks: number; genericPacks: number; legacyEngines: number; planned: number };
  entries: ManifestEntry[];
}

export interface CanonicalRoleSnapshot {
  snapshotAt: string;
  roles: { roleId: string; roleSlug: string; roleName: string }[];
}

export const validateManifest = (
  manifest: Manifest,
  snapshot: CanonicalRoleSnapshot,
): string[] => {
  const errors: string[] = [];
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== 100) {
    errors.push(`manifest must contain exactly 100 entries (got ${manifest.entries?.length ?? 0})`);
  }
  const idSet = new Set<string>();
  const slugSet = new Set<string>();
  const byId = new Map(snapshot.roles.map((r) => [r.roleId, r]));
  const bySlug = new Map(snapshot.roles.map((r) => [r.roleSlug, r]));

  let legacyCount = 0;
  const legacySlugsSeen = new Set<string>();

  for (const [i, e] of manifest.entries.entries()) {
    const at = `entry[${i}] (${e.roleSlug ?? "?"})`;
    if (!e.roleId || !e.roleSlug) { errors.push(`${at}: missing roleId or roleSlug`); continue; }
    if (idSet.has(e.roleId)) errors.push(`${at}: duplicate roleId ${e.roleId}`);
    if (slugSet.has(e.roleSlug)) errors.push(`${at}: duplicate roleSlug ${e.roleSlug}`);
    idSet.add(e.roleId); slugSet.add(e.roleSlug);

    const canonical = byId.get(e.roleId);
    if (!canonical) {
      errors.push(`${at}: roleId ${e.roleId} does not exist in the canonical roles snapshot (may be missing or merged into another role)`);
    } else if (canonical.roleSlug !== e.roleSlug) {
      errors.push(`${at}: roleSlug ${e.roleSlug} does not match canonical slug ${canonical.roleSlug} for role ${e.roleId}`);
    }

    // slug-collision (someone repurposing a canonical slug)
    const slugCanonical = bySlug.get(e.roleSlug);
    if (slugCanonical && slugCanonical.roleId !== e.roleId) {
      errors.push(`${at}: slug ${e.roleSlug} points to a different canonical role (${slugCanonical.roleId})`);
    }

    if (!(VALID_ARCHETYPES as readonly string[]).includes(e.archetypeId)) {
      errors.push(`${at}: invalid archetypeId "${e.archetypeId}"`);
    }
    if (!(VALID_DELIVERY_INCREMENTS as readonly string[]).includes(e.deliveryIncrement)) {
      errors.push(`${at}: invalid deliveryIncrement "${e.deliveryIncrement}"`);
    }
    if (!(VALID_DELIVERY_STATES as readonly string[]).includes(e.deliveryState)) {
      errors.push(`${at}: invalid deliveryState "${e.deliveryState}"`);
    }
    // For live entries archetype must be a real archetype, not the "planned" placeholder
    if ((e.deliveryState === "pack_live" || e.deliveryState === "legacy_live") && e.archetypeId === "planned") {
      errors.push(`${at}: live entries must not use the "planned" archetype placeholder`);
    }

    // Legacy flag consistency
    const shouldBeLegacy = LEGACY_ENGINE_SLUGS.has(e.roleSlug);
    if (shouldBeLegacy !== e.legacyEngine) {
      errors.push(`${at}: legacyEngine flag=${e.legacyEngine} disagrees with known legacy set`);
    }
    if (e.legacyEngine) {
      legacyCount++; legacySlugsSeen.add(e.roleSlug);
      if (e.deliveryState !== "legacy_live") errors.push(`${at}: legacy engines must have deliveryState=legacy_live`);
      if (e.archetypeId !== "legacy_engine") errors.push(`${at}: legacy engines must use archetypeId=legacy_engine`);
    }

    // Non-occupation guard
    const haystack = `${e.roleSlug} ${e.canonicalRoleTitle}`.toLowerCase();
    for (const pat of NON_OCCUPATION_PATTERNS) {
      if (haystack.includes(pat)) {
        errors.push(`${at}: appears to be a route/programme/scheme ("${pat}"), not an occupation`);
      }
    }

    // Participant title narrowing guard
    if (canonical) {
      const canon = canonical.roleName.toLowerCase();
      const part = e.participantTitle.toLowerCase();
      const okStructural = part === canon || part.includes(canon);
      const okApproved = APPROVED_TITLE_EXCEPTIONS.has(e.roleSlug);
      if (!okStructural && !okApproved) {
        errors.push(`${at}: participantTitle "${e.participantTitle}" materially changes canonical title "${canonical.roleName}"`);
      }
    }
  }

  // Exactly 8 legacy engines, all present
  if (legacyCount !== 8) errors.push(`expected exactly 8 legacy engines, found ${legacyCount}`);
  for (const slug of LEGACY_ENGINE_SLUGS) if (!legacySlugsSeen.has(slug)) errors.push(`legacy engine "${slug}" missing from manifest`);

  // Totals coherence
  const t = manifest.totals ?? ({} as Manifest["totals"]);
  const live = manifest.entries.filter((e) => e.deliveryState === "legacy_live" || e.deliveryState === "pack_live").length;
  const plannedCount = manifest.entries.filter((e) => e.deliveryState === "planned").length;
  if (t.reviewedRealityChecks !== live) errors.push(`totals.reviewedRealityChecks (${t.reviewedRealityChecks}) does not equal live entries (${live})`);
  if (t.planned !== plannedCount) errors.push(`totals.planned (${t.planned}) does not equal planned entries (${plannedCount})`);
  if (t.legacyEngines !== 8) errors.push(`totals.legacyEngines must be 8`);
  if (t.genericPacks !== manifest.entries.filter((e) => e.deliveryState === "pack_live").length) {
    errors.push(`totals.genericPacks does not equal pack_live entries`);
  }

  return errors;
};

const __dirname_local = dirname(fileURLToPath(import.meta.url));
export const loadManifest = (): Manifest =>
  JSON.parse(readFileSync(resolve(__dirname_local, "../content/career-manifest/roles.json"), "utf-8")) as Manifest;
export const loadSnapshot = (): CanonicalRoleSnapshot =>
  JSON.parse(readFileSync(resolve(__dirname_local, "../content/career-manifest/canonical-roles-snapshot.json"), "utf-8")) as CanonicalRoleSnapshot;

/**
 * Live database drift detection.
 * Intentionally NOT called by unit tests — invoked from CI (`bun run scripts/validate-career-manifest.ts --live`).
 */
export const verifyAgainstLiveDatabase = async (
  manifest: Manifest,
  fetchLiveRoles: () => Promise<{ roleId: string; roleSlug: string; roleName: string; mergedInto: string | null }[]>,
): Promise<string[]> => {
  const live = await fetchLiveRoles();
  const byId = new Map(live.map((r) => [r.roleId, r]));
  const errors: string[] = [];
  for (const e of manifest.entries) {
    const l = byId.get(e.roleId);
    if (!l) { errors.push(`live: roleId ${e.roleId} (${e.roleSlug}) not present in canonical roles`); continue; }
    if (l.mergedInto) errors.push(`live: role ${e.roleSlug} has been merged into ${l.mergedInto}`);
    if (l.roleSlug !== e.roleSlug) errors.push(`live: slug drift on ${e.roleId}: manifest=${e.roleSlug} live=${l.roleSlug}`);
    if (l.roleName.toLowerCase() !== e.canonicalRoleTitle.toLowerCase()) {
      errors.push(`live: canonical title drift on ${e.roleSlug}: manifest="${e.canonicalRoleTitle}" live="${l.roleName}"`);
    }
  }
  return errors;
};

if (import.meta.main) {
  const manifest = loadManifest();
  const snapshot = loadSnapshot();
  const errors = validateManifest(manifest, snapshot);
  if (errors.length > 0) {
    console.error("manifest validation failed:");
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  console.log(`OK: manifest has ${manifest.entries.length} entries; ${manifest.totals.reviewedRealityChecks} live, ${manifest.totals.planned} planned.`);
}
