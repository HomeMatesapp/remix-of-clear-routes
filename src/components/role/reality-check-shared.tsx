// Shared building blocks for the Reality-check UI.
// Used by the dedicated /role/:slug/reality-check page and the compact
// role-page CTA. Kept dark-themed to match the existing styling.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  BookmarkPlus,
  Check,
  Compass,
  Gavel,
  LifeBuoy,
  ListChecks,
  Loader2,
  MapPin,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import {
  saveDecision,
  stashPendingDecision,
  sanitiseDecisionAnswers,
} from "@/lib/saved-decisions";
import { SupportMatches } from "@/components/role/SupportMatches";
import { WhyThisResult } from "@/components/reality-check/WhyThisResult";
import { SourcesPanel } from "@/components/reality-check/SourcesPanel";
import { getSourcesForResult } from "@/lib/reality-check/sources";
import {
  BUDGETS,
  COMMUTE_FLEX,
  ENGLISH_COMFORT,
  ENGLISH_MATHS,
  INCOME_NEEDS,
  QUALIFICATION_LEVELS,
  READINESS_LABEL,
  SCIENCE_SUBJECTS,
  STARTING_POINTS,
  WEEKLY_HOURS,
  type RealityCheckAnswers,
  type RealityCheckResult,
  type Readiness,
  type RoleContext,
} from "@/lib/reality-check/types";
import { REGIONS, isSupportedRegion, regionLabel } from "@/lib/reality-check/regions";
import {
  answersToProfile,
  hasAnyProfileField,
  profilesDiffer,
  type DecisionProfileFields,
} from "@/lib/reality-check/profile-mapping";

// ── Defaults ──────────────────────────────────────────────────────────────────

export const emptyAnswers: RealityCheckAnswers = {
  startingPoint: null,
  incomeNeed: null,
  weeklyHours: null,
  budget: null,
  region: null,
  area: "",
  commuteFlex: null,
  notes: "",
  relevantBackground: "",
  englishMaths: null,
  scienceSubjects: null,
  qualificationLevel: null,
  englishComfort: null,
};

// Starting points where Relevant background is required (vs optional).
export const BACKGROUND_REQUIRED_FOR: Array<RealityCheckAnswers["startingPoint"]> = [
  "graduate",
  "career_changer",
  "adjacent",
];

// Heuristic — for healthcare/STEM/technical roles we keep "science" wording.
// For everything else we soften to "role-related subjects".
export const isStemOrHealthcareRole = (roleName: string): boolean => {
  const n = roleName.toLowerCase();
  return /(nurse|midwif|doctor|gp|paramedic|therapist|radiograph|pharmacist|dentist|psycholog|engineer|scientist|technician|electrician|plumber|mechanic|developer|programmer|analyst|laborator|biomed|chemist|physic|surveyor|architect|veterinar|biolog|data)/.test(
    n,
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const labelFor = <T extends string>(
  options: { value: T; label: string }[],
  v: T | null,
): string | null => (v ? options.find((o) => o.value === v)?.label ?? null : null);

export const answerChips = (a: RealityCheckAnswers): string[] => {
  const chips: string[] = [];
  const sp = labelFor(STARTING_POINTS, a.startingPoint);
  if (sp) chips.push(sp);
  if (a.relevantBackground.trim()) chips.push(a.relevantBackground.trim());
  const ql = labelFor(QUALIFICATION_LEVELS, a.qualificationLevel);
  if (ql) chips.push(ql);
  const em = labelFor(ENGLISH_MATHS, a.englishMaths);
  if (em) chips.push(`English/maths: ${em}`);
  const inc = labelFor(INCOME_NEEDS, a.incomeNeed);
  if (inc) chips.push(inc);
  const b = labelFor(BUDGETS, a.budget);
  if (b) chips.push(`${b} budget`);
  const rg = regionLabel(a.region);
  if (rg) chips.push(rg);
  if (a.area.trim()) chips.push(a.area.trim());
  const cf = labelFor(COMMUTE_FLEX, a.commuteFlex);
  if (cf) chips.push(cf);
  const wh = labelFor(WEEKLY_HOURS, a.weeklyHours);
  if (wh) chips.push(wh);
  return chips;
};

// Re-export so RealityCheckPage can build the region step from one place.
export { REGIONS };

export const verdictTone = (v: string): string => {
  const s = v.toLowerCase();
  if (s.includes("not for you")) return "bg-rose-50 text-rose-800 border-rose-200";
  if (s.includes("long shot"))   return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("hard"))        return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("realistic"))   return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
};

