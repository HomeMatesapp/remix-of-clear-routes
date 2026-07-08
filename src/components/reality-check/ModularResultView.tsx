// Route-comparison result view for reviewed modular Reality Check roles.
//
// Runtime gate: rendered by RealityCheckPage (or any future saved-result
// page) whenever `result.modular` is present. The presence of the payload
// — never the role slug — is the source of truth.
//
// Design: Field Map paper style. Paper cards, 2px ink border, magenta
// (`path`) route accent, restrained tint reassurance, amber caution.
// Vertical stack on mobile, 2-up grid ≥md.
//
// Status-safe rendering:
//   - route_recommended             → recommended / backup / caution cards
//   - qualification_verification_required → investigate_after_check cards only
//   - bridging_required             → may_open_later cards only (or none)
//   - insufficient_information      → no route cards; missing-info edit links
//
// Prop shape follows the four addendum decisions:
//   - takes `result`, `role`, `onEdit`, optional `answers` (only forwarded
//     to the existing SavePrompt), and `mode`.
//   - never depends on legacy `RealityCheckAnswers` for anything other than
//     forwarding to `SavePrompt`.

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Compass, LifeBuoy, ListChecks, Pencil, ShieldQuestion, Sparkles } from "lucide-react";
import type {
  ModularRealityCheckPayload,
  ModularRouteCard,
  ModularRouteCardKind,
  RealityCheckAnswers,
  RealityCheckResult,
  RoleContext,
} from "@/lib/reality-check/types";
import { SavePrompt } from "@/components/role/reality-check-shared";
import { SourcesPanel } from "@/components/reality-check/SourcesPanel";
import { getSourcesForResult } from "@/lib/reality-check/sources";

export interface ModularResultViewProps {
  result: RealityCheckResult & { modular: ModularRealityCheckPayload };
  role: RoleContext;
  /** Called when a missing-info button (or the top edit link) is clicked. */
  onEdit?: (questionId?: string) => void;
  /** In "saved" mode, missing-info renders as plain text (no edit buttons). */
  mode?: "live" | "saved";
  /**
   * Forwarded verbatim to the existing SavePrompt in "live" mode. The
   * ModularResultView itself does not read any legacy answers.
   */
  answers?: RealityCheckAnswers;
}

// ── Small paper helpers ─────────────────────────────────────────────────────

