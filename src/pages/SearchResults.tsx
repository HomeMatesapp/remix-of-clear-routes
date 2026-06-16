import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { slugifyRole } from "@/lib/role";
import { matchRoleAliases, aliasLabel, type AliasMatch } from "@/lib/role-aliases";

type Match = {
  role_name: string;
  role_slug: string;
  short_description: string | null;
  _alias?: AliasMatch | null;
  _tier: "exact" | "alias" | "partial" | "fuzzy";
};

const tierRank = { exact: 0, alias: 1, partial: 2, fuzzy: 3 } as const;

const SearchResults = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
        .select("role_name, role_slug, short_description")
        .or(orClauses.join(","))
        .not("role_slug", "like", "\\_merged\\_%")
        .not("role_slug", "like", "\\_pre\\_%")
        .order("role_name")
        .limit(100);

      if (cancelled) return;
      const rows = (data || []) as Match[];

      // Score each row by tier
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

      // Single perfect match → straight to the role page
      const exact = scored.find(
        (r) =>
          r._tier === "exact" &&
          (r.role_slug === querySlug || r.role_name.toLowerCase() === qLower)
      );
      if (scored.length === 1) {
        navigate(`/role/${scored[0].role_slug}`, { replace: true });
        return;
      }
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
  }, [q, querySlug, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{q ? `Search: ${q}` : "Search"} — Clear Routes</title>
        <meta name="description" content={`Career search results for "${q}".`} />
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
              <ul className="mt-8 divide-y divide-border border-t border-b border-border">
                {results.map((r) => {
                  const showAlias =
                    r._alias &&
                    !r.role_name.toLowerCase().includes(r._alias.matchedAlias);
                  return (
                    <li key={r.role_slug}>
                      <Link
                        to={`/role/${r.role_slug}`}
                        className="block py-4 hover:bg-muted/50 px-2 -mx-2 rounded transition-colors"
                      >
                        <div className="font-medium text-foreground">{r.role_name}</div>
                        {showAlias && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Also called {aliasLabel(r._alias!)}
                            {r._tier === "fuzzy" ? " — closest match" : ""}
                          </div>
                        )}
                        {r.short_description && (
                          <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {r.short_description}
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
