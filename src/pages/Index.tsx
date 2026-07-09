import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { matchRoleAliases } from "@/lib/role-aliases";
import { ReviewedShowcase } from "@/components/ReviewedShowcase";


// Featured surveyed roles for the map-sheet grid. Kept small on purpose —
// this is a legend, not an index. Full list lives on /search.
const surveyedRoles: {
  name: string;
  slug: string;
  pay: string;
  demand: string;
  competition: string;
  surveyed: boolean;
}[] = [
  { name: "Electrician",         slug: "electrician",       pay: "£32–55k+", demand: "high", competition: "moderate", surveyed: true  },
  { name: "Nurse",               slug: "nurse",             pay: "£29–47k",  demand: "high", competition: "low",      surveyed: true  },
  { name: "Data analyst",        slug: "data-analyst",      pay: "£28–60k",  demand: "high", competition: "high",     surveyed: true  },
  { name: "Software developer",  slug: "software-engineer", pay: "£30–75k",  demand: "high", competition: "high",     surveyed: true  },
  { name: "Teacher",             slug: "teacher",           pay: "£30–46k",  demand: "high", competition: "moderate", surveyed: true  },
  { name: "Hairdresser",         slug: "hairdresser",       pay: "£20–40k+", demand: "high", competition: "moderate", surveyed: false },
];

const chipRoles = [
  { name: "Electrician",     slug: "electrician",       pay: "£32–55k"  },
  { name: "Nurse",           slug: "nurse",             pay: "£29–47k"  },
  { name: "Data analyst",    slug: "data-analyst",      pay: "£28–60k"  },
  { name: "Software developer", slug: "software-engineer", pay: "£30–75k" },
  { name: "Hairdresser",     slug: "hairdresser",       pay: "£20–40k+" },
];

type Suggestion = { role_name: string; role_slug: string };

// ─── Small ambient SVG helpers ─────────────────────────────────────────
const HeroContours = () => (
  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
    <svg className="w-full h-full block" viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="hsl(var(--contour))" strokeWidth="1.4" opacity="0.55">
        <path d="M-50 520 C200 470, 380 560, 640 500 S1080 430, 1260 470"/>
        <path d="M-50 460 C220 410, 420 500, 660 440 S1060 370, 1260 410"/>
        <path d="M-50 400 C240 355, 460 440, 690 385 S1050 315, 1260 350"/>
        <path d="M-50 340 C260 300, 500 380, 720 330 S1040 260, 1260 290"/>
        <path d="M600 120 C740 100, 900 150, 1020 110 S1200 60, 1300 90"/>
        <path d="M640 180 C770 160, 910 210, 1030 170 S1200 120, 1300 150"/>
        <path d="M690 240 C800 222, 930 268, 1040 230 S1200 185, 1300 210"/>
      </g>
      <path d="M60 560 C300 480, 520 430, 780 300 S1020 190, 1120 150"
        fill="none" stroke="hsl(var(--path))" strokeWidth="3.5" strokeDasharray="14 12" opacity="0.8"/>
      <path d="M1112 132 L1128 132 L1120 118 Z" fill="hsl(var(--path))" opacity="0.9"/>
    </svg>
  </div>
);

const FinalContours = () => (
  <div className="absolute inset-0 pointer-events-none opacity-50" aria-hidden="true">
    <svg className="w-full h-full block" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="hsl(var(--contour))" strokeWidth="1.4" opacity="0.5">
        <path d="M-50 320 C250 280, 500 340, 760 290 S1100 230, 1260 260"/>
        <path d="M-50 260 C270 225, 520 285, 780 235 S1090 175, 1260 205"/>
        <path d="M-50 200 C290 170, 540 230, 800 180 S1080 120, 1260 150"/>
      </g>
    </svg>
  </div>
);

