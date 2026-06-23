import { Helmet } from "react-helmet-async";
import { ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SOURCES, type SourceEntry, type SourceCategory } from "@/lib/reality-check/sources";

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  regulation: "Regulators",
  pathway: "Pathways & entry routes",
  apprenticeship: "Apprenticeships",
  salary: "Salary",
  demand: "Demand & vacancies",
  local: "Local context",
  ai_impact: "AI impact",
};

const groupSources = (): Array<{ category: SourceCategory; entries: SourceEntry[] }> => {
  const groups: Record<string, SourceEntry[]> = {};
  for (const s of Object.values(SOURCES)) {
    (groups[s.category] ??= []).push(s);
  }
  const order: SourceCategory[] = [
    "regulation",
    "pathway",
    "apprenticeship",
    "salary",
    "demand",
    "local",
    "ai_impact",
  ];
  return order
    .filter((c) => groups[c]?.length)
    .map((c) => ({ category: c, entries: groups[c] }));
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short" });
};

const Sources = () => {
  const grouped = groupSources();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Methodology & sources | Clear Routes</title>
        <meta
          name="description"
          content="How Clear Routes judges career routes, what the Reality-check assesses, what we claim and what we do not, and the UK public sources behind the evidence."
        />
      </Helmet>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="font-display text-4xl font-medium text-foreground">
          Methodology &amp; sources
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
          This page explains how the Reality-check produces a verdict, what it
          does and does not claim, and which UK public sources sit behind the
          evidence shown on the result page. We update it as our sources are
          re-checked.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            What the Reality-check assesses
          </h2>
          <p className="text-[15px] leading-relaxed text-foreground">
            For a chosen role and a set of personal constraints (starting point,
            qualifications, income need, weekly hours, budget, area, commute or
            relocation flexibility), the Reality-check produces:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-foreground">
            <li>An overall verdict — realistic, realistic but hard, long shot, or probably not for you.</li>
            <li>A best route, with an approximate time, cost and main difficulty for this person.</li>
            <li>A backup route and the trade-off it carries.</li>
            <li>A route to be careful with, and why it may be a mismatch.</li>
            <li>An approximate local realism rating, based on the national pattern for the role.</li>
            <li>Three concrete first moves the person could take this week.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            How route recommendations are produced
          </h2>
          <p className="text-[15px] leading-relaxed text-foreground">
            The role page holds editorially-reviewed pathway descriptions
            (school leaver, graduate, adjacent, no background) and structured
            facts (salary anchors, demand, competition, AI exposure). The
            Reality-check picks the pathway most relevant to the person's
            starting point and asks a large language model to weigh the
            person's constraints against that pathway and the role facts,
            within strict rules:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-foreground">
            <li>No providers, employers, courses or schemes are named unless they appear in the role data.</li>
            <li>No salaries, fees, timelines or eligibility rules are invented — qualitative wording is used when a figure is not supported.</li>
            <li>Local realism is approximate. We do not have live local vacancy data.</li>
            <li>When a route may need a bridging step (e.g. functional skills, Access course, English-language support), it is suggested rather than asserted.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            What we do and do not claim
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold uppercase tracking-wider text-[11px]">We do claim</p>
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                <li>A judgement about how realistic a route is for the person, given their answers.</li>
                <li>Pathway descriptions that match published UK guidance.</li>
                <li>Salary and demand ranges drawn from cited UK public sources.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-semibold uppercase tracking-wider text-[11px]">We do not claim</p>
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                <li>Guaranteed jobs, salaries, course places or qualification outcomes.</li>
                <li>Live local vacancy counts or live course availability.</li>
                <li>That any specific provider is the right one for you.</li>
                <li>That a person is "at risk" — we describe possible mismatches worth discussing.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            How we handle uncertainty and missing information
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-foreground">
            <li>When a person leaves a field blank, the engine treats it as "not given" rather than guessing.</li>
            <li>Where role facts are missing, the result page says so or stays generic — it never fills the gap with plausible-sounding inventions.</li>
            <li>Each best route carries a confidence label (high, medium, low) so the reader can weight it.</li>
            <li>We use cautious wording — "possible mismatch", "worth discussing", "may require further checks", "based on the information provided".</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            How often evidence is reviewed
          </h2>
          <p className="text-[15px] leading-relaxed text-foreground">
            Each source carries a "last checked" date, shown both below and on
            every Reality-check result. Sources are scheduled for re-check at
            least every 12 months, and within a month of a known publication
            update (e.g. the annual ONS ASHE release). When a source has not
            been re-checked within 12 months, a soft notice appears on the
            result so the reader knows.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display font-semibold text-xl text-foreground">
            Editorial independence
          </h2>
          <p className="text-[15px] leading-relaxed text-foreground">
            No provider, employer or training organisation pays to improve
            their assessment or position. Where a provider listing offers a
            lead-capture button in future, payment will buy the button only —
            never ratings, ordering or honest notes.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-display font-semibold text-xl text-foreground">
            Sources
          </h2>
          {grouped.map(({ category, entries }) => (
            <div key={category}>
              <h3 className="font-display font-semibold text-base text-foreground mb-2">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-3">
                {entries.map((s) => (
                  <li key={s.id} className="text-sm leading-snug">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      {s.organisation} — {s.title}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.period} · Last checked {formatDate(s.lastChecked)}
                    </p>
                    <p className="text-xs text-foreground/80 mt-0.5">{s.usage}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Sources;