const PaperCard = ({
  children,
  accent = "ink",
  className = "",
}: {
  children: React.ReactNode;
  accent?: "ink" | "path" | "amber" | "tint";
  className?: string;
}) => {
  const accentClass = {
    ink: "border-ink",
    path: "border-path",
    amber: "border-[hsl(35_85%_45%)]",
    tint: "border-ink",
  }[accent];
  return (
    <section
      className={`bg-white border-2 ${accentClass} rounded-[10px] p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
};

const Eyebrow = ({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "path" | "amber" }) => {
  const cls = {
    ink: "text-muted-foreground",
    path: "text-path",
    amber: "text-[hsl(30_85%_35%)]",
  }[tone];
  return (
    <p className={`font-mono text-[11.5px] tracking-[0.14em] uppercase font-semibold ${cls}`}>
      {children}
    </p>
  );
};

// ── Route card ──────────────────────────────────────────────────────────────

const KIND_META: Record<
  ModularRouteCardKind,
  { eyebrow: string; accent: "ink" | "path" | "amber"; icon: typeof Compass; tone: "ink" | "path" | "amber" }
> = {
  recommended: { eyebrow: "Recommended route", accent: "path", icon: Compass, tone: "path" },
  backup: { eyebrow: "Backup route", accent: "ink", icon: LifeBuoy, tone: "ink" },
  caution: { eyebrow: "Be careful with", accent: "amber", icon: AlertTriangle, tone: "amber" },
  investigate_after_check: {
    eyebrow: "Investigate after verification",
    accent: "ink",
    icon: ShieldQuestion,
    tone: "ink",
  },
  may_open_later: {
    eyebrow: "May open after the bridging step",
    accent: "ink",
    icon: Sparkles,
    tone: "ink",
  },
};

const RouteCard = ({ card }: { card: ModularRouteCard }) => {
  const meta = KIND_META[card.kind];
  const Icon = meta.icon;
  return (
    <article className={`bg-white border-2 ${meta.accent === "path" ? "border-path" : meta.accent === "amber" ? "border-[hsl(35_85%_45%)]" : "border-ink"} rounded-[10px] p-5 flex flex-col gap-3 h-full`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${meta.tone === "path" ? "text-path" : meta.tone === "amber" ? "text-[hsl(30_85%_35%)]" : "text-ink"}`} aria-hidden="true" />
        <Eyebrow tone={meta.tone}>{meta.eyebrow}</Eyebrow>
      </div>
      <h3 className="font-display font-bold text-ink text-[18px] leading-tight">{card.title}</h3>
      <div>
        <p className="text-[11.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">Why this may fit</p>
        <p className="text-[14px] text-ink leading-snug">{card.fit}</p>
      </div>
      <div>
        <p className="text-[11.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">What could make it difficult</p>
        <p className="text-[14px] text-ink leading-snug">{card.constraint}</p>
      </div>
      {card.checks.length > 0 && (
        <div>
          <p className="text-[11.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">Must be checked</p>
          <ul className="space-y-1.5">
            {card.checks.map((c, i) => (
              <li key={i} className="text-[13.5px] text-ink leading-snug flex gap-2">
                <span className="text-path mt-0.5">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(card.timeCaveat || card.costCaveat || card.patternCaveat) && (
        <dl className="grid grid-cols-3 gap-2 border-t-2 border-dashed border-[hsl(40_15%_82%)] pt-3">
          {card.timeCaveat && (
            <div>
              <dt className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Time</dt>
              <dd className="text-[12.5px] text-ink leading-tight mt-0.5">{card.timeCaveat}</dd>
            </div>
          )}
          {card.costCaveat && (
            <div>
              <dt className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Cost</dt>
              <dd className="text-[12.5px] text-ink leading-tight mt-0.5">{card.costCaveat}</dd>
            </div>
          )}
          {card.patternCaveat && (
            <div>
              <dt className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">Pattern</dt>
              <dd className="text-[12.5px] text-ink leading-tight mt-0.5">{card.patternCaveat}</dd>
            </div>
          )}
        </dl>
      )}
      {card.affordable === false && (
        <p className="text-[12.5px] text-[hsl(30_85%_35%)] leading-snug italic">
          Note: this route's affordability is a separate concern from readiness — the route is still structurally viable.
        </p>
      )}
      <p className="text-[13.5px] text-ink leading-snug mt-auto pt-3 border-t border-dashed border-[hsl(40_15%_82%)]">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">
          Next action
        </span>
        {card.nextAction}
      </p>
    </article>
  );
};

// ── Status-specific summary copy ────────────────────────────────────────────

const SUMMARY_META: Record<
  ModularRealityCheckPayload["status"],
  { heading: string; eyebrow: string; tone: "ink" | "path" | "amber" }
> = {
  route_recommended: {
    heading: "Your most realistic route",
    eyebrow: "Route judgement",
    tone: "path",
  },
  qualification_verification_required: {
    heading: "Verification is needed before any route can be confirmed",
    eyebrow: "Verification needed first",
    tone: "amber",
  },
  bridging_required: {
    heading: "A bridging step is needed first",
    eyebrow: "Bridging step needed",
    tone: "amber",
  },
  insufficient_information: {
    heading: "A few more answers needed",
    eyebrow: "More information needed",
    tone: "ink",
  },
};

// ── Main component ─────────────────────────────────────────────────────────

export function ModularResultView({
  result,
  role,
  onEdit,
  mode = "live",
  answers,
}: ModularResultViewProps) {
  const m = result.modular;
  const summary = SUMMARY_META[m.status];
  const recommended = m.routes.find((r) => r.kind === "recommended");
  const primaryTitle =
    m.status === "route_recommended" && recommended
      ? recommended.title
      : summary.heading;

  return (
    <div className="space-y-5">
      {/* A. Summary */}
      <PaperCard accent={summary.tone === "path" ? "path" : summary.tone === "amber" ? "amber" : "ink"}>
        <Eyebrow tone={summary.tone}>{summary.eyebrow}</Eyebrow>
        <h2 className="font-display font-extrabold text-ink tracking-[-0.01em] leading-[1.15] text-[clamp(22px,3.4vw,30px)] mt-2">
          {primaryTitle}
        </h2>
        <p className="mt-3 text-[15px] text-ink leading-snug">{m.headline}</p>
        {result.readinessReason && m.status === "route_recommended" && (
          <p className="mt-2 text-[13.5px] text-muted-foreground leading-snug">
            {result.readinessReason}
          </p>
        )}
      </PaperCard>

      {/* B. Route comparison */}
      {m.routes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {m.routes.map((card, i) => (
            <RouteCard key={`${card.kind}-${i}`} card={card} />
          ))}
        </div>
      )}

      {/* C. Considerations — working-condition items, never blockers */}
      {result.considerations && result.considerations.length > 0 && (
        <PaperCard accent="ink">
          <div className="flex items-center gap-2 mb-2">
            <Eyebrow tone="ink">Working-condition things to look into</Eyebrow>
          </div>
          <ul className="space-y-2">
            {result.considerations.map((c, i) => (
              <li key={i} className="text-[14px] text-ink leading-snug flex gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </PaperCard>
      )}

      {/* D. Checks before committing + missing information */}
      {(m.checksBeforeCommitting.length > 0 || (m.missingInformation && m.missingInformation.length > 0)) && (
        <PaperCard accent="ink">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-4 w-4 text-ink" aria-hidden="true" />
            <Eyebrow tone="ink">Checks before committing</Eyebrow>
          </div>
          {m.checksBeforeCommitting.length > 0 && (
            <ul className="space-y-2">
              {m.checksBeforeCommitting.map((c, i) => (
                <li key={i} className="text-[14px] text-ink leading-snug flex gap-2">
                  <span className="text-path mt-0.5">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {m.missingInformation && m.missingInformation.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed border-[hsl(40_15%_82%)]">
              <p className="font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground mb-2">
                Answers still needed
              </p>
              <ul className="space-y-2">
                {m.missingInformation.map((item) => (
                  <li key={item.questionId}>
                    {mode === "live" && onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(item.questionId)}
                        className="text-left w-full inline-flex items-center gap-2 text-[14px] text-path hover:text-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path rounded"
                      >
                        <Pencil className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    ) : (
                      <span className="text-[14px] text-ink">{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PaperCard>
      )}

      {/* E. First moves */}
      {result.firstMoves && result.firstMoves.length > 0 && (
        <PaperCard accent="ink">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-path" aria-hidden="true" />
            <Eyebrow tone="path">First moves</Eyebrow>
          </div>
          <ol className="space-y-3">
            {result.firstMoves.map((m2, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-path text-white text-[13px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-[14.5px] text-ink leading-snug">{m2}</span>
              </li>
            ))}
          </ol>
        </PaperCard>
      )}

      {/* F′. Sources — same source-selection path as legacy ResultView.
          Presentation-only wiring so modular results (Registered Nurse and
          every other modular role) surface their citations. */}
      <SourcesPanel
        sources={getSourcesForResult(
          role,
          (answers ?? {}) as RealityCheckAnswers,
          result,
        )}
      />

      {/* F. Save this route check — reuses existing SavePrompt in live mode */}
      {mode === "live" && answers && (
        <PaperCard accent="ink">
          <Eyebrow tone="ink">Save this route check</Eyebrow>
          <p className="mt-2 text-[14px] text-ink leading-snug">
            Save your answers so you can compare routes again when your
            availability, budget or qualifications change.
          </p>
          <div className="mt-4">
            <SavePrompt role={role} answers={answers} result={result} />
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground leading-snug">
            You can also{" "}
            <Link
              to={`/role/${role.role_slug}/reality-check`}
              onClick={(e) => {
                if (onEdit) {
                  e.preventDefault();
                  onEdit();
                }
              }}
              className="text-path underline underline-offset-4 hover:text-ink"
            >
              reassess later
            </Link>
            .
          </p>
        </PaperCard>
      )}
    </div>
  );
}
