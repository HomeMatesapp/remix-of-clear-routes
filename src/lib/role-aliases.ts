/**
 * Role alias map + typo-tolerant matching.
 *
 * Some roles in the database use one canonical title but users search for
 * common variants. e.g. the DB has "Software Engineer" but users type
 * "software developer", "programmer", "web developer", or even typos like
 * "sotwaree engineer" / "devloper".
 *
 * For v1 we keep one canonical page per broad role and surface it for any
 * known alias or near-typo. Specialisations (frontend, backend, data
 * engineer, etc.) can split later.
 */

export type AliasMatchTier = "exact" | "alias" | "partial" | "fuzzy";

export type AliasMatch = {
  slug: string;
  /** The alias that matched (lowercased) — useful for "Also called X" copy. */
  matchedAlias: string;
  tier: AliasMatchTier;
};

/**
 * canonical role slug → searchable alternative phrases.
 * Keep entries lowercase. The role's own name does NOT need to be listed
 * (DB ilike already covers it); aliases here are extra terms that ilike
 * on role_name would miss.
 */
export const ROLE_ALIASES: Record<string, string[]> = {
  "software-engineer": [
    "software engineer",
    "software developer",
    "software dev",
    "developer",
    "programmer",
    "coder",
    "web developer",
    "app developer",
    "frontend developer",
    "front-end developer",
    "front end developer",
    "backend developer",
    "back-end developer",
    "back end developer",
    "full stack developer",
    "fullstack developer",
    "full-stack developer",
    "mobile developer",
    "ios developer",
    "android developer",
  ],
};

// ── Levenshtein distance (small inputs, fine for client search) ──────────────
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

/**
 * Returns the best alias match per canonical slug for a free-text query.
 * Tiers: exact > alias (substring either way) > fuzzy (typo within ~25%).
 */
export function matchRoleAliases(query: string | null | undefined): AliasMatch[] {
  if (!query) return [];
  const q = norm(query);
  if (q.length < 2) return [];

  const out: AliasMatch[] = [];
  for (const [slug, aliases] of Object.entries(ROLE_ALIASES)) {
    let best: AliasMatch | null = null;
    for (const raw of aliases) {
      const a = norm(raw);
      let tier: AliasMatchTier | null = null;

      if (a === q) {
        tier = "exact";
      } else if (a.includes(q) || q.includes(a)) {
        tier = "alias";
      } else {
        // Token-level fuzzy: compare each query token against each alias token.
        const aTokens = a.split(" ");
        const qTokens = q.split(" ");
        let tokenHit = false;
        for (const qt of qTokens) {
          if (qt.length < 4) continue;
          for (const at of aTokens) {
            if (at.length < 4) continue;
            const d = levenshtein(qt, at);
            const maxLen = Math.max(qt.length, at.length);
            const threshold = maxLen >= 8 ? 2 : 1;
            if (d <= threshold) {
              tokenHit = true;
              break;
            }
          }
          if (tokenHit) break;
        }
        if (tokenHit) tier = "fuzzy";
        else {
          // Whole-string fuzzy fallback for multi-word typos
          const d = levenshtein(q, a);
          const maxLen = Math.max(q.length, a.length);
          if (maxLen >= 6 && d <= Math.max(2, Math.floor(maxLen * 0.25))) {
            tier = "fuzzy";
          }
        }
      }

      if (!tier) continue;
      const rank: Record<AliasMatchTier, number> = {
        exact: 0,
        alias: 1,
        partial: 2,
        fuzzy: 3,
      };
      if (!best || rank[tier] < rank[best.tier]) {
        best = { slug, matchedAlias: a, tier };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/** Display label for a matched alias, e.g. "Also called Software Engineer". */
export function aliasLabel(match: AliasMatch): string {
  return match.matchedAlias
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
