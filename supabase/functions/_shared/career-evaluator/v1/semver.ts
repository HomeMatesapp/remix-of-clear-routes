// Minimal semantic-version parser for pack-version comparison.
// We deliberately avoid pulling a dependency into the shared runtime.

export interface Semver { major: number; minor: number; patch: number }

export const parseSemver = (input: string): Semver => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(input);
  if (!m) throw new Error(`invalid semver: "${input}"`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
};

export const compareSemver = (a: Semver, b: Semver): number => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
};

/** Returns true when `version` >= `min` under strict semantic ordering. */
export const semverGte = (version: string, min: string): boolean =>
  compareSemver(parseSemver(version), parseSemver(min)) >= 0;
