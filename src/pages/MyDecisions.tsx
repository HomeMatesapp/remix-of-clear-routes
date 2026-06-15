import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookmarkPlus,
  Compass,
  AlertOctagon,
  MapPin,
  ListChecks,
  Trash2,
  Loader2,
  RefreshCcw,
  Target,
  CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { flushPendingDecision } from "@/lib/saved-decisions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SUPPORT_CIRCUMSTANCE_KEYS,
  SUPPORT_CIRCUMSTANCE_LABELS,
  type SupportCircumstanceKey,
} from "@/components/role/SupportMatches";

interface SavedDecisionRow {
  id: string;
  role_id: string | null;
  role_slug: string;
  role_name: string;
  overall_verdict: string | null;
  best_route_title: string | null;
  backup_route_title: string | null;
  route_to_avoid_title: string | null;
  local_realism_rating: string | null;
  first_move: string | null;
  created_at: string;
}

interface DecisionProfileRow {
  area: string | null;
  starting_point: string | null;
  highest_qualification: string | null;
  need_to_earn: string | null;
  weekly_hours: string | null;
  budget_band: string | null;
  commute_flexibility: string | null;
  support_circumstances: SupportCircumstanceKey[];
}

const emptyProfile: DecisionProfileRow = {
  area: "",
  starting_point: "",
  highest_qualification: "",
  need_to_earn: "",
  weekly_hours: "",
  budget_band: "",
  commute_flexibility: "",
  support_circumstances: [],
};

