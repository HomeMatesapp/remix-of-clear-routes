import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";

const exampleRoles = [
  { name: "Nurse", slug: "nurse" },
  { name: "Data Analyst", slug: "data-analyst" },
  { name: "Electrician", slug: "electrician" },
  { name: "Software Developer", slug: "software-developer" },
  { name: "Teacher", slug: "teacher" },
];

type Suggestion = { role_name: string; role_slug: string };

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("roles")
        .select("role_name, role_slug")
        .ilike("role_name", `%${q}%`)
        .limit(8);
      setSuggestions(data || []);
    }, 120);
    return () => clearTimeout(handle);
  }, [query]);

  const goToRole = (roleSlug: string, roleName: string, source: string) => {
    trackEvent("search_submitted", { role: roleName, source });
    navigate(`/role/${roleSlug}`);
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError("Enter a career to check");
      searchInputRef.current?.focus();
      return;
    }
    setSearchError(null);
    trackEvent("search_submitted", { role: trimmed, source: "search_box" });
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Clear Routes — Reality-check a career route before you commit</title>
        <meta
          name="description"
          content="Reality-check a career before you commit time or money. Clear Routes shows the best route, the route to be careful with, and matched next steps."
        />
      </Helmet>

      <Navbar />

      <main className="flex-1">
        {/* ─── Hero ───────────────────────────────────────────────────── */}
        <section className="container mx-auto px-4 pt-16 md:pt-24 pb-14 md:pb-18 max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-5">
            <Sparkles className="h-3.5 w-3.5" /> Career route reality-check
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.05] text-foreground tracking-tight">
            Find the realistic route<br />
            <span className="text-primary">into a better career.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Reality-check a career before you commit time or money. We'll look at your
            background, qualifications, budget, time, and area.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="mt-8 relative max-w-xl mx-auto"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search a career, e.g. nurse, data analyst, electrician"
                className="h-14 pl-12 pr-32 text-base rounded-xl border-border shadow-sm"
              />
              <Button type="submit" className="absolute right-2 top-2 h-10">
                Check this route
              </Button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && query.trim().length >= 2 && (
              <div className="absolute z-20 left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden text-left">
                {suggestions.length > 0 ? (
                  suggestions.map((s) => (
                    <button
                      key={s.role_slug}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        goToRole(s.role_slug, s.role_name, "suggestion")
                      }
                      className="block w-full px-4 py-3 text-sm hover:bg-muted text-foreground text-left"
                    >
                      {s.role_name}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No roles found.{" "}
                    <Link
                      to="/search"
                      className="text-primary hover:underline"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      Browse all roles
                    </Link>
                  </div>
                )}
              </div>
            )}

            {searchError && (
              <p className="mt-2 text-sm text-rose-600 text-left">
                {searchError}
              </p>
            )}
          </form>

          <div className="mt-5 flex flex-wrap gap-2 justify-center text-sm">
            {exampleRoles.map((r) => (
              <button
                key={r.slug}
                onClick={() => goToRole(r.slug, r.name, "example_chip")}
                className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-foreground text-sm transition-colors"
              >
                {r.name}
              </button>
            ))}
          </div>

          <p className="mt-8 text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
            No training-provider sales pitch. No false 12-week promises.
          </p>
        </section>

        {/* ─── Compact outcome strip ──────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto px-4 py-10 md:py-12 max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5 text-center">
              What you'll get
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-sm font-semibold text-foreground">Best route</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The path with the strongest odds from your situation.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Route to be careful with</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The option that may waste time or money.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Matched next steps near you</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Opportunities worth checking after you save a decision.
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Clear Routes gives you a route judgement, first moves, and opportunities worth checking after you save a decision.
            </p>
          </div>
        </section>

        {/* ─── Small trust section ────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-10 md:py-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
              Built to protect your time and money.
            </p>
            <ul className="space-y-3 text-sm text-foreground">
              <li className="flex gap-3 justify-center">
                <span className="text-primary">•</span>
                <span>Routes judged from your actual situation</span>
              </li>
              <li className="flex gap-3 justify-center">
                <span className="text-primary">•</span>
                <span>Warnings before expensive or unrealistic options</span>
              </li>
              <li className="flex gap-3 justify-center">
                <span className="text-primary">•</span>
                <span>Sponsored opportunities labelled clearly</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ─── Final CTA ──────────────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl text-center">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-foreground tracking-tight">
              Check the route before you commit.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Reality-check a career in about a minute. No sign-up required.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => {
                  searchInputRef.current?.focus();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Reality-check a career
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/search">Browse all roles</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
