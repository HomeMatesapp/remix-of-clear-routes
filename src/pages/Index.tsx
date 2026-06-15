import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Sparkles,
  Compass,
  LifeBuoy,
  AlertOctagon,
  MapPin,
  BookmarkPlus,
  ListChecks,
  Gavel,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { slugifyRole } from "@/lib/role";
import { trackEvent } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const submit = (role: string, source: "search_box" | "example_chip" | "suggestion") => {
    const trimmed = role.trim();
    if (!trimmed) return;
    trackEvent("search_submitted", { role: trimmed, source });
    if (source === "suggestion") {
      navigate(`/role/${slugifyRole(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Clear Routes — Reality-check a career route before you commit</title>
        <meta
          name="description"
          content="Tell us your background, budget, time, and area. Clear Routes shows the route with the best odds — plus the one to be careful with."
        />
      </Helmet>

      <Navbar />

      <main className="flex-1">
        {/* ─── Hero ───────────────────────────────────────────────────── */}
        <section className="container mx-auto px-4 pt-16 md:pt-24 pb-12 md:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Career route reality-check
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.05] text-foreground tracking-tight">
              Find the realistic route<br />
              <span className="text-primary">into a better career.</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Tell us your background, budget, time, and area. Clear Routes shows the
              route with the best odds — plus the one to be careful with.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(query, "search_box");
              }}
              className="mt-8 relative max-w-xl mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search a career, e.g. nurse, data analyst, electrician"
                  className="h-14 pl-12 pr-32 text-base rounded-xl border-border shadow-sm"
                />
                <Button type="submit" className="absolute right-2 top-2 h-10">
                  Check this route
                </Button>
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden text-left">
                  {suggestions.map((s) => (
                    <button
                      key={s.role_slug}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => submit(s.role_name, "suggestion")}
                      className="block w-full px-4 py-3 text-sm hover:bg-muted text-foreground"
                    >
                      {s.role_name}
                    </button>
                  ))}
                </div>
              )}
            </form>

            <div className="mt-5 flex flex-wrap gap-2 justify-center text-sm">
              {exampleRoles.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => submit(r.name, "example_chip")}
                  className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-foreground text-sm transition-colors"
                >
                  {r.name}
                </button>
              ))}
            </div>

            <p className="mt-8 text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
              No training-provider sales pitch. No false 12-week promises. Just the
              route that actually makes sense.
            </p>
          </div>
        </section>

        {/* ─── How it works ───────────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto px-4 py-14 md:py-20 max-w-5xl">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                How it works
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground">
                Three steps to a route judgement.
              </h2>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <StepCard
                n={1}
                title="Choose a role"
                body="Pick the career you're considering."
              />
              <StepCard
                n={2}
                title="Tell us your situation"
                body="Starting point, budget, time, earning needs, and area."
              />
              <StepCard
                n={3}
                title="Get a route judgement"
                body="Best route, backup, route to avoid, local realism, and first moves."
              />
            </ol>
          </div>
        </section>

        {/* ─── What you get ───────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-14 md:py-20 max-w-6xl">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                What you get
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground">
                A decision, not a brochure.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                icon={<Compass className="h-4 w-4" />}
                tone="emerald"
                title="Best route"
                body="The path with the strongest odds from your situation."
              />
              <FeatureCard
                icon={<LifeBuoy className="h-4 w-4" />}
                tone="sky"
                title="Backup route"
                body="A realistic alternative if the first route is blocked."
              />
              <FeatureCard
                icon={<AlertOctagon className="h-4 w-4" />}
                tone="rose"
                title="Route to be careful with"
                body="The option that may waste time or money."
              />
              <FeatureCard
                icon={<MapPin className="h-4 w-4" />}
                tone="amber"
                title="Local realism"
                body="Whether the route depends on nearby employers, colleges, or funded options."
              />
              <FeatureCard
                icon={<LifeBuoy className="h-4 w-4" />}
                tone="sky"
                title="Support that may help"
                body="Grants, bursaries, access schemes, and organisations worth checking."
              />
              <FeatureCard
                icon={<BookmarkPlus className="h-4 w-4" />}
                tone="amber"
                title="Save the decision"
                body="Keep the route check, compare careers, and return when you're ready."
              />
            </div>
          </div>
        </section>

        {/* ─── Why Clear Routes ───────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto px-4 py-14 md:py-20 max-w-4xl">
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Why Clear Routes
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground">
                Most career sites explain the job. Clear Routes judges the route.
              </h2>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto text-sm text-foreground">
              {[
                "Salary, demand, and competition — grounded in real data.",
                "Uncomfortable truths, not motivational lines.",
                "Pathways that differ by starting point.",
                "Provider and funding transparency.",
                "No generic “just do a bootcamp” advice.",
                "No training-provider sales pitch.",
              ].map((line) => (
                <li key={line} className="flex gap-2 leading-relaxed">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── Example result preview ─────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-14 md:py-20 max-w-3xl">
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Example result
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground">
                What a route judgement looks like.
              </h2>
            </div>

            {/* Mock judgement card — uses the same visual language as the
                Reality-check result on role pages. Clearly labelled as an
                example so it's not mistaken for live output. */}
            <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Gavel className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                    Your route judgement
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Example
                </span>
              </div>

              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">
                  Role: <span className="text-foreground font-medium">Data Analyst</span>
                </p>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Realistic but hard
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 text-sm">
                <PreviewRow
                  label="Best route"
                  tone="emerald"
                  value="Portfolio + entry-level analyst/admin/data role"
                />
                <PreviewRow
                  label="Be careful with"
                  tone="rose"
                  value="£5,000 bootcamp without transparent outcomes"
                />
                <PreviewRow
                  label="Local realism"
                  tone="amber"
                  value="Mixed — depends on junior roles within commuting range"
                />
                <PreviewRow
                  label="First move"
                  tone="sky"
                  value="Build one practical project using public UK data"
                />
              </dl>
            </div>
          </div>
        </section>

        {/* ─── Decision workspace ─────────────────────────────────────── */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto px-4 py-14 md:py-20 max-w-3xl text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-4">
              <ListChecks className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground">
              Save the decisions you're making.
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-xl mx-auto">
              After a route check, save the result to My Career Decisions. Keep track
              of the careers you're considering, your best route, and the next move.
            </p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to={user ? "/my-decisions" : "/signup?redirect=/my-decisions"}>
                  {user ? "View My Career Decisions" : "Create a free account"}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ──────────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-16 md:py-24 max-w-3xl text-center">
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
                  document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {n}
      </span>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </li>
  );
}

const featureToneRing: Record<string, string> = {
  emerald: "border-emerald-200",
  sky: "border-sky-200",
  rose: "border-rose-200",
  amber: "border-amber-200",
};
const featureToneIcon: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700",
};

function FeatureCard({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "rose" | "amber";
  title: string;
  body: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${featureToneRing[tone]}`}>
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${featureToneIcon[tone]}`}
      >
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

const previewLabelTone: Record<string, string> = {
  emerald: "text-emerald-700",
  sky: "text-sky-700",
  rose: "text-rose-700",
  amber: "text-amber-700",
};

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  return (
    <div className="flex flex-col">
      <dt
        className={`text-[10px] font-semibold uppercase tracking-wider ${previewLabelTone[tone]}`}
      >
        {label}
      </dt>
      <dd className="text-sm text-foreground leading-snug mt-0.5">{value}</dd>
    </div>
  );
}

export default Index;
