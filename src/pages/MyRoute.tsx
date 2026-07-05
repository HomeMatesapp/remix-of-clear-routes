import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, RefreshCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { flushPendingDecision } from "@/lib/saved-decisions";
import { trackEvent } from "@/lib/posthog";
import { READINESS_LABEL, type Readiness } from "@/lib/reality-check/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionStatus = "not_started" | "in_progress" | "completed";

interface RouteAction {
  id: string;
  title: string;
  status: ActionStatus;
  source: "reality_check" | "user_added";
  completedAt?: string;
}

interface SavedRow {
  id: string;
  role_id: string | null;
  role_slug: string;
  role_name: string;
  overall_verdict: string | null;
  best_route_title: string | null;
  first_move: string | null;
  input_snapshot: Record<string, unknown> | null;
  result_snapshot: Record<string, unknown> | null;
  route_actions: RouteAction[] | null;
  created_at: string;
}

interface AlternativeRole {
  slug: string;
  name: string;
  reason: string | null;
  salary_entry: number | null;
  salary_experienced: number | null;
  demand: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

const VALID_READINESS: Readiness[] = ["ready_now", "nearly_ready", "needs_bridging", "high_risk_now"];

const readinessFrom = (row: SavedRow): { state: Readiness; label: string; reason: string } => {
  const snap = row.result_snapshot ?? {};
  const rawReadiness = typeof snap.readiness === "string" ? (snap.readiness as Readiness) : null;
  const state: Readiness = rawReadiness && VALID_READINESS.includes(rawReadiness)
    ? rawReadiness
    : verdictToReadiness(row.overall_verdict);
  const reason = typeof snap.readinessReason === "string" ? snap.readinessReason : "";
  return { state, label: READINESS_LABEL[state], reason };
};

const verdictToReadiness = (v: string | null): Readiness => {
  if (!v) return "nearly_ready";
  const s = v.toLowerCase();
  if (s.includes("probably not")) return "high_risk_now";
  if (s.includes("long shot")) return "needs_bridging";
  if (s.includes("hard")) return "nearly_ready";
  return "ready_now";
};

const seedActionsFromResult = (row: SavedRow): RouteAction[] => {
  const snap = row.result_snapshot ?? {};
  const moves = Array.isArray(snap.firstMoves) ? (snap.firstMoves as unknown[]) : [];
  const seeded = moves
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map((title, i) => ({
      id: `rc-${i}`,
      title,
      status: "not_started" as ActionStatus,
      source: "reality_check" as const,
    }));
  if (seeded.length > 0) return seeded;
  if (row.first_move) {
    return [{ id: "rc-0", title: row.first_move, status: "not_started", source: "reality_check" }];
  }
  return [];
};

const nextStatus = (s: ActionStatus): ActionStatus =>
  s === "not_started" ? "in_progress" : s === "in_progress" ? "completed" : "not_started";

const statusLabel: Record<ActionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const statusStyles: Record<ActionStatus, string> = {
  not_started: "border-border bg-background text-muted-foreground",
  in_progress: "border-primary/40 bg-primary/5 text-primary",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-800 line-through decoration-emerald-500/40",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyRoute = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<SavedRow[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeRole[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login?redirect=/my-route");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const flushed = await flushPendingDecision(user.id);
      if (flushed && !cancelled) {
        toast({ title: "Saved to My Route", description: "Your Reality Check is now your active route." });
      }

