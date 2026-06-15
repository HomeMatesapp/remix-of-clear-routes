import { ReactNode, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/posthog";
import { deslugifyRole } from "@/lib/role";
import { usePersonalisation, recommendedPathway, personalisationBanner } from "@/hooks/usePersonalisation";
import { useAuth } from "@/hooks/useAuth";
import { ratingPillClass } from "@/lib/ratingTone";
import { RealityCheckRoute } from "@/components/role/RealityCheckRoute";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type PathwayKey = "school_leaver" | "graduate" | "adjacent" | "no_background";

type Role = {
  id: string;
  role_name: string;
  role_slug: string;
  short_description: string | null;
  reality_rating: string | null;
  pathway_school_leaver: string | null;
  pathway_graduate: string | null;
  pathway_adjacent: string | null;
  pathway_no_background: string | null;
  reality_check: string | null;
  uncomfortable_truth: string | null;
  opportunity_cost: string | null;
  typical_backgrounds: string | null;
  who_not_for: string | null;
  career_regret_risk: string | null;
  alternative_careers: string | null;
  next_step: string | null;
  next_step_url: string | null;
  key_employers: string[] | null;
  salary_entry: number | null;
  salary_experienced: number | null;
  salary_senior: number | null;
  salary_source: string | null;
  demand: string | null;
  demand_source: string | null;
  competition_level: string | null;
  ai_impact_level: string | null;
  ai_impact_note: string | null;
};

type Provider = {
  id: string;
  name: string;
  who_its_for: string | null;
  publishes_outcomes: boolean | null;
  publishes_note: string | null;
  clear_routes_note: string | null;
  website: string | null;
  apply_url: string | null;
  tier: string | null;
  lead_capture_enabled: boolean | null;
};

type ProviderRow = Provider & { pathway_type: string };

const pathwayMeta: { key: PathwayKey; emoji: string; label: string }[] = [
  { key: "school_leaver",  emoji: "🎓", label: "Choosing A-levels or finishing school" },
  { key: "graduate",       emoji: "🔄", label: "Graduate, different subject" },
  { key: "adjacent",       emoji: "💻", label: "Already in a related field" },
  { key: "no_background",  emoji: "🚫", label: "No technical background" },
];

const pathwayTypeFor: Record<PathwayKey, string[]> = {
  school_leaver:  ["university", "apprenticeship", "all"],
  graduate:       ["university", "career_changer", "all"],
  adjacent:       ["career_changer", "free_funded", "self_study", "all"],
  no_background:  ["free_funded", "apprenticeship", "self_study", "all"],
};

const groupLabels: Record<string, string> = {
  university:      "University Route",
  career_changer:  "Career Changer Route",
  free_funded:     "Free / Funded Route",
  apprenticeship:  "Apprenticeship Route",
  self_study:      "Self-Study Route",
};

// ── PRESENTATIONAL HELPERS ────────────────────────────────────────────────────

export function Course({
  title,
  detail,
  link,
  links,
}: {
  title: string;
  detail: string;
  link?: string;
  links?: { label: string; url: string }[];
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-2">
      <p className="text-sm font-medium text-gray-800 mb-0.5">{title}</p>
      <p className="text-sm text-gray-500 m-0">{detail}</p>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-xs text-primary mt-1 inline-block">
          Visit →
        </a>
      )}
      {links && (
        <div className="flex gap-3 mt-1">
          {links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary">
              {l.label} →
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-3 mb-2 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
        {n}
      </span>
      <p className="text-sm text-gray-600 leading-relaxed m-0">{text}</p>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">{children}</p>
  );
}

export function Divider() {
  return <hr className="border-gray-100 my-5" />;
}

// ── UTIL ──────────────────────────────────────────────────────────────────────

const fmtK = (n: number) => (n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`);

const salaryRangeChip = (entry: number | null, senior: number | null, exp: number | null) => {
  const low = entry ?? exp;
  const high = senior ?? exp;
  if (!low && !high) return null;
  if (low && high && low !== high) return `${fmtK(low)}–${fmtK(high)}+`;
  return fmtK((low ?? high) as number);
};

const fmtSalary = (n: number | null) => (n == null ? "—" : fmtK(n));

// Rating tone colours live in src/lib/ratingTone.ts (central, extensible).

// ── PAGE ──────────────────────────────────────────────────────────────────────

const RolePage = () => {
  const { slug = "" } = useParams();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [altCareers, setAltCareers] = useState<{ name: string; slug: string }[]>([]);
  const [suggestions, setSuggestions] = useState<{ role_name: string; role_slug: string }[]>([]);
  const [activePathway, setActivePathway] = useState<PathwayKey>("adjacent");
  const { profile, isPersonalised } = usePersonalisation();
  const { user } = useAuth();
  const [personalisationApplied, setPersonalisationApplied] = useState(false);
  const [personalisationDismissed, setPersonalisationDismissed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem("cr_personalisation_dismissed") === "1";
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("roles")
        .select("*")
        .eq("role_slug", slug)
        .maybeSingle();

      if (cancelled) return;
      const roleRow = r as Role | null;
      setRole(roleRow);

      if (roleRow) {
        const order: PathwayKey[] = ["adjacent", "graduate", "school_leaver", "no_background"];
        const map = {
          school_leaver: roleRow.pathway_school_leaver,
          graduate: roleRow.pathway_graduate,
          adjacent: roleRow.pathway_adjacent,
          no_background: roleRow.pathway_no_background,
        } as const;
        const first = order.find((k) => !!map[k]);
        if (first) setActivePathway(first);

        trackEvent("role_page_viewed", { role: roleRow.role_name, slug: roleRow.role_slug });

        if (user) {
          supabase
            .from("role_views")
            .upsert(
              { user_id: user.id, role_slug: roleRow.role_slug, role_name: roleRow.role_name, viewed_at: new Date().toISOString() },
              { onConflict: "user_id,role_slug" }
            )
            .then(() => {});
        }

        const { data: pp } = await supabase
          .from("provider_pathways")
          .select("pathway_type, priority, providers(id, name, who_its_for, publishes_outcomes, publishes_note, clear_routes_note, website, apply_url, tier, lead_capture_enabled)")
          .eq("role_id", roleRow.id);

        if (!cancelled && pp) {
          const rows: ProviderRow[] = [];
          for (const row of pp as Array<{ pathway_type: string; priority: number | null; providers: Provider | Provider[] | null }>) {
            const prov = Array.isArray(row.providers) ? row.providers[0] : row.providers;
            if (prov) rows.push({ ...prov, pathway_type: row.pathway_type });
          }
          setProviders(rows);
        }

        const { data: alts } = await supabase
          .from("alternative_careers")
          .select("to_role:roles!alternative_careers_to_role_id_fkey(role_name, role_slug)")
          .eq("from_role_id", roleRow.id);
        if (!cancelled && alts) {
          const mapped: { name: string; slug: string }[] = [];
          for (const row of alts as Array<{ to_role: { role_name: string; role_slug: string } | { role_name: string; role_slug: string }[] | null }>) {
            const t = Array.isArray(row.to_role) ? row.to_role[0] : row.to_role;
            if (t?.role_slug) mapped.push({ name: t.role_name, slug: t.role_slug });
          }
          setAltCareers(mapped);
        }
      } else {
        const guess = deslugifyRole(slug).split(" ")[0] || slug;
        const { data: sug } = await supabase
          .from("roles")
          .select("role_name, role_slug")
          .ilike("role_name", `%${guess}%`)
          .limit(5);
        if (!cancelled) setSuggestions(sug || []);
      }

      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!role || !isPersonalised || personalisationApplied) return;
    const rec = recommendedPathway(profile, {
      school_leaver: role.pathway_school_leaver,
      graduate: role.pathway_graduate,
      adjacent: role.pathway_adjacent,
      no_background: role.pathway_no_background,
    });
    if (rec) {
      setActivePathway(rec as PathwayKey);
      setPersonalisationApplied(true);
      trackEvent("pathway_auto_selected", { role: role.role_name, pathway: rec });
    }
  }, [role, isPersonalised, profile, personalisationApplied]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-20 max-w-2xl">
          <h1 className="font-display text-3xl font-medium text-foreground">
            We don't have "{deslugifyRole(slug)}" yet.
          </h1>
          <p className="mt-4 text-muted-foreground">Try searching for something similar:</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Link
                key={s.role_slug}
                to={`/role/${s.role_slug}`}
                className="px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-sm text-foreground"
              >
                {s.role_name}
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link to="/">Search again</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const pathwayContent: Record<PathwayKey, string | null> = {
    school_leaver: role.pathway_school_leaver,
    graduate: role.pathway_graduate,
    adjacent: role.pathway_adjacent,
    no_background: role.pathway_no_background,
  };
  const availablePathways = pathwayMeta.filter((p) => !!pathwayContent[p.key]);
  const activeMeta = pathwayMeta.find((p) => p.key === activePathway);
  const activeText = pathwayContent[activePathway];

  // Providers grouped by pathway type, capped at 8 total
  const relevantTypes = new Set(pathwayTypeFor[activePathway]);
  const filtered = providers.filter((p) => relevantTypes.has(p.pathway_type)).slice(0, 8);
  const grouped: Record<string, ProviderRow[]> = {};
  for (const p of filtered) (grouped[p.pathway_type] ||= []).push(p);

  const salaryChip = salaryRangeChip(role.salary_entry, role.salary_senior, role.salary_experienced);
  const hasSalary = !!(role.salary_entry || role.salary_experienced || role.salary_senior);
  const hasEmployers = (role.key_employers?.length ?? 0) > 0;

  // Parse "What successful people actually did" lines into routes
  const successRoutes = role.typical_backgrounds
    ? role.typical_backgrounds
        .split(/\n+/)
        .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
        .filter(Boolean)
    : [];



  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{role.role_name} — Honest career guide | Clear Routes</title>
        <meta
          name="description"
          content={`The honest picture on becoming a ${role.role_name} in the UK. Salary, realistic routes, and what most career sites won't tell you.`}
        />
        <meta property="og:title" content={`${role.role_name} | Clear Routes`} />
        {role.reality_check && <meta property="og:description" content={role.reality_check.split(".")[0]} />}
      </Helmet>

      <Navbar />

      <main className="max-w-2xl w-full mx-auto px-4 py-8 font-sans">
        {/* Header */}
        <h1 className="text-2xl font-medium text-gray-900 mb-1">{role.role_name}</h1>
        {role.reality_rating && (
          <p className="text-sm text-gray-500 italic mb-3">{role.reality_rating}</p>
        )}

        {/* Badges — colour encodes meaning via central ratingTone helper */}
        <div className="flex flex-wrap gap-2 mb-6">
          {role.demand && (
            <span className={ratingPillClass("demand", role.demand)}>
              Demand: {role.demand}
            </span>
          )}
          {role.competition_level && (
            <span className={ratingPillClass("competition", role.competition_level)}>
              Competition: {role.competition_level}
            </span>
          )}
          {salaryChip && (
            <span className="inline-flex items-center rounded-full text-xs font-medium px-3.5 py-[7px] bg-primary/10 text-primary">
              {salaryChip}
            </span>
          )}
          {role.ai_impact_level && (
            <span className={ratingPillClass("ai_risk", role.ai_impact_level)}>
              AI automation risk: {role.ai_impact_level}
            </span>
          )}
        </div>

        {/* Reality-check this route — interactive AI module (remix experiment) */}
        <RealityCheckRoute role={{ ...role, id: role.id, role_slug: role.role_slug }} />

        {/* Personalisation banner */}
        {isPersonalised && personalisationBanner(profile, role.role_name) && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">
              Personalised for you
            </p>
            <p className="text-sm text-primary leading-relaxed">
              {personalisationBanner(profile, role.role_name)}
            </p>
          </div>
        )}

        {/* Description */}
        {role.short_description && (
          <>
            <SectionLabel>What this job involves</SectionLabel>
            <p className="text-sm text-gray-600 leading-relaxed mb-6 whitespace-pre-line">
              {role.short_description}
            </p>
          </>
        )}

        {availablePathways.length > 0 && (
          <>
            <Divider />

            {/* Pathway cards */}
            <SectionLabel>Routes by starting point</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
              {pathwayMeta.map((p) => {
                const has = !!pathwayContent[p.key];
                const isActive = activePathway === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      if (!has) return;
                      setActivePathway(p.key);
                      trackEvent("pathway_card_clicked", { role: role.role_name, pathway: p.key });
                    }}
                    disabled={!has}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-primary border-2 bg-primary/5"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${!has ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-lg block mb-1">{p.emoji}</span>
                    <span className={`text-xs font-medium leading-tight block ${
                      isActive ? "text-primary" : "text-gray-700"
                    }`}>
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active pathway content */}
            {activeMeta && activeText && (
              <div className="border border-gray-200 rounded-xl p-5 bg-white mb-6">
                <h2 className="text-base font-medium text-gray-900 mb-3">
                  {activeMeta.label}
                </h2>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {activeText}
                </div>
              </div>
            )}

            {/* Before you commit */}
            {role.reality_check && (
              <div className="bg-amber-50 rounded-xl p-4 mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-700 mb-2">
                  Before you commit
                </p>
                <p className="text-sm text-amber-900 leading-relaxed m-0 whitespace-pre-line">
                  {role.reality_check}
                </p>
              </div>
            )}
          </>
        )}

        {hasSalary && (
          <>
            <Divider />

            {/* Salary */}
            <SectionLabel>Salary</SectionLabel>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Entry</p>
                <p className="text-base font-medium text-gray-900">{fmtSalary(role.salary_entry)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Experienced</p>
                <p className="text-base font-medium text-gray-900">{fmtSalary(role.salary_experienced)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Senior / Lead</p>
                <p className="text-base font-medium text-gray-900">
                  {role.salary_senior ? `${fmtK(role.salary_senior)}+` : "—"}
                </p>
              </div>
            </div>
            {(role.salary_source || role.demand_source) && (
              <p className="text-xs text-gray-400 mb-6">
                {role.salary_source && <>Source: {role.salary_source}</>}
                {role.salary_source && role.demand_source && " · "}
                {role.demand_source && <>Demand: {role.demand_source}</>}
              </p>
            )}
          </>
        )}

        {role.opportunity_cost && (
          <>
            <SectionLabel>Opportunity cost</SectionLabel>
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600 leading-relaxed m-0 whitespace-pre-line">
                {role.opportunity_cost}
              </p>
            </div>
          </>
        )}

        {successRoutes.length > 0 && (
          <>
            <SectionLabel>What successful people actually did</SectionLabel>
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <div className="space-y-2">
                {successRoutes.map((r, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 text-xs font-medium text-gray-400 mt-0.5">
                      Route {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 font-medium m-0">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Old personalisation CTA removed — Reality-check module is now the primary personalisation funnel. */}

        {Object.keys(grouped).length > 0 && (
          <>
            <SectionLabel>Relevant providers</SectionLabel>
            <p className="text-xs text-gray-400 mb-4">Organised by route type — not ranked, not by payment.</p>
            <div className="mb-6 space-y-4">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="text-xs font-medium text-gray-500 mb-2">{groupLabels[type] || type}</p>
                  <div className="space-y-2">
                    {items.map((p) => {
                      const href = p.apply_url || p.website;
                      const outcome = p.publishes_outcomes && p.publishes_note
                        ? `Publishes: ${p.publishes_note}`
                        : "Outcomes not published — ask before enrolling.";
                      return (
                        <div key={p.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{p.name}</p>
                              {p.who_its_for && <p className="text-xs text-gray-500">{p.who_its_for}</p>}
                              <p className="text-xs text-gray-400 mt-0.5">{outcome}</p>
                            </div>
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => trackEvent("provider_link_clicked", { role: role.role_name, provider: p.name })}
                                className="text-xs text-primary whitespace-nowrap flex-shrink-0 mt-1"
                              >
                                Visit website →
                              </a>
                            )}
                          </div>
                          {p.lead_capture_enabled && (
                            <button
                              type="button"
                              className="mt-3 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Request Information
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {role.uncomfortable_truth && (
          <>
            <Divider />
            <div className="border-l-[3px] border-[#b91c1c] bg-[#fbf3f3] rounded-r-lg px-5 py-4 mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b91c1c] mb-2">
                The uncomfortable truth
              </p>
              <p className="text-sm text-gray-800 leading-relaxed m-0 whitespace-pre-line">
                {role.uncomfortable_truth}
              </p>
            </div>
          </>
        )}

        {(role.who_not_for || role.career_regret_risk) && (
          <>
            <SectionLabel>Is this right for you?</SectionLabel>
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              {role.who_not_for && (
                <>
                  <p className="text-xs font-medium text-gray-400 mb-2">Probably not a good fit if</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-0 whitespace-pre-line">
                    {role.who_not_for}
                  </p>
                </>
              )}
              {role.who_not_for && role.career_regret_risk && (
                <hr className="border-gray-100 my-3" />
              )}
              {role.career_regret_risk && (
                <>
                  <p className="text-xs font-medium text-gray-400 mb-2">Why people leave</p>
                  <p className="text-sm text-gray-600 leading-relaxed m-0 whitespace-pre-line">
                    {role.career_regret_risk}
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {altCareers.length > 0 && (
          <>
            <SectionLabel>If this isn't right for you</SectionLabel>
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-500 mb-3">You may also want to explore:</p>
              <div className="flex flex-wrap gap-2">
                {altCareers.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/role/${c.slug}`}
                    className="text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-700 hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    {c.name} →
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {hasEmployers && (
          <>
            <SectionLabel>Key employers</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-6">
              {role.key_employers!.map((e) => (
                <span
                  key={e}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-200"
                >
                  {e}
                </span>
              ))}
            </div>
          </>
        )}

        {role.next_step && (
          <div className="bg-gray-900 rounded-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
              Your next step
            </p>
            <p className="text-sm text-white leading-relaxed mb-4 whitespace-pre-line">
              {role.next_step}
            </p>
            {role.next_step_url && (
              <a
                href={role.next_step_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-medium bg-white text-gray-900 px-4 py-2 rounded-lg"
              >
                Get started →
              </a>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default RolePage;
