import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { slugifyRole } from "@/lib/role";
import { matchRoleAliases, aliasLabel, type AliasMatch } from "@/lib/role-aliases";
import { trackEvent } from "@/lib/posthog";

type Match = {
  role_name: string;
  role_slug: string;
  short_description: string | null;
  salary_entry: number | null;
  salary_senior: number | null;
  salary_experienced: number | null;
  demand: string | null;
  competition_level: string | null;
  ai_impact_level: string | null;
  _alias?: AliasMatch | null;
  _tier: "exact" | "alias" | "partial" | "fuzzy";
};

const tierRank = { exact: 0, alias: 1, partial: 2, fuzzy: 3 } as const;

const fmtK = (n: number | null) => (n == null ? null : `£${Math.round(n / 1000)}K`);
const salaryRange = (r: Match): string | null => {
  const lo = r.salary_entry;
  const hi = r.salary_senior ?? r.salary_experienced;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi > lo) return `${fmtK(lo)}–${fmtK(hi)}+`;
  return fmtK(lo ?? hi);
};
const titleCase = (v: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "";

const SearchResults = () => {
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Match[]>([]);

  const querySlug = useMemo(() => slugifyRole(q), [q]);

  useEffect(() => {
    let cancelled = false;
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const qLower = q.toLowerCase();
      const term = q.replace(/[%_]/g, (m) => `\\${m}`);
      const slugTerm = querySlug.replace(/[%_]/g, (m) => `\\${m}`);
      const aliasMatches = matchRoleAliases(q);
      const aliasSlugs = aliasMatches.map((a) => a.slug);

      const orClauses = [
        `role_name.ilike.%${term}%`,
        `role_slug.ilike.%${slugTerm}%`,
      ];
      if (aliasSlugs.length) {
        orClauses.push(`role_slug.in.(${aliasSlugs.join(",")})`);
      }

      const { data } = await supabase
        .from("roles")
        .select(
          "role_name, role_slug, short_description, salary_entry, salary_experienced, salary_senior, demand, competition_level, ai_impact_level"
        )
        .or(orClauses.join(","))
        .not("role_slug", "like", "\\_merged\\_%")
        .not("role_slug", "like", "\\_pre\\_%")
        .order("role_name")
        .limit(100);

      if (cancelled) return;
      const rows = (data || []) as Match[];

      const aliasBySlug = new Map(aliasMatches.map((a) => [a.slug, a]));
      const scored: Match[] = rows.map((r) => {
        const nameLower = r.role_name.toLowerCase();
        const a = aliasBySlug.get(r.role_slug) || null;
        let tier: Match["_tier"];
        if (nameLower === qLower || r.role_slug === querySlug) tier = "exact";
        else if (a && a.tier === "exact") tier = "exact";
        else if (a && a.tier === "alias") tier = "alias";
        else if (nameLower.includes(qLower) || (querySlug && r.role_slug.includes(querySlug))) tier = "partial";
        else if (a) tier = a.tier;
        else tier = "fuzzy";
        return { ...r, _alias: a, _tier: tier };
      });

      scored.sort((x, y) => {
        const t = tierRank[x._tier] - tierRank[y._tier];
        if (t !== 0) return t;
        return x.role_name.localeCompare(y.role_name);
      });

      // Always land on the results page — no auto-redirect on exact match.
      const exact = scored.find(
        (r) =>
          r._tier === "exact" &&
          (r.role_slug === querySlug || r.role_name.toLowerCase() === qLower)
      );
      if (exact && scored.length > 1) {
        setResults([exact, ...scored.filter((r) => r.role_slug !== exact.role_slug)]);
      } else {
        setResults(scored);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q, querySlug]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{q ? `Search: ${q}` : "Search"} — Clear Routes</title>
        <meta name="description" content={`Career search results for "${q}".`} />
        <link rel="canonical" href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} />
      </Helmet>
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            {q ? <>Results for "{q}"</> : "Search"}
          </h1>

          {loading ? (
            <div className="mt-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="mt-10">
              <p className="text-muted-foreground">
                No careers matched "{q}". Try a broader term, or check spelling.
              </p>
              <Link to="/" className="mt-6 inline-block text-primary hover:underline">
                ← Back to search
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                {results.length} {results.length === 1 ? "career" : "careers"} found
              </p>
              <ul className="mt-8 space-y-3">
                {results.map((r) => {
                  const showAlias =
                    r._alias &&
                    !r.role_name.toLowerCase().includes(r._alias.matchedAlias);
                  const salary = salaryRange(r);
                  const chips = [
                    salary,
                    r.demand ? `${titleCase(r.demand)} demand` : null,
                    r.competition_level ? `${titleCase(r.competition_level)} competition` : null,
                    r.ai_impact_level ? `${titleCase(r.ai_impact_level)} AI impact` : null,
                  ].filter(Boolean) as string[];
                  return (
                    <li key={r.role_slug}>
                      <Link
                        to={`/role/${r.role_slug}`}
                        state={{ q }}
                        onClick={() =>
                          trackEvent("role_search_result_opened", {
                            role_slug: r.role_slug,
                            search_query: q,
                            source_page: "search_results",
                          })
                        }
                        className="block p-4 border-2 border-ink/80 bg-paper rounded-md hover:bg-tint transition-colors"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-display text-lg text-ink">{r.role_name}</div>
                          <div className="font-mono text-xs text-ink/60 shrink-0">View role →</div>
                        </div>
                        {showAlias && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Also called {aliasLabel(r._alias!)}
                            {r._tier === "fuzzy" ? " — closest match" : ""}
                          </div>
                        )}
                        {r.short_description && (
                          <div className="mt-1 text-sm text-ink/70 line-clamp-2">
                            {r.short_description}
                          </div>
                        )}
                        {chips.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink/60">
                            {chips.map((c) => (
                              <span key={c}>{c}</span>
                            ))}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchResults;
