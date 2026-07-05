import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/posthog";
import { RoleMetricCard } from "@/components/role/RoleMetricCard";
import { RoleDecisionCard } from "@/components/role/RoleDecisionCard";

type HubRole = {
  id: string;
  role_name: string;
  role_slug: string;
  short_description: string | null;
  hub_summary: string | null;
  salary_entry: number | null;
  salary_experienced: number | null;
  salary_senior: number | null;
  demand: string | null;
  competition_level: string | null;
  ai_impact_level: string | null;
};

const fmtSalary = (n: number | null) =>
  n == null ? null : `£${Math.round(n / 1000)}K`;

const salaryRange = (r: HubRole): string | null => {
  const lo = r.salary_entry;
  const hi = r.salary_senior ?? r.salary_experienced;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi > lo) return `${fmtSalary(lo)}–${fmtSalary(hi)}+`;
  return fmtSalary(lo ?? hi);
};

type Tone = "default" | "good" | "warn" | "bad";
const levelTone = (v: string | null, invert = false): Tone => {
  if (!v) return "default";
  const s = v.toLowerCase();
  if (s.includes("high")) return invert ? "bad" : "good";
  if (s.includes("low")) return invert ? "good" : "warn";
  if (s.includes("med")) return "default";
  return "default";
};
const titleCase = (v: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "";

const RoleHub = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [role, setRole] = useState<HubRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preserve original search query for the back link
  const stateQuery = (location.state as { q?: string } | null)?.q ?? null;
  const backSearch =
    stateQuery && stateQuery.trim().length > 0
      ? `/search?q=${encodeURIComponent(stateQuery)}`
      : "/search";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from("roles")
        .select(
          "id, role_name, role_slug, short_description, hub_summary, salary_entry, salary_experienced, salary_senior, demand, competition_level, ai_impact_level"
        )
        .eq("role_slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setRole(data as HubRole | null);
      setLoading(false);
      if (data) {
        trackEvent("role_hub_viewed", {
          role_slug: (data as HubRole).role_slug,
          source_page: stateQuery ? "search_results" : "direct",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, stateQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink/50" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Helmet>
          <title>Role not found — Clear Routes</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <Navbar />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-16 max-w-2xl">
            <h1 className="font-display text-3xl text-ink">We can't find that role</h1>
            <p className="mt-3 text-ink/70">
              The link may be out of date, or the role has been merged into another. Try a fresh search.
            </p>
            <div className="mt-6 flex gap-4">
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 border-2 border-ink px-4 py-2 rounded-md hover:bg-tint"
              >
                Search all careers
              </Link>
              <Link to="/" className="inline-flex items-center gap-1.5 py-2 text-ink hover:underline">
                Back to home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const metrics: { label: string; value: string; tone: Tone }[] = [];
  const salary = salaryRange(role);
  if (salary) metrics.push({ label: "Typical salary", value: salary, tone: "default" });
  if (role.demand)
    metrics.push({ label: "Demand", value: titleCase(role.demand), tone: levelTone(role.demand) });
  if (role.competition_level)
    metrics.push({
      label: "Competition",
      value: titleCase(role.competition_level),
      tone: levelTone(role.competition_level, true),
    });
  if (role.ai_impact_level)
    metrics.push({
      label: "AI exposure",
      value: titleCase(role.ai_impact_level),
      tone: levelTone(role.ai_impact_level, true),
    });

  const path = `/role/${role.role_slug}`;
  const pageDesc =
    (role.hub_summary || role.short_description ||
    `Decide your next step for a career as a ${role.role_name}.`);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{role.role_name} — decide your route · Clear Routes</title>
        <meta name="description" content={pageDesc.slice(0, 158)} />
        <link rel="canonical" href={path} />
        <meta property="og:title" content={`${role.role_name} — Clear Routes`} />
        <meta property="og:description" content={pageDesc.slice(0, 158)} />
        <meta property="og:url" content={path} />
      </Helmet>
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <Link
            to={backSearch}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {stateQuery ? `Back to results for "${stateQuery}"` : "Back to search"}
          </Link>

          <header className="mt-4">
            <h1 className="font-display text-4xl sm:text-5xl text-ink leading-tight">
              {role.role_name}
            </h1>
            {role.short_description && (
              <p className="mt-3 text-lg text-ink/80 max-w-3xl">
                {role.short_description}
              </p>
            )}
          </header>

          {metrics.length > 0 && (
            <div
              className="mt-8 grid gap-3"
              style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
              }}
            >
              {metrics.map((m) => (
                <RoleMetricCard key={m.label} {...m} />
              ))}
            </div>
          )}

          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">
              What do you want to find out?
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="md:order-2">
                <RoleDecisionCard
                  primary
                  badge="Personalised"
                  title="Find my most realistic route"
                  description="Answer a few questions about your situation and get your strongest route, main barriers and next actions."
                  cta="Check my route · 3 min"
                  to={`${path}/reality-check`}
                  onClick={() =>
                    trackEvent("reality_check_started_from_hub", {
                      role_slug: role.role_slug,
                      source_page: "role_hub",
                    })
                  }
                />
              </div>
              <div className="md:order-1">
                <RoleDecisionCard
                  title="Would I like this job?"
                  description="See the real work, daily tasks, environment and whether it may suit you."
                  comingSoon
                />
              </div>
              <div className="md:order-3">
                <RoleDecisionCard
                  title="What should I know before committing?"
                  description="Understand the risks, training traps, trade-offs and reasons people leave."
                  comingSoon
                />
              </div>
            </div>

            <div className="mt-8">
              <Link
                to={`${path}/profile`}
                onClick={() =>
                  trackEvent("full_role_profile_opened", {
                    role_slug: role.role_slug,
                    source_page: "role_hub",
                  })
                }
                className="inline-flex items-center gap-1.5 font-medium text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink"
              >
                View full role profile →
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RoleHub;