// Little map-sheet vignette for surveyed / unsurveyed cards.
const SheetMap = ({ surveyed }: { surveyed: boolean }) => (
  <svg className="w-full h-full block" viewBox="0 0 260 96" preserveAspectRatio="none">
    <path d="M0 70 C60 55, 120 75, 260 40" stroke="hsl(var(--contour))" strokeWidth="1.4" fill="none"/>
    <path d="M0 50 C70 38, 140 58, 260 22" stroke="hsl(var(--contour))" strokeWidth="1.4" fill="none"/>
    {surveyed ? (
      <>
        <path d="M10 88 C90 60, 170 50, 240 16"
          stroke="hsl(var(--path))" strokeWidth="3" strokeDasharray="10 8" fill="none"/>
        <path d="M233 12 L247 12 L240 0 Z" fill="hsl(var(--path))"/>
      </>
    ) : (
      <path d="M14 84 C90 70, 180 46, 240 24"
        stroke="hsl(var(--muted-foreground))" strokeWidth="3" strokeDasharray="4 10" fill="none"/>
    )}
  </svg>
);

const LegendBest = () => (
  <svg width="86" height="30" viewBox="0 0 86 30" aria-hidden="true">
    <path d="M4 22 C24 14, 50 20, 82 8" fill="none" stroke="hsl(var(--wood))" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="82" cy="8" r="5" fill="hsl(var(--wood))"/>
  </svg>
);
const LegendWarn = () => (
  <svg width="86" height="30" viewBox="0 0 86 30" aria-hidden="true">
    <path d="M4 15 H52" fill="none" stroke="hsl(var(--danger))" strokeWidth="4" strokeDasharray="3 9" strokeLinecap="round"/>
    <line x1="60" y1="7" x2="76" y2="23" stroke="hsl(var(--danger))" strokeWidth="4" strokeLinecap="round"/>
    <line x1="76" y1="7" x2="60" y2="23" stroke="hsl(var(--danger))" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);
const LegendNext = () => (
  <svg width="86" height="30" viewBox="0 0 86 30" aria-hidden="true">
    <circle cx="12" cy="15" r="6" fill="none" stroke="hsl(var(--ink))" strokeWidth="3.5"/>
    <circle cx="42" cy="15" r="6" fill="none" stroke="hsl(var(--ink))" strokeWidth="3.5"/>
    <circle cx="72" cy="15" r="6" fill="none" stroke="hsl(var(--ink))" strokeWidth="3.5"/>
    <path d="M18 15 H36 M48 15 H66" stroke="hsl(var(--ink))" strokeWidth="3.5"/>
  </svg>
);