      const { data: dRows } = await supabase
        .from("saved_decisions")
        .select(
          "id, role_id, role_slug, role_name, overall_verdict, best_route_title, first_move, input_snapshot, result_snapshot, route_actions, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const rows = ((dRows ?? []) as unknown as SavedRow[]) ?? [];
      if (cancelled) return;
      setDecisions(rows);
      const active = rows[0] ?? null;
      setActiveId(active?.id ?? null);

      // Ensure the active row has route_actions seeded from the saved result.
      if (active && (!active.route_actions || active.route_actions.length === 0)) {
        const seeded = seedActionsFromResult(active);
        if (seeded.length > 0) {
          await supabase
            .from("saved_decisions")
            .update({ route_actions: seeded as never })
            .eq("id", active.id)
            .eq("user_id", user.id);
          if (!cancelled) {
            setDecisions((prev) =>
              prev.map((r) => (r.id === active.id ? { ...r, route_actions: seeded } : r)),
            );
          }
        }
      }

      // Alternative roles: use alternative_careers when the active role has an id.
      if (active?.role_id) {
        const { data: altRows } = await supabase
          .from("alternative_careers")
          .select("reason, roles:to_role_id(role_slug, role_name, salary_entry, salary_experienced, demand)")
          .eq("from_role_id", active.role_id)
          .limit(4);
        const alts: AlternativeRole[] = ((altRows ?? []) as unknown as Array<{
          reason: string | null;
          roles: {
            role_slug: string;
            role_name: string;
            salary_entry: number | null;
            salary_experienced: number | null;
            demand: string | null;
          } | null;
        }>)
          .filter((r) => r.roles)
          .map((r) => ({
            slug: r.roles!.role_slug,
            name: r.roles!.role_name,
            reason: r.reason,
            salary_entry: r.roles!.salary_entry,
            salary_experienced: r.roles!.salary_experienced,
            demand: r.roles!.demand,
          }));
        if (!cancelled) setAlternatives(alts);
      }

      if (!cancelled) {
        setLoading(false);
        if (active) {
          trackEvent("my_route_viewed", {
            role_slug: active.role_slug,
            readiness_state: readinessFrom(active).state,
            assessment_age_days: Math.floor(
              (Date.now() - new Date(active.created_at).getTime()) / 86400000,
            ),
          });
        } else {
          trackEvent("my_route_viewed", { role_slug: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate, toast]);

  const active = useMemo(
    () => decisions.find((d) => d.id === activeId) ?? decisions[0] ?? null,
    [decisions, activeId],
  );

  const cycleStatus = async (actionId: string) => {
    if (!user || !active) return;
    const current = active.route_actions ?? [];
    const updated = current.map((a) =>
      a.id === actionId
        ? {
            ...a,
            status: nextStatus(a.status),
            completedAt: nextStatus(a.status) === "completed" ? new Date().toISOString() : undefined,
          }
        : a,
    );
    setDecisions((prev) =>
      prev.map((r) => (r.id === active.id ? { ...r, route_actions: updated } : r)),
    );
    setSaving(true);
    const { error } = await supabase
      .from("saved_decisions")
      .update({ route_actions: updated as never })
      .eq("id", active.id)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save action status", description: error.message, variant: "destructive" });
    } else {
      const changed = updated.find((a) => a.id === actionId);
      if (changed) {
        trackEvent("route_action_status_changed", {
          role_slug: active.role_slug,
          action_status: changed.status,
        });
      }
    }
  };

  const openReassess = () => {
    if (!active) return;
    trackEvent("route_reassessment_started", { role_slug: active.role_slug, source_page: "my_route" });
    navigate(`/role/${active.role_slug}/reality-check`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>My Route — Clear Routes</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-5xl">
        <header className="mb-8 border-b-2 border-foreground/90 pb-6">
          <h1 className="font-display text-3xl font-medium text-foreground">My Route</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Your saved career route and the next steps to move forward.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : !active ? (
          <EmptyState />
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
              <RecommendedRouteCard row={active} />
              <ReadinessCard
                row={active}
                onCycle={cycleStatus}
                saving={saving}
                onOpenRoute={() =>
                  trackEvent("recommended_route_opened", { role_slug: active.role_slug })
                }
              />
            </section>

            <OtherRolesSection
              alternatives={alternatives}
              onOpen={(slug) =>
                trackEvent("alternative_role_opened", { role_slug: slug, source_page: "my_route" })
              }
            />

            <ReassessSection onReassess={openReassess} />

            {decisions.length > 1 && (
              <p className="mt-8 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() =>
                    trackEvent("previous_assessments_opened", { role_slug: active.role_slug })
                  }
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  You have {decisions.length} saved assessments — most recent shown above.
                </button>
              </p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const RecommendedRouteCard = ({ row }: { row: SavedRow }) => (
  <article className="md:col-span-2 rounded-2xl border-2 border-foreground/90 bg-card p-6 flex flex-col">
    <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
      Your recommended route
    </p>
    <h2 className="font-display text-2xl font-medium text-foreground leading-tight">
      {row.role_name}
    </h2>
    {row.best_route_title && (
      <p className="mt-3 text-base text-foreground font-medium">{row.best_route_title}</p>
    )}
    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
      This route best matches the qualifications, situation and location you described in your Reality Check.
    </p>
    <p className="mt-4 text-xs text-muted-foreground font-mono">
      Assessed {formatDate(row.created_at)}
    </p>
    <div className="mt-auto pt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <Link
        to={`/role/${row.role_slug}/reality-check`}
        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
      >
        View full result <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      <Link
        to={`/role/${row.role_slug}`}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        Role hub <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  </article>
);

const ReadinessCard = ({
  row,
  onCycle,
  saving,
  onOpenRoute,
}: {
  row: SavedRow;
  onCycle: (id: string) => void;
  saving: boolean;
  onOpenRoute: () => void;
}) => {
  const { state, label, reason } = readinessFrom(row);
  const actions = row.route_actions ?? [];
  const done = actions.filter((a) => a.status === "completed").length;

  return (
    <article className="md:col-span-3 rounded-2xl border-2 border-foreground/90 bg-card p-6 flex flex-col">
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        My readiness
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-display text-2xl font-medium text-foreground">{label}</h2>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {state.replace(/_/g, " ")}
        </span>
      </div>
      {reason && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{reason}</p>}

      {actions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No next actions were saved with this assessment. Run the Reality Check again to create
          an updated plan.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground font-mono uppercase tracking-wider">
            <span>Next steps</span>
            <span>
              {done} of {actions.length} completed{saving && " · saving…"}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {actions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onCycle(a.id)}
                  className="w-full text-left flex items-start gap-3 rounded-lg border border-border bg-background p-3 hover:border-foreground/60 transition-colors"
                >
                  <span
                    className={`shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${statusStyles[a.status]}`}
                  >
                    {statusLabel[a.status]}
                  </span>
                  <span
                    className={`text-sm leading-snug ${a.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {a.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Tap a step to cycle its status: not started → in progress → completed.
          </p>
        </>
      )}

      <div className="mt-auto pt-5">
        <Button asChild variant="outline" size="sm" onClick={onOpenRoute}>
          <Link to={`/role/${row.role_slug}/reality-check`}>Open full result</Link>
        </Button>
      </div>
    </article>
  );
};

const OtherRolesSection = ({
  alternatives,
  onOpen,
}: {
  alternatives: AlternativeRole[];
  onOpen: (slug: string) => void;
}) => {
  if (alternatives.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl font-medium text-foreground mb-4">Other roles to consider</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {alternatives.slice(0, 4).map((r) => (
          <li key={r.slug}>
            <Link
              to={`/role/${r.slug}`}
              onClick={() => onOpen(r.slug)}
              className="block rounded-2xl border border-border bg-card p-5 hover:border-foreground/60 transition-colors h-full"
            >
              <h3 className="font-display text-lg text-foreground">{r.name}</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                {r.salary_entry && r.salary_experienced && (
                  <span>
                    £{Math.round(r.salary_entry / 1000)}k – £{Math.round(r.salary_experienced / 1000)}k
                  </span>
                )}
                {r.demand && <span>{r.demand}</span>}
              </div>
              {r.reason && <p className="mt-3 text-sm text-muted-foreground leading-snug">{r.reason}</p>}
              <p className="mt-4 text-sm text-primary font-medium inline-flex items-center gap-1">
                View role <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const ReassessSection = ({ onReassess }: { onReassess: () => void }) => (
  <section className="rounded-2xl border-2 border-foreground/90 bg-muted/40 p-6">
    <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
      Has your situation changed?
    </p>
    <p className="text-sm text-foreground max-w-2xl leading-relaxed">
      Update your answers if your qualifications, experience, budget, location or available time
      have changed. Your previous assessment stays saved for comparison.
    </p>
    <div className="mt-4">
      <Button onClick={onReassess} className="inline-flex items-center gap-1">
        <RefreshCcw className="h-4 w-4" /> Reassess my route
      </Button>
    </div>
  </section>
);

const EmptyState = () => (
  <div className="rounded-2xl border-2 border-foreground/90 bg-card p-10 text-center max-w-2xl mx-auto">
    <h2 className="font-display text-2xl text-foreground mb-3">You have not built a route yet.</h2>
    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
      Choose a career and complete a Reality Check to get your recommended route, readiness state
      and next actions.
    </p>
    <Button asChild>
      <Link to="/">Find a career</Link>
    </Button>
  </div>
);

export default MyRoute;
