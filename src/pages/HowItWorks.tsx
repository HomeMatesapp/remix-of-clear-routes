import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Compass, LifeBuoy, AlertOctagon, MapPin, BookmarkPlus, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const HowItWorks = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Helmet><title>How Clear Routes works</title></Helmet>
    <Navbar />
    <main className="flex-1 container mx-auto px-4 py-14 max-w-3xl">
      <h1 className="font-display text-3xl md:text-4xl font-medium text-foreground">How Clear Routes works</h1>

      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground">
        <p>
          Clear Routes helps you reality-check a career route before you commit time or money to it.
        </p>
        <p>
          You pick a role, tell us a bit about your situation, and we return a route judgement: the
          best route in for you, a backup route, a route to avoid, what's realistic locally, and the
          first move to make this week.
        </p>
        <p>
          The route check is AI-assisted. It uses your answers plus our editorial data on each role —
          pay ranges, competition, training options, and support — to form a judgement. It is guidance,
          not a guarantee.
        </p>
        <p>
          You can save any route check as a career decision and come back to it. Your Decision Profile
          remembers your constraints so you don't have to re-enter them on every check.
        </p>
        <p>
          We don't take payment from providers. Where we surface funded support, we link to the source
          so you can verify eligibility yourself.
        </p>
        <p>
          <Link to="/sources" className="text-primary hover:underline">Sources & methodology →</Link>
        </p>
      </div>

      {/* ─── Three steps ─────────────────────────────────────────── */}
      <section className="mt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Three steps to a route judgement
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <li className="rounded-xl border border-border bg-card p-5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              1
            </span>
            <h3 className="mt-3 text-base font-semibold text-foreground">Choose a role</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Pick the career you're considering.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              2
            </span>
            <h3 className="mt-3 text-base font-semibold text-foreground">Tell us your situation</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Starting point, budget, time, earning needs, and area.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              3
            </span>
            <h3 className="mt-3 text-base font-semibold text-foreground">Get a route judgement</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Best route, backup, route to avoid, local realism, and first moves.
            </p>
          </li>
        </ol>
      </section>

      {/* ─── What you get ────────────────────────────────────────── */}
      <section className="mt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          What you get
        </p>
        <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground mb-6">
          A decision, not a brochure.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Compass className="h-4 w-4" />}
            title="Best route"
            body="The path with the strongest odds from your situation."
          />
          <FeatureCard
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Backup route"
            body="A realistic alternative if the first route is blocked."
          />
          <FeatureCard
            icon={<AlertOctagon className="h-4 w-4" />}
            title="Route to be careful with"
            body="The option that may waste time or money."
          />
          <FeatureCard
            icon={<MapPin className="h-4 w-4" />}
            title="Local realism"
            body="Whether the route depends on nearby employers, colleges, or funded options."
          />
          <FeatureCard
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Support that may help"
            body="Grants, bursaries, access schemes, and organisations worth checking."
          />
          <FeatureCard
            icon={<BookmarkPlus className="h-4 w-4" />}
            title="Save the decision"
            body="Keep the route check, compare careers, and return when you're ready."
          />
        </div>
      </section>

      {/* ─── Example result ──────────────────────────────────────── */}
      <section className="mt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Example result
        </p>
        <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground mb-6">
          What a route judgement looks like.
        </h2>
        <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-primary">
              <Compass className="h-4 w-4" />
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
            <PreviewRow label="Best route" value="Portfolio + entry-level analyst/admin/data role" tone="emerald" />
            <PreviewRow label="Be careful with" value="£5,000 bootcamp without transparent outcomes" tone="rose" />
            <PreviewRow label="Local realism" value="Mixed — depends on junior roles within commuting range" tone="amber" />
            <PreviewRow label="First move" value="Build one practical project using public UK data" tone="sky" />
          </dl>
        </div>
      </section>

      {/* ─── Save decisions CTA ────────────────────────────────── */}
      <section className="mt-14 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-4">
          <BookmarkPlus className="h-5 w-5" />
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
            <Link to="/search">
              Browse roles to check
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ─── Why Clear Routes ────────────────────────────────────── */}
      <section className="mt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Why Clear Routes
        </p>
        <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground mb-6">
          Most career sites explain the job. Clear Routes judges the route.
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl text-sm text-foreground">
          {[
            "Salary, demand, and competition — grounded in real data.",
            "Uncomfortable truths, not motivational lines.",
            "Pathways that differ by starting point.",
            "Provider and funding transparency.",
            "No generic 'just do a bootcamp' advice.",
            "No training-provider sales pitch.",
          ].map((line) => (
            <li key={line} className="flex gap-2 leading-relaxed">
              <span className="text-primary mt-0.5">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
    <Footer />
  </div>
);

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
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

export default HowItWorks;