export const confidenceTone = (c: string): string => {
  if (c === "high")   return "bg-emerald-100 text-emerald-800";
  if (c === "medium") return "bg-amber-100 text-amber-800";
  return "bg-gray-200 text-gray-700";
};

export const localToneText = (r: string): string => {
  if (r === "strong") return "text-emerald-700";
  if (r === "weak")   return "text-rose-700";
  return "text-amber-700";
};

// ── Session storage (cross-page summary) ──────────────────────────────────────

const sessionKey = (slug: string) => `cr_rc_${slug}`;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface SessionRCEntry {
  answers: RealityCheckAnswers;
  result: RealityCheckResult;
  savedAt: string;
}

export const loadSessionResult = (slug: string): SessionRCEntry | null => {
  try {
    const raw = sessionStorage.getItem(sessionKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionRCEntry;
    const savedAt = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(sessionKey(slug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveSessionResult = (slug: string, entry: SessionRCEntry) => {
  try {
    const safe = sanitiseDecisionAnswers(entry.answers);
    const safeEntry: SessionRCEntry = {
      ...entry,
      answers: {
        startingPoint: safe.startingPoint,
        relevantBackground: safe.relevantBackground,
        englishMaths: safe.englishMaths,
        scienceSubjects: null,
        qualificationLevel: safe.qualificationLevel,
        englishComfort: null,
        incomeNeed: safe.incomeNeed,
        weeklyHours: null,
        budget: safe.budget,
        region: safe.region,
        area: safe.area,
        commuteFlex: safe.commuteFlex,
        notes: "",
      },
    };
    sessionStorage.setItem(sessionKey(slug), JSON.stringify(safeEntry));
  } catch {
    /* ignore */
  }
};

export const clearSessionResult = (slug: string) => {
  try {
    sessionStorage.removeItem(sessionKey(slug));
  } catch {
    /* ignore */
  }
};

// ── In-progress questionnaire persistence ─────────────────────────────────────
// Distinct from the result cache above: preserves the user's un-submitted
// answers and position in the wizard across a page refresh or in-tab navigation.
// NOTE: sessionStorage is per-tab and is cleared when the tab closes. This is
// intentional for Increment 1a — "resume within this session", not "resume
// tomorrow". Move to localStorage later if a longer-lived resume is required.
// Wiped on successful submit; retained on failed submit.

const progressKey = (slug: string) => `cr_rc_progress_${slug}`;
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000;
const CURRENT_DRAFT_SCHEMA = 1;

export type StartingPointStatus =
  | "resolved"
  | "unresolved_not_sure"
  | "unresolved_other";

// Persisted draft. `stepId` is used instead of a numeric index so that
// changing the question order (e.g. when role modules ship) doesn't restore
// users onto a different question.
export interface RealityCheckDraft {
  schemaVersion: 1;
  answers: RealityCheckAnswers;
  stepId: string;
  startingPointStatus: StartingPointStatus | null;
  startingPointOtherText: string;
  savedAt: number;
}

// Back-compat alias for consumers that used the older name.
export type InProgressAnswers = RealityCheckDraft;

export const loadInProgressAnswers = (slug: string): RealityCheckDraft | null => {
  try {
    const raw = sessionStorage.getItem(progressKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RealityCheckDraft>;
    if (parsed?.schemaVersion !== CURRENT_DRAFT_SCHEMA) {
      sessionStorage.removeItem(progressKey(slug));
      return null;
    }
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : NaN;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > PROGRESS_TTL_MS) {
      sessionStorage.removeItem(progressKey(slug));
      return null;
    }
    return parsed as RealityCheckDraft;
  } catch {
    return null;
  }
};

export const saveInProgressAnswers = (
  slug: string,
  entry: Omit<RealityCheckDraft, "savedAt" | "schemaVersion">,
) => {
  try {
    const draft: RealityCheckDraft = {
      schemaVersion: CURRENT_DRAFT_SCHEMA,
      ...entry,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(progressKey(slug), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
};

export const clearInProgressAnswers = (slug: string) => {
  try {
    sessionStorage.removeItem(progressKey(slug));
  } catch {
    /* ignore */
  }
};

// ── Wizard helpers (pure, unit-testable) ─────────────────────────────────────

// If a conditional question is no longer visible, its answer should not
// linger in state, persistence, or the submission payload. Extend this as
// more conditional questions arrive (role modules, etc.).
export const sanitiseAnswersForVisibility = (
  answers: RealityCheckAnswers,
  visibility: { backgroundRequired: boolean },
): RealityCheckAnswers => {
  if (visibility.backgroundRequired) return answers;
  if (!answers.relevantBackground) return answers;
  return { ...answers, relevantBackground: "" };
};

// Clamp a persisted stepId to the currently visible steps. If the stored
// step no longer exists (e.g. background hidden after re-selecting starting
// point), fall back to the first step so a restored session cannot land on
// a hidden or out-of-range screen.
export const clampStepId = (
  stepId: string | null | undefined,
  visibleStepIds: string[],
): string => {
  if (!stepId || !visibleStepIds.includes(stepId)) {
    return visibleStepIds[0] ?? "";
  }
  return stepId;
};

// User-facing copy for when the starting point signal is missing from the
// engine input. Rendered on the review screen and (as a restrained banner)
// on the result page.
export const UNRESOLVED_STARTING_POINT_NOTICE =
  "We couldn't identify your current starting point. Your result may be less specific. You can continue, or go back and choose the closest available option.";

export const UNRESOLVED_STARTING_POINT_OTHER_NOTICE =
  "We've saved your description, but it isn't yet used to select your route.";

// ── Small reusable UI ─────────────────────────────────────────────────────────

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "border-amber-300 bg-amber-300 text-gray-900"
                : "border-gray-600 bg-gray-700/50 text-gray-200 hover:bg-gray-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-300 mb-1">{label}</label>
      {helper && <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{helper}</p>}
      {children}
      {error && <p className="text-[10px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
}

// ── Result rendering ──────────────────────────────────────────────────────────

const toneRing: Record<string, string> = {
  emerald: "border-emerald-400/40",
  sky:     "border-sky-400/40",
  rose:    "border-rose-400/60 ring-1 ring-rose-400/30",
  amber:   "border-amber-300/40",
};
const toneIcon: Record<string, string> = {
  emerald: "text-emerald-300",
  sky:     "text-sky-300",
  rose:    "text-rose-300",
  amber:   "text-amber-300",
};

function Card({
  icon,
  eyebrow,
  tone,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  tone: "emerald" | "sky" | "rose" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl bg-gray-700/40 border ${toneRing[tone]} p-4`}>
      <div className={`flex items-center gap-2 mb-2 ${toneIcon[tone]}`}>
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{eyebrow}</p>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-600 p-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-xs font-medium text-white leading-tight mt-0.5">{value}</p>
    </div>
  );
}

const summaryLabelTone: Record<string, string> = {
  emerald: "text-emerald-300",
  sky:     "text-sky-300",
  rose:    "text-rose-300",
  amber:   "text-amber-300",
};

// Background tone for the new Release 1 readiness banner.
const readinessBannerTone: Record<Readiness, string> = {
  ready_now:      "border-emerald-400/40 bg-gradient-to-br from-emerald-900/40 to-gray-900",
  nearly_ready:   "border-amber-300/40 bg-gradient-to-br from-amber-900/30 to-gray-900",
  needs_bridging: "border-amber-300/40 bg-gradient-to-br from-amber-900/30 to-gray-900",
  high_risk_now:  "border-rose-400/50 bg-gradient-to-br from-rose-900/40 to-gray-900",
};

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  return (
    <div className="flex flex-col">
      <dt className={`text-[10px] font-semibold uppercase tracking-wider ${summaryLabelTone[tone]}`}>
        {label}
      </dt>
      <dd className="text-sm text-gray-100 leading-snug mt-0.5">{value}</dd>
    </div>
  );
}

export function ResultView({
  result,
  answers,
  role,
  onEdit,
  initialProfile,
  onProfileSaved,
}: {
  result: RealityCheckResult;
  answers: RealityCheckAnswers;
  role: RoleContext;
  onEdit: () => void;
  initialProfile: DecisionProfileFields | null;
  onProfileSaved: (p: DecisionProfileFields) => void;
}) {
  const firstMove = result.firstMoves?.[0];
  const readiness: Readiness = result.readiness ?? "nearly_ready";
  const supported = isSupportedRegion(answers.region);
  return (
    <div className="space-y-4">
      {/* Release 1 readiness banner — deterministic, four states */}
      <div className={`rounded-xl border p-4 ${readinessBannerTone[readiness]}`}>
        <div className="flex items-center gap-2 mb-2 text-amber-300">
          <Gavel className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-wider">Your route judgement</p>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
            {READINESS_LABEL[readiness]}
          </span>
        </div>
        {result.readinessReason && (
          <p className="text-sm text-gray-200 leading-relaxed mb-3">{result.readinessReason}</p>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <SummaryRow label="Best route" value={result.bestRoute.title} tone="emerald" />
          {result.bestRoute.whyThisFits?.[0] && (
            <SummaryRow label="Strongest advantage" value={result.bestRoute.whyThisFits[0]} tone="emerald" />
          )}
          {result.biggestBlocker && (
            <SummaryRow label="Biggest blocker" value={result.biggestBlocker} tone="rose" />
          )}
          <SummaryRow label="Be careful with" value={result.routeToAvoid.title} tone="rose" />
          {(result.immediateAction || firstMove) && (
            <SummaryRow label="Do this week" value={result.immediateAction || firstMove!} tone="sky" />
          )}
        </dl>
        {answers.region && !supported && (
          <p className="mt-3 text-[11px] text-gray-300 leading-snug border-t border-white/10 pt-3">
            Your route judgement is available, but verified local opportunity coverage is currently focused on London,
            Greater Manchester, and Birmingham and the West Midlands.
          </p>
        )}
      </div>

      {/* Best route */}
      <Card icon={<Compass className="h-4 w-4" />} eyebrow="Best route for you" tone="emerald">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{result.bestRoute.title}</h3>
          {result.bestRoute.confidence && (
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${confidenceTone(
                result.bestRoute.confidence,
              )}`}
            >
              {result.bestRoute.confidence} confidence
            </span>
          )}
        </div>
        <p className="text-sm text-gray-200 mt-1 leading-relaxed">{result.bestRoute.summary}</p>

        {result.bestRoute.whyThisFits?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-1">Why this fits you</p>
            <ul className="space-y-1">
              {result.bestRoute.whyThisFits.map((w, i) => (
                <li key={i} className="text-sm text-gray-200 flex gap-2">
                  <span className="text-emerald-300">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Time"     value={result.bestRoute.estimatedTime} />
          <Stat label="Cost"     value={result.bestRoute.likelyCost} />
          <Stat label="Hard bit" value={result.bestRoute.mainDifficulty} />
        </div>
      </Card>

      {/* Backup route */}
      <Card icon={<LifeBuoy className="h-4 w-4" />} eyebrow="Backup route" tone="sky">
        <h3 className="text-base font-semibold text-white">{result.backupRoute.title}</h3>
        <p className="text-sm text-gray-200 mt-1 leading-relaxed">{result.backupRoute.summary}</p>
        {result.backupRoute.tradeOff && (
          <p className="text-xs text-gray-400 mt-2">
            <span className="font-semibold text-sky-300 uppercase tracking-wider mr-1">Trade-off:</span>
            {result.backupRoute.tradeOff}
          </p>
        )}
      </Card>

      {/* Route to be careful with */}
      <Card icon={<AlertOctagon className="h-4 w-4" />} eyebrow="Route to be careful with" tone="rose">
        <h3 className="text-base font-semibold text-white">{result.routeToAvoid.title}</h3>
        {result.routeToAvoid.whyRisky && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-1">Why this is risky for you</p>
            <p className="text-sm text-gray-200 leading-relaxed">{result.routeToAvoid.whyRisky}</p>
          </div>
        )}
        {result.routeToAvoid.whenItMightWork && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-1">When it might still work</p>
            <p className="text-sm text-gray-300 leading-relaxed">{result.routeToAvoid.whenItMightWork}</p>
          </div>
        )}
      </Card>

      {/* Local realism card removed in Release 1 — local realism is communicated
          through verified opportunities (ships Release 3), not interpretive prose. */}

      {/* First moves */}
      {result.firstMoves?.length > 0 && (
        <Card icon={<ListChecks className="h-4 w-4" />} eyebrow="First 3 moves" tone="amber">
          <ol className="space-y-2">
            {result.firstMoves.map((m, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-300 text-gray-900 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-200 leading-relaxed">{m}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {(() => {
        const sources = getSourcesForResult(role, answers, result);
        return (
          <>
            <WhyThisResult role={role} answers={answers} result={result} sources={sources} />
            <SourcesPanel sources={sources} />
          </>
        );
      })()}

      {role.role_slug && (
        <div id="support-matches" className="scroll-mt-20">
          <SupportMatches
            roleSlug={role.role_slug}
            roleName={role.role_name}
            variant="dark"
            max={3}
          />
        </div>
      )}

      <div id="save-decision" className="scroll-mt-20">
        <SavePrompt role={role} answers={answers} result={result} />
      </div>

      <ProfileSyncPrompt
        answers={answers}
        initialProfile={initialProfile}
        onProfileSaved={onProfileSaved}
      />

      {/* What next — keeps the user in the journey after receiving the result. */}
      <section
        aria-label="What next"
        className="rounded-xl border border-gray-800 bg-gray-900/60 p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-3">
          What next
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <a
            href="#save-decision"
            className="rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 p-3 text-left transition-colors"
          >
            <p className="text-sm font-semibold text-white leading-snug">Save this decision</p>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Keep this judgement and unlock verified opportunities in your area.
            </p>
          </a>
          <a
            href="#support-matches"
            className="rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 p-3 text-left transition-colors"
          >
            <p className="text-sm font-semibold text-white leading-snug">Find funding &amp; support</p>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Grants, bursaries and access schemes that may apply to this route.
            </p>
          </a>
          <Link
            to="/"
            className="rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 p-3 text-left transition-colors"
          >
            <p className="text-sm font-semibold text-white leading-snug">Compare another career</p>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Reality-check a related role and see which route fits you better.
            </p>
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-amber-200 underline underline-offset-2 hover:text-white"
        >
          Edit answers
        </button>
        {role.role_slug && (
          <Link
            to={`/role/${role.role_slug}`}
            className="text-xs text-gray-300 underline underline-offset-2 hover:text-white"
          >
            Back to role page
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Save prompt ───────────────────────────────────────────────────────────────

export function SavePrompt({
  role,
  answers,
  result,
}: {
  role: RoleContext;
  answers: RealityCheckAnswers;
  result: RealityCheckResult;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const onSave = async () => {
    if (saving || saved) return;
    trackEvent("save_decision_clicked", { role: role.role_name, logged_in: !!user });

    if (!user) {
      stashPendingDecision(role, answers, result);
      navigate(`/signup?redirect=/my-decisions&reason=save`);
      return;
    }

    setSaving(true);
    try {
      const row = await saveDecision(user.id, role, answers, result);
      setSaved(true);
      setSavedId(row?.id ?? null);
      trackEvent("decision_saved", { role: role.role_name });
      toast({
        title: "Saved to My Career Decisions",
        description: "You can come back and compare routes any time.",
      });
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: (e as Error).message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-start gap-3">
        <Check className="h-4 w-4 text-emerald-300 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Saved to My Career Decisions</p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {savedId && (
              <button
                type="button"
                onClick={() => navigate(`/my-decisions/${savedId}/opportunities`)}
                className="text-xs font-medium bg-amber-300 text-gray-900 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
              >
                Find matching opportunities
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/my-decisions")}
              className="text-xs text-emerald-200 underline underline-offset-2 hover:text-white"
            >
              View My Career Decisions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-300/5 p-4">
      <div className="flex items-start gap-2 mb-2">
        <BookmarkPlus className="h-4 w-4 text-amber-300 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Save this decision</p>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            Save this route check to get matching opportunities — apprenticeships, jobs, courses, and support near you.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-2 inline-flex items-center gap-2 text-sm font-medium bg-amber-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
        {saving ? "Saving…" : "Save to My Career Decisions"}
      </button>
      {!user && (
        <p className="text-[11px] text-gray-400 mt-2">
          We'll ask you to create a free account so you can return to it.
        </p>
      )}
    </div>
  );
}

// ── Decision Profile sync prompt ──────────────────────────────────────────────

export function ProfileSyncPrompt({
  answers,
  initialProfile,
  onProfileSaved,
}: {
  answers: RealityCheckAnswers;
  initialProfile: DecisionProfileFields | null;
  onProfileSaved: (p: DecisionProfileFields) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user || done || dismissed) return null;

  const current = answersToProfile(answers);
  if (!hasAnyProfileField(current)) return null;

  const isNew = !initialProfile;
  const isUpdate = !!initialProfile && profilesDiffer(initialProfile, current);
  if (!isNew && !isUpdate) return null;

  const heading = isNew
    ? "Save these answers to your Decision Profile?"
    : "Update your Decision Profile with these answers?";

  const onConfirm = async () => {
    if (saving) return;
    setSaving(true);
    const payload = { user_id: user.id, ...current };
    const { error } = await supabase
      .from("decision_profiles")
      .upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save profile", description: error.message, variant: "destructive" });
      return;
    }
    onProfileSaved(current);
    setDone(true);
    toast({
      title: isNew ? "Decision Profile saved" : "Decision Profile updated",
      description: "Clear Routes will use these constraints next time.",
    });
  };

  return (
    <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
      <div className="flex items-start gap-2 mb-2">
        <UserCog className="h-4 w-4 text-sky-300 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">{heading}</p>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            Your Decision Profile helps Clear Routes judge routes from your real situation.
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-medium bg-sky-300 text-gray-900 px-3 py-1.5 rounded-lg hover:bg-sky-200 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : isNew ? "Save profile" : "Update profile"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