const PROFILE_FIELDS: (keyof DecisionProfileRow)[] = [
  "area",
  "starting_point",
  "highest_qualification",
  "need_to_earn",
  "weekly_hours",
  "budget_band",
  "commute_flexibility",
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const verdictTone = (v: string | null): string => {
  if (!v) return "border-border bg-muted text-foreground";
  const s = v.toLowerCase();
  if (s.includes("not for you")) return "border-rose-200 bg-rose-50 text-rose-800";
  if (s.includes("long shot")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (s.includes("hard")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (s.includes("realistic")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-border bg-muted text-foreground";
};

const isRealistic = (v: string | null): boolean => {
  if (!v) return false;
  const s = v.toLowerCase();
  return s.includes("realistic");
};

const MyDecisions = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<SavedDecisionRow[]>([]);
  const [profile, setProfile] = useState<DecisionProfileRow>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login?redirect=/my-decisions");
      return;
    }

    (async () => {
      setLoading(true);
      const flushed = await flushPendingDecision(user.id);
      if (flushed) {
        toast({
          title: "Saved to My Career Decisions",
          description: "Your route check is now in your decisions list.",
        });
      }

      const [{ data: dRows }, { data: pRow }] = await Promise.all([
        supabase
          .from("saved_decisions")
          .select(
            "id, role_id, role_slug, role_name, overall_verdict, best_route_title, backup_route_title, route_to_avoid_title, local_realism_rating, first_move, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("decision_profiles")
          .select(
            "area, starting_point, highest_qualification, need_to_earn, weekly_hours, budget_band, commute_flexibility",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setDecisions((dRows as SavedDecisionRow[] | null) ?? []);
      if (pRow) setProfile({ ...emptyProfile, ...(pRow as DecisionProfileRow) });
      setLoading(false);
    })();
  }, [user, authLoading, navigate, toast]);

  const removeDecision = async (id: string) => {
    if (!user) return;
    if (!confirm("Remove this saved decision?")) return;
    setDecisions((d) => d.filter((x) => x.id !== id));
    await supabase.from("saved_decisions").delete().eq("id", id).eq("user_id", user.id);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const payload = { user_id: user.id, ...profile };
    const { error } = await supabase
      .from("decision_profiles")
      .upsert(payload as never, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) {
      toast({ title: "Couldn't save profile", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Decision Profile saved" });
    }
  };

  // Summary metrics
  const summary = useMemo(() => {
    const realistic = decisions.find((d) => isRealistic(d.overall_verdict));
    const latest = decisions[0]; // already ordered desc by created_at
    return {
      count: decisions.length,
      mostRealistic: realistic ?? null,
      nextMove: latest?.first_move ?? null,
    };
  }, [decisions]);

  const profileFilledCount = PROFILE_FIELDS.filter((k) => (profile[k] ?? "").trim()).length;
  const profileIncomplete = profileFilledCount < PROFILE_FIELDS.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>My Career Decisions — Clear Routes</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-5xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-medium text-foreground">My Career Decisions</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Track the routes you're considering, the advice you've saved, and the next move Clear Routes would make first.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : (
          <>
            {/* Top summary */}
            <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryCard
                icon={<BookmarkPlus className="h-4 w-4" />}
                eyebrow="Decisions saved"
                primary={summary.count.toString()}
                secondary={summary.count === 1 ? "career decision" : "career decisions"}
              />
              <SummaryCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                eyebrow="Most realistic route"
                primary={
                  summary.mostRealistic
                    ? `${summary.mostRealistic.role_name}`
                    : "Not enough saved decisions yet."
                }
                secondary={summary.mostRealistic?.best_route_title ?? undefined}
                href={summary.mostRealistic ? `/role/${summary.mostRealistic.role_slug}` : undefined}
              />
              <SummaryCard
                icon={<Target className="h-4 w-4" />}
                eyebrow="Next move"
                primary={summary.nextMove ?? "Run a Reality-check to get your first move."}
                secondary={
                  summary.nextMove && decisions[0]
                    ? `From your ${decisions[0].role_name} check`
                    : undefined
                }
              />
            </section>

            {/* Active decisions */}
            <section className="mb-12">
              <h2 className="font-display text-xl font-medium text-foreground mb-4">Active decisions</h2>

              {decisions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-8 text-center">
                  <BookmarkPlus className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-display text-lg text-foreground mb-1">No career decisions saved yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Reality-check a role first. Once you have a result, save it here so you can compare your options and come back later.
                  </p>
                  <Button asChild>
                    <Link to="/">Explore roles</Link>
                  </Button>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {decisions.map((d) => (
                    <li key={d.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <Link
                            to={`/role/${d.role_slug}`}
                            className="font-display text-lg font-medium text-foreground hover:underline truncate block"
                          >
                            {d.role_name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">Saved {formatDate(d.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDecision(d.id)}
                          aria-label="Remove decision"
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {d.overall_verdict && (
                        <span
                          className={`self-start inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-3 ${verdictTone(
                            d.overall_verdict,
                          )}`}
                        >
                          {d.overall_verdict}
                        </span>
                      )}

                      <dl className="space-y-2 text-sm">
                        {d.best_route_title && (
                          <Row icon={<Compass className="h-3.5 w-3.5 text-emerald-600" />} label="Best route" value={d.best_route_title} />
                        )}
                        {d.route_to_avoid_title && (
                          <Row
                            icon={<AlertOctagon className="h-3.5 w-3.5 text-rose-600" />}
                            label="Route to be careful with"
                            value={d.route_to_avoid_title}
                          />
                        )}
                        {d.local_realism_rating && (
                          <Row
                            icon={<MapPin className="h-3.5 w-3.5 text-amber-600" />}
                            label="Local realism"
                            value={d.local_realism_rating}
                          />
                        )}
                        {d.first_move && (
                          <Row
                            icon={<ListChecks className="h-3.5 w-3.5 text-foreground" />}
                            label="First move"
                            value={d.first_move}
                          />
                        )}
                      </dl>

                      <div className="mt-4 flex items-center gap-4 text-sm">
                        <Link
                          to={`/role/${d.role_slug}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Back to role <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/role/${d.role_slug}#reality-check`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" /> Run again with updated answers
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Decision profile */}
            <section id="decision-profile" className="mb-12 scroll-mt-24">
              <h2 className="font-display text-xl font-medium text-foreground mb-2">Your Decision Profile</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
                These are the constraints Clear Routes uses when judging future routes. Keep them honest — they change which route makes sense.
              </p>

              {profileIncomplete && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 inline-block">
                  Complete your Decision Profile to make future route checks faster.
                </p>
              )}

              <div className="rounded-2xl border border-border bg-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ProfileField label="Area / town / outward postcode" value={profile.area ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, area: v }))} placeholder="e.g. Leeds, SE15" />
                <ProfileField label="Starting point" value={profile.starting_point ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, starting_point: v }))} placeholder="Graduate, career changer…" />
                <ProfileField label="Highest qualification" value={profile.highest_qualification ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, highest_qualification: v }))} placeholder="GCSEs, A-levels, degree…" />
                <ProfileField label="Need to earn while training" value={profile.need_to_earn ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, need_to_earn: v }))} placeholder="Yes / No / Part-time ok" />
                <ProfileField label="Weekly time available" value={profile.weekly_hours ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, weekly_hours: v }))} placeholder="e.g. 5–10 hrs" />
                <ProfileField label="Budget" value={profile.budget_band ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, budget_band: v }))} placeholder="£0, under £500…" />
                <ProfileField label="Commute / relocation flexibility" value={profile.commute_flexibility ?? ""}
                  onChange={(v) => setProfile((p) => ({ ...p, commute_flexibility: v }))} placeholder="30 min, can relocate…" />

                <div className="sm:col-span-2 pt-2">
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

function SummaryCard({
  icon,
  eyebrow,
  primary,
  secondary,
  href,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  primary: string;
  secondary?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-2xl border border-border bg-card p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{eyebrow}</p>
      </div>
      <p className="text-sm font-medium text-foreground leading-snug">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground mt-1 leading-snug">{secondary}</p>}
    </div>
  );
  return href ? (
    <Link to={href} className="block hover:opacity-90 transition-opacity">
      {body}
    </Link>
  ) : (
    body
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground leading-snug">{value}</dd>
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

export default MyDecisions;