const Index = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const handle = setTimeout(async () => {
      const aliasMatches = matchRoleAliases(q);
      const aliasSlugs = aliasMatches.map((a) => a.slug);
      const orClauses = [`role_name.ilike.%${q}%`];
      if (aliasSlugs.length) orClauses.push(`role_slug.in.(${aliasSlugs.join(",")})`);
      const { data } = await supabase
        .from("roles")
        .select("role_name, role_slug")
        .or(orClauses.join(","))
        .not("role_slug", "like", "\\_merged\\_%")
        .not("role_slug", "like", "\\_pre\\_%")
        .limit(8);
      const seen = new Set<string>();
      const ordered: Suggestion[] = [];
      const aliasSet = new Set(aliasSlugs);
      for (const r of (data || []) as Suggestion[]) {
        if (aliasSet.has(r.role_slug) && !seen.has(r.role_slug)) { ordered.push(r); seen.add(r.role_slug); }
      }
      for (const r of (data || []) as Suggestion[]) {
        if (!seen.has(r.role_slug)) { ordered.push(r); seen.add(r.role_slug); }
      }
      setSuggestions(ordered);
    }, 120);
    return () => clearTimeout(handle);
  }, [query]);

  const goToRole = (roleSlug: string, roleName: string, source: string) => {
    trackEvent("search_submitted", { role: roleName, source });
    trackEvent("role_search_submitted", { search_query: roleName, source_page: source });
    // Always route through the results page so the flow is consistent
    // and the hub can preserve the original query in its back link.
    navigate(`/search?q=${encodeURIComponent(roleName)}`);
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
    trackEvent("role_search_submitted", { search_query: trimmed, source_page: "search_box" });
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Clear Routes — Survey the real route into a UK career</title>
        <meta
          name="description"
          content="Reality-check a UK career before you commit time or money. Clear Routes surveys the real routes into a job — including the well-advertised ones that lead nowhere — and marks your next three waypoints."
        />
      </Helmet>

      <Navbar />

      <main className="flex-1">
        {/* ─── HERO: contour field + dashed footpath ─────────────────── */}
        <section className="relative overflow-hidden border-b-2 border-ink">
          <HeroContours />
          <div className="container mx-auto px-4 md:px-8 relative py-16 md:py-24 max-w-5xl">
            <p className="font-mono text-xs tracking-[0.14em] uppercase text-muted-foreground">
              CR · Grid ref: your situation → the job
            </p>
            <h1 className="font-display font-extrabold text-[clamp(2.75rem,6.6vw,5.4rem)] leading-[1] tracking-tight mt-4 max-w-[16ch] text-foreground">
              Career advice sells you the summit. We survey the{" "}
              <span className="relative whitespace-nowrap text-primary">
                actual path.
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1 h-1"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, hsl(var(--path)) 0 14px, transparent 14px 24px)",
                  }}
                />
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl max-w-[54ch] text-foreground/85 leading-relaxed">
              Tell us your background, budget, time and postcode. We map the real routes into a
              career — including the well-advertised one that leads nowhere — and mark your next
              three waypoints.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
              className="mt-9 relative max-w-2xl"
            >
              <div
                className="flex bg-card border-2 border-ink overflow-hidden rounded-[6px]"
                style={{ boxShadow: "0 4px 0 hsl(var(--ink) / 0.15)" }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (searchError) setSearchError(null); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Which career? e.g. nurse, data analyst, electrician"
                  aria-label="Search a career"
                  className="flex-1 border-0 outline-none px-5 py-4 text-[16.5px] bg-transparent text-foreground min-w-0"
                />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground font-display font-bold text-base px-7 hover:bg-ink transition-colors"
                >
                  Survey my route
                </button>
              </div>

              {showSuggestions && query.trim().length >= 2 && (
                <div className="absolute z-20 left-0 right-0 mt-2 bg-card border-2 border-ink rounded-[6px] overflow-hidden text-left">
                  {suggestions.length > 0 ? (
                    suggestions.map((s) => (
                      <button
                        key={s.role_slug}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goToRole(s.role_slug, s.role_name, "suggestion")}
                        className="block w-full px-4 py-3 text-sm hover:bg-tint text-foreground text-left border-b border-border last:border-b-0"
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
                <p className="mt-3 font-mono text-xs text-danger">{searchError}</p>
              )}
            </form>

            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Free · about 2 minutes · no account, no sales pitch
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {chipRoles.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => goToRole(r.slug, r.name, "example_chip")}
                  className="font-mono text-[13px] border-[1.5px] border-ink rounded-full bg-card px-3.5 py-2 hover:border-primary hover:text-primary transition-colors"
                >
                  {r.name} <span className="text-muted-foreground not-italic">· {r.pay}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── LEGEND: what you'll get ───────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-8 max-w-5xl">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
              What you'll get
            </p>
            <h2 className="font-display font-extrabold text-[clamp(1.75rem,4vw,2.75rem)] mt-2.5 text-foreground">
              Every check comes back marked with three symbols.
            </h2>

            <div className="mt-8 border-2 border-ink rounded-[6px] bg-card overflow-hidden">
              <div className="font-mono text-[11.5px] tracking-[0.16em] uppercase bg-tint border-b-2 border-ink px-5 py-2.5 text-foreground">
                Legend — how to read your result
              </div>

              {[
                { sym: <LegendBest />, title: "Best route",
                  desc: "The path with the strongest odds from your situation — surveyed against how people actually got in, not how courses are marketed." },
                { sym: <LegendWarn />, title: "Route to be careful with",
                  desc: "The option most likely to waste your time or money — flagged in plain words before anyone takes payment from you." },
                { sym: <LegendNext />, title: "Matched next steps near you",
                  desc: "Three concrete waypoints — employers, courses and funding in your area worth checking once you've decided." },
              ].map((row, i, arr) => (
                <div
                  key={row.title}
                  className={`grid grid-cols-[72px_1fr] sm:grid-cols-[120px_1fr] gap-4 sm:gap-6 items-center px-5 py-5 ${
                    i < arr.length - 1 ? "border-b border-dashed border-border" : ""
                  }`}
                >
                  <div className="flex items-center justify-center">{row.sym}</div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">{row.title}</h3>
                    <p className="mt-1 text-[15.5px] text-foreground/80">{row.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PROMISES: waymarker trail ─────────────────────────────── */}
        <section className="bg-tint border-y-2 border-ink py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-8 max-w-5xl grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-10 md:gap-16 items-start">
            <h2 className="font-display font-extrabold text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.05] text-foreground">
              Built to protect your <span className="text-primary">time and money.</span>
            </h2>
            <ul className="relative list-none pl-9">
              <span
                aria-hidden="true"
                className="absolute left-[10px] top-3.5 bottom-3.5 border-l-[3px] border-dashed border-primary"
              />
              {[
                { b: "Routes judged from your actual situation",
                  p: "Background, qualifications, budget, time and postcode — not a generic personality quiz." },
                { b: "Warnings before expensive or unrealistic options",
                  p: "If a route usually fails people like you, the map says so before you set off." },
                { b: "Sponsored opportunities labelled clearly",
                  p: "If anyone paid to appear on your route, it's marked. No exceptions." },
              ].map((w) => (
                <li key={w.b} className="relative py-3.5 pl-1.5">
                  <span
                    aria-hidden="true"
                    className="absolute left-[-31px] top-5 w-4 h-4 rounded-full bg-card border-[3.5px] border-primary"
                  />
                  <b className="text-[17px] font-bold text-foreground">{w.b}</b>
                  <p className="text-[15px] text-foreground/80 mt-1">{w.p}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── SURVEYED ROLES: map-sheet cards ───────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-8 max-w-5xl">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
              Surveyed careers
            </p>
            <h2 className="font-display font-extrabold text-[clamp(1.75rem,4vw,2.75rem)] mt-2.5 text-foreground">
              Pick a sheet. See the terrain.
            </h2>

            <div className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {surveyedRoles.map((r) => (
                <Link
                  key={r.slug}
                  to={`/role/${r.slug}`}
                  onClick={() => trackEvent("search_submitted", { role: r.name, source: "surveyed_grid" })}
                  className="border-2 border-ink rounded-[6px] bg-card overflow-hidden flex flex-col transition-all hover:-translate-y-0.5"
                  style={{ transition: "transform .12s, box-shadow .12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 0 hsl(var(--ink) / 0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
                >
                  <div className="h-24 border-b-2 border-ink bg-background">
                    <SheetMap surveyed={r.surveyed} />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-display font-bold text-xl text-foreground">{r.name}</h3>
                    <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
                      {r.pay} · demand {r.demand}
                      <br />
                      competition {r.competition}
                    </p>
                    <span
                      className={
                        r.surveyed
                          ? "mt-3 self-start font-mono text-[11px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-[3px] bg-wood text-white"
                          : "mt-3 self-start font-mono text-[11px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-[3px] bg-card border-[1.5px] border-dashed border-danger text-danger"
                      }
                    >
                      {r.surveyed ? "Reality-check ready" : "General info only"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              <Link to="/search" className="underline underline-offset-4 hover:text-primary">
                Browse the full list of surveyed roles →
              </Link>
            </p>
          </div>
        </section>

        <ReviewedShowcase />

        {/* ─── FINAL CTA: trig point ─────────────────────────────────── */}

        <section className="relative overflow-hidden border-t-2 border-ink py-20 md:py-24 text-center">
          <FinalContours />
          <div className="container mx-auto px-4 md:px-8 max-w-3xl relative">
            <div
              aria-hidden="true"
              className="mx-auto mb-4"
              style={{
                width: 0,
                height: 0,
                borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent",
                borderBottom: "28px solid hsl(var(--path))",
              }}
            />
            <h2 className="font-display font-extrabold text-[clamp(2.1rem,5.6vw,4rem)] leading-[1.02] tracking-tight max-w-[18ch] mx-auto text-foreground">
              Check the route before you commit.
            </h2>
            <p className="mt-4 text-foreground/80">
              Reality-check a career in about a minute. No sign-up required.
            </p>
            <div className="mt-7 flex flex-wrap gap-3.5 justify-center">
              <button
                onClick={() => {
                  searchInputRef.current?.focus();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="font-display font-bold text-base bg-primary text-primary-foreground px-7 py-4 rounded-[4px] hover:bg-ink transition-colors"
              >
                Reality-check a career
              </button>
              <Link
                to="/search"
                className="font-display font-bold text-[15px] border-2 border-ink px-6 py-3.5 rounded-[4px] bg-card text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                Browse all roles
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
