import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookmarkPlus, Compass, AlertOctagon, MapPin, ListChecks, Trash2, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { flushPendingDecision } from "@/lib/saved-decisions";

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
}

const emptyProfile: DecisionProfileRow = {
  area: "",
  starting_point: "",
  highest_qualification: "",
  need_to_earn: "",
  weekly_hours: "",
  budget_band: "",
  commute_flexibility: "",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

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
      // Flush any pending decision the user stashed before signing up
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
          .select("id, role_id, role_slug, role_name, overall_verdict, best_route_title, backup_route_title, route_to_avoid_title, local_realism_rating, first_move, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("decision_profiles")
          .select("area, starting_point, highest_qualification, need_to_earn, weekly_hours, budget_band, commute_flexibility")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setDecisions((dRows as SavedDecisionRow[] | null) ?? []);
      if (pRow) {
        setProfile({ ...emptyProfile, ...(pRow as DecisionProfileRow) });
      }
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
      toast({ title: "Decision profile saved" });
    }
  };

  // Routes I'm considering = unique role_slug from saved decisions (latest first)
  const consideringMap = new Map<string, SavedDecisionRow>();
  for (const d of decisions) {
    if (d.role_slug && !consideringMap.has(d.role_slug)) consideringMap.set(d.role_slug, d);
  }
  const considering = Array.from(consideringMap.values());

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>My Career Decisions — Clear Routes</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-medium text-foreground">My Career Decisions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Saved route checks, the careers you're considering, and your decision profile.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : (
          <>
            {/* Section 1: Active decisions */}
            <section className="mb-12">
              <h2 className="font-display text-xl font-medium text-foreground mb-4">Active decisions</h2>

              {decisions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-8 text-center">
                  <BookmarkPlus className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    You haven't saved any career decisions yet.
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
                        <span className="self-start inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground mb-3">
                          {d.overall_verdict}
                        </span>
                      )}

                      <dl className="space-y-2 text-sm">
                        {d.best_route_title && (
                          <Row icon={<Compass className="h-3.5 w-3.5 text-emerald-600" />} label="Best route" value={d.best_route_title} />
                        )}
                        {d.route_to_avoid_title && (
                          <Row icon={<AlertOctagon className="h-3.5 w-3.5 text-rose-600" />} label="Route to avoid" value={d.route_to_avoid_title} />
                        )}
                        {d.local_realism_rating && (
                          <Row icon={<MapPin className="h-3.5 w-3.5 text-amber-600" />} label="Local realism" value={d.local_realism_rating} />
                        )}
                        {d.first_move && (
                          <Row icon={<ListChecks className="h-3.5 w-3.5 text-foreground" />} label="First move" value={d.first_move} />
                        )}
                      </dl>

                      <Link
                        to={`/role/${d.role_slug}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-4"
                      >
                        Back to the role <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Section 2: Routes I'm considering */}
            {considering.length > 0 && (
              <section className="mb-12">
                <h2 className="font-display text-xl font-medium text-foreground mb-4">Routes I'm considering</h2>
                <ul className="flex flex-wrap gap-2">
                  {considering.map((c) => (
                    <li key={c.role_slug}>
                      <Link
                        to={`/role/${c.role_slug}`}
                        className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        {c.role_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Section 3: Decision profile */}
            <section className="mb-12">
              <h2 className="font-display text-xl font-medium text-foreground mb-2">Decision profile</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Set your constraints once so you don't have to re-enter them every time.
              </p>

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
