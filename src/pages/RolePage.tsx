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
import { RealityCheckCTA } from "@/components/role/RealityCheckCTA";
import { loadSessionResult } from "@/components/role/reality-check-shared";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { SupportMatches } from "@/components/role/SupportMatches";
import { ServiceLevelBadge } from "@/components/ServiceLevelBadge";
import type { RoleServiceLevel } from "@/lib/reality-check/service-levels";

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
  remote_friendly: string | null;
  degree_required: string | null;
  most_common_route: string | null;
  service_level: RoleServiceLevel | null;
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
  const [hasRealityCheckResult, setHasRealityCheckResult] = useState(false);
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
    // `user` is intentionally omitted: we re-key role_views by (user_id, role_slug)
    // and don't want auth state changes to trigger a full role re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Reflect any in-session Reality-check result so we hide redundant support cards.
  useEffect(() => {
    if (!role) return;
    setHasRealityCheckResult(!!loadSessionResult(role.role_slug));
  }, [role?.role_slug]);

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

  // Derive grounded "What people like" bullets from existing role data.
  // Each bullet is conditional on real fields — no invented claims, no fluff.
  // Labels and family-specific bullets vary so the card doesn't feel templated.
  const positives: { label: string; text: string }[] = [];
  {
    const name = role.role_name.toLowerCase();
    const employersArr = (role.key_employers || []).map((e) => e.trim()).filter(Boolean);
    const employersBlob = employersArr.join(" | ").toLowerCase();
    const route = (role.most_common_route || "").toLowerCase();

    type Family = "clinical" | "trade" | "tech" | "management" | "public_service" | "default";
    const family: Family = (() => {
      if (/\b(nurse|midwife|midwifery|doctor|gp|paramedic|therapist|radiograph|pharmacist|dentist|psycholog|social worker|carer|care worker)\b/.test(name)) return "clinical";
      if (/\b(electrician|plumber|carpenter|joiner|bricklayer|mechanic|welder|roofer|plasterer|gas engineer|hgv driver|technician|builder|tiler|painter and decorator)\b/.test(name)) return "trade";
      if (/\b(manager|director|head of|programme lead|project lead)\b/.test(name)) return "management";
      if (/\b(engineer|developer|analyst|scientist|programmer|architect|designer|devops|data|machine learning|ml)\b/.test(name)) return "tech";
      if (route.includes("apprenticeship") && (role.degree_required === "No" || !role.degree_required)) return "trade";
      if (/\bnhs|local authorit|council|government|civil service\b/.test(employersBlob)) return "public_service";
      return "default";
    })();

    // Bullet 1 — role-specific framing of the work itself, label varies by family.
    const firstLabel: Record<Family, string> = {
      clinical: "Responsibility",
      trade: "Craft",
      tech: "The problems",
      management: "Variety",
      public_service: "Public service",
      default: "The work",
    };
    if (role.short_description) {
      const s = role.short_description.split(/(?<=[.!?])\s/)[0];
      const text = s.length > 130 ? s.slice(0, 130).replace(/\s+\S*$/, "") + "…" : s;
      positives.push({ label: firstLabel[family], text });
    }

    // Bullet 2 — stability or breadth, grounded in demand + key_employers.
    const strongDemand = !!role.demand && /high|strong|growing/i.test(role.demand);
    const breadthSignal =
      employersArr.some((e) => /every sector|every industry|all sectors|all industries/i.test(e)) ||
      employersArr.length >= 5;
    const topEmployers = employersArr
      .flatMap((e) => e.split(/[,;]| — /))
      .map((e) => e.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim())
      .filter((e) => e && !/^(every sector|every industry|all sectors|all industries|data analysis is.*|not an industry\.?)$/i.test(e))
      .slice(0, 2);

    if (strongDemand && topEmployers.length) {
      const stabilityLabel =
        family === "trade" ? "Steady work" :
        family === "clinical" || family === "public_service" ? "Stability" :
        "Demand";
      positives.push({
        label: stabilityLabel,
        text: `${role.demand} demand — employers include ${topEmployers.join(" and ")}.`,
      });
    } else if (breadthSignal && topEmployers.length) {
      positives.push({
        label: "Cross-sector",
        text: `Hires across sectors — ${topEmployers.join(", ")}${employersArr.length > 2 ? " and more" : ""}.`,
      });
    } else if (strongDemand) {
      positives.push({ label: "Demand", text: `${role.demand} demand across the UK.` });
    }

    // Bullet 3 — family-specific signal, only if data supports it.
    const top = role.salary_senior ?? role.salary_experienced ?? null;
    const hasPayProgression = !!role.salary_entry && !!top && top > role.salary_entry;

    if (family === "trade") {
      if (/self[-\s]?employ/i.test(employersBlob)) {
        positives.push({
          label: "Self-employment",
          text: "Once qualified, going independent is a realistic route.",
        });
      } else if (route.includes("apprenticeship") && hasPayProgression) {
        positives.push({
          label: "Paid training",
          text: `Apprenticeship route — earn while you train, with pay reaching ${fmtK(top!)}${role.salary_senior ? "+" : ""}.`,
        });
      } else if (hasPayProgression) {
        positives.push({
          label: "Pay progression",
          text: `From ${fmtK(role.salary_entry!)} to ${fmtK(top!)}${role.salary_senior ? "+" : ""} with experience.`,
        });
      }
    } else if (family === "tech") {
      if (role.remote_friendly === "Yes" && hasPayProgression) {
        positives.push({
          label: "Pay and flexibility",
          text: `${fmtK(role.salary_entry!)} → ${fmtK(top!)}${role.salary_senior ? "+" : ""}, and remote-friendly at most employers.`,
        });
      } else if (hasPayProgression) {
        positives.push({
          label: "Pay progression",
          text: `From ${fmtK(role.salary_entry!)} to ${fmtK(top!)}${role.salary_senior ? "+" : ""} as you specialise.`,
        });
      }
    } else if (family === "clinical" || family === "public_service") {
      if (hasPayProgression) {
        positives.push({
          label: "Structured progression",
          text: `Pay bands move from ${fmtK(role.salary_entry!)} to ${fmtK(top!)}${role.salary_senior ? "+" : ""} as you progress.`,
        });
      }
    } else if (family === "management") {
      if (hasPayProgression) {
        positives.push({
          label: "Pay progression",
          text: `From ${fmtK(role.salary_entry!)} to ${fmtK(top!)}${role.salary_senior ? "+" : ""} at senior level.`,
        });
      }
    } else if (hasPayProgression) {
      positives.push({
        label: "Progression",
        text: `Pay typically grows from ${fmtK(role.salary_entry!)} to ${fmtK(top!)}${role.salary_senior ? "+" : ""}.`,
      });
    }
  }
  const positivesShown = positives.slice(0, 3);





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

        {/* Service-level badge — honest about how much of Clear Routes is
            reviewed for this role. */}
        <div className="mb-3">
          <ServiceLevelBadge level={role.service_level} />
        </div>

        {/* Reality-check this route — compact CTA links to the dedicated page.
            The full form lives at /role/:slug/reality-check. If a result already
            exists in this session, the CTA shows a compact summary instead.
            Gated by service_level: info_only roles show an honest "not reviewed yet" card. */}
        <RealityCheckCTA
          roleSlug={role.role_slug}
          roleName={role.role_name}
          serviceLevel={role.service_level}
        />

        {/* Optional: grants / bursaries / access schemes that may apply.
            Hidden once Reality-check has a session result (matches surface on the
            dedicated page). */}
        {!hasRealityCheckResult && (
          <SupportMatches roleSlug={role.role_slug} roleName={role.role_name} />
        )}


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

        {/* Balance pair: honest warnings + grounded positives */}
        {((role.reality_check || role.uncomfortable_truth || successRoutes.length > 0) || positivesShown.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {(role.reality_check || role.uncomfortable_truth || successRoutes.length > 0) && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Before you commit
                </p>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {role.reality_check && (
                    <li className="flex gap-2 items-start leading-snug">
                      <span className="text-gray-400 flex-shrink-0 mt-0.5">·</span>
                      <span><span className="font-medium text-gray-900">Reality:</span> {role.reality_check.split(/(?<=[.!?])\s/)[0]}</span>
                    </li>
                  )}
                  {(role.uncomfortable_truth || role.career_regret_risk) && (
                    <li className="flex gap-2 items-start leading-snug">
                      <span className="text-gray-400 flex-shrink-0 mt-0.5">·</span>
                      <span><span className="font-medium text-gray-900">Biggest risk:</span> {(role.uncomfortable_truth || role.career_regret_risk)!.split(/(?<=[.!?])\s/)[0]}</span>
                    </li>
                  )}
                  {successRoutes.length > 0 && (
                    <li className="flex gap-2 items-start leading-snug">
                      <span className="text-gray-400 flex-shrink-0 mt-0.5">·</span>
                      <span><span className="font-medium text-gray-900">Usually works:</span> {(() => {
                        const first = successRoutes[0].replace(/^\s*[-•]\s*/, "").trim();
                        const short = first.split(/(?<=[.!?])\s/)[0];
                        return short.length > 90 ? short.slice(0, 90).replace(/\s+\S*$/, "") + "…" : short;
                      })()}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
            {positivesShown.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  What people like about this job
                </p>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {positivesShown.map((p) => (
                    <li key={p.label} className="flex gap-2 items-start leading-snug">
                      <span className="text-gray-400 flex-shrink-0 mt-0.5">·</span>
                      <span><span className="font-medium text-gray-900">{p.label}:</span> {p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Detailed sections — collapsed by default */}
        <Accordion type="multiple" className="mb-6">
          {role.short_description && (
            <AccordionItem value="about">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                What this job is really like
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {role.short_description}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {hasSalary && (
            <AccordionItem value="salary">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                Salary and progression
                {salaryChip && <span className="ml-2 text-xs text-gray-500 font-normal">{salaryChip}</span>}
              </AccordionTrigger>
              <AccordionContent>
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
                  <p className="text-xs text-gray-400">
                    {role.salary_source && <>Source: {role.salary_source}</>}
                    {role.salary_source && role.demand_source && " · "}
                    {role.demand_source && <>Demand: {role.demand_source}</>}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {availablePathways.length > 0 && (
            <AccordionItem value="routes">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                Common routes people take
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-gray-400 mb-3">
                  These are the routes most people use. Your Reality-check result above already picks the best one for your situation.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
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
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          isActive
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        } ${!has ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {activeMeta && activeText && (
                  <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <h3 className="text-sm font-medium text-gray-900 mb-1.5">{activeMeta.label}</h3>
                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {activeText}
                    </div>
                  </div>
                )}
                {successRoutes.length > 0 && (
                  <div className="mt-3 border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <p className="text-xs font-medium text-gray-500 mb-2">What successful people actually did</p>
                    <div className="space-y-1.5">
                      {successRoutes.map((r, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 mt-0.5">
                            {i + 1}.
                          </span>
                          <p className="text-sm text-gray-700 m-0">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {(role.uncomfortable_truth || role.opportunity_cost) && (
            <AccordionItem value="truth">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                The uncomfortable truth
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {role.uncomfortable_truth && (
                    <div className="border-l-[3px] border-[#b91c1c] bg-[#fbf3f3] rounded-r-lg px-4 py-3">
                      <p className="text-sm text-gray-800 leading-relaxed m-0 whitespace-pre-line">
                        {role.uncomfortable_truth}
                      </p>
                    </div>
                  )}
                  {role.opportunity_cost && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Opportunity cost</p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line m-0">
                        {role.opportunity_cost}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {(role.who_not_for || role.career_regret_risk) && (
            <AccordionItem value="fit-risk">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                Who this may not suit
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {role.who_not_for && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Probably not a good fit if</p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line m-0">
                        {role.who_not_for}
                      </p>
                    </div>
                  )}
                  {role.career_regret_risk && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Why people leave</p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line m-0">
                        {role.career_regret_risk}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}



          {Object.keys(grouped).length > 0 && (
            <AccordionItem value="providers">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                Training and providers
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-gray-400 mb-3">Organised by route type — not ranked, not by payment.</p>
                <div className="space-y-4">
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {(altCareers.length > 0 || hasEmployers) && (
            <AccordionItem value="similar">
              <AccordionTrigger className="text-sm font-medium text-gray-900">
                Similar roles and employers
              </AccordionTrigger>
              <AccordionContent>
                {altCareers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">You may also want to explore</p>
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
                )}
                {hasEmployers && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Key employers</p>
                    <div className="flex flex-wrap gap-2">
                      {role.key_employers!.map((e) => (
                        <span
                          key={e}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-200"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {!hasRealityCheckResult && role.next_step && (
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
