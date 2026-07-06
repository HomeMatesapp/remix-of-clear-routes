// Config-driven Reality Check wizard.
//
// Renders any resolved questionnaire config against the Field Map visual
// system. Role-specific behaviour lives entirely in the config — the
// renderer must not know which role it is rendering.
//
// Role-specific concerns live in:
//   - questionnaire config (questions + display copy)
//   - config.extractSignals (typed signal extraction)
//   - config.requestBodyKey (edge-function payload shape)
//   - the role's route engine + adapter
//
// The wizard just walks the resolved question list, persists a role-scoped
// v3 draft, and hands the extracted signals to the edge function.

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import type { RealityCheckResult, RoleContext } from "@/lib/reality-check/types";
import type { ResolvedConfig } from "@/lib/reality-check/questionnaire/types";
import type { AnswerMap, InlineTextMap, Question } from "@/lib/reality-check/questionnaire/types";
import {
  isAnswered,
  sanitiseAnswer,
  sanitiseAnswerMap,
  sanitiseInlineText,
  toggleMultiSelect,
} from "@/lib/reality-check/questionnaire/sanitise";
import {
  clearModularDraft,
  invalidateLegacyDraftForRole,
  loadModularDraft,
  saveModularDraft,
} from "@/lib/reality-check/questionnaire/draft-v3";


const REVIEW_ID = "__review__";

const PAPER_INPUT =
  "w-full rounded-md bg-white border-2 border-ink px-3 py-2.5 text-[15px] text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-path focus:ring-offset-0";

// ── Small UI helpers matching the Field Map palette ──────────────────────────

function ChipRow({
  q,
  value,
  onPick,
  disabled,
}: {
  q: Question;
  value: string | null;
  onPick: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {(q.options ?? []).map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onPick(o.value)}
            className={[
              "font-body font-bold text-[15px] leading-tight text-left",
              "border-2 rounded-full px-5 py-3 transition-colors",
              "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
              active ? "bg-path border-path text-white" : "bg-white border-ink text-ink hover:border-path hover:text-path",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChipMulti({
  q,
  values,
  onToggle,
  disabled,
  maxReached,
}: {
  q: Question;
  values: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
  maxReached: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {(q.options ?? []).map((o) => {
        const active = values.includes(o.value);
        const disabledByMax = !active && !o.exclusive && maxReached;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled || disabledByMax}
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={[
              "font-body font-bold text-[15px] leading-tight text-left",
              "border-2 rounded-full px-5 py-3 transition-colors",
              "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
              active ? "bg-path border-path text-white" : "bg-white border-ink text-ink hover:border-path hover:text-path",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function QuestionCard({
  q,
  answers,
  inlineText,
  setAnswer,
  setInlineText,
  submitting,
}: {
  q: Question;
  answers: AnswerMap;
  inlineText: InlineTextMap;
  setAnswer: (id: string, v: string | string[]) => void;
  setInlineText: (id: string, v: string) => void;
  submitting: boolean;
}) {
  const currentValue = answers[q.id];
  const multiValues = Array.isArray(currentValue) ? currentValue : [];
  const maxReached = !!q.maxSelections && multiValues.filter((v) => !(q.options ?? []).find((o) => o.value === v)?.exclusive).length >= q.maxSelections;

  const triggerActive =
    !!q.conditionalField &&
    (Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue as string] : [])
      .some((v) => q.conditionalField!.showWhenValueIn.includes(v));

  return (
    <div>
      <h1 className="font-display font-extrabold text-ink tracking-[-0.02em] leading-[1.08] text-[clamp(26px,4.4vw,40px)]">
        {q.title}
      </h1>
      {q.helpText && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-[hsl(90_10%_28%)] max-w-[56ch]">{q.helpText}</p>
      )}
      <div className="mt-6">
        {q.controlType === "single_select" && (
          <ChipRow q={q} value={typeof currentValue === "string" ? currentValue : null} onPick={(v) => setAnswer(q.id, v)} disabled={submitting} />
        )}
        {q.controlType === "multi_select" && (
          <ChipMulti q={q} values={multiValues} onToggle={(v) => setAnswer(q.id, toggleMultiSelect(q, multiValues, v))} disabled={submitting} maxReached={maxReached} />
        )}
        {q.controlType === "multi_select" && q.maxSelections && (
          <p className="mt-2 text-[12.5px] font-mono text-muted-foreground">
            {multiValues.filter((v) => !(q.options ?? []).find((o) => o.value === v)?.exclusive).length}/{q.maxSelections} selected
            {maxReached && " — deselect one to choose another"}
          </p>
        )}
        {q.controlType === "text" && (
          <input
            type="text"
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            disabled={submitting}
            className={PAPER_INPUT}
          />
        )}
        {q.conditionalField && triggerActive && (
          <div className="mt-5">
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              {q.conditionalField.label} (optional)
            </label>
            <input
              type="text"
              value={inlineText[q.id] ?? ""}
              onChange={(e) => setInlineText(q.id, e.target.value)}
              placeholder={q.conditionalField.placeholder}
              disabled={submitting}
              className={PAPER_INPUT}
            />
            {q.conditionalField.hint && (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-snug">{q.conditionalField.hint}</p>
            )}
          </div>
        )}
      </div>
      <details className="mt-6 group">
        <summary className="font-mono text-[12.5px] text-muted-foreground cursor-pointer list-none inline-flex items-center gap-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path rounded">
          <span aria-hidden="true">ⓘ</span> Why we ask
        </summary>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[hsl(90_10%_28%)] max-w-[60ch] border-l-[3px] border-contour pl-3.5">
          {q.whyWeAsk}
        </p>
      </details>
    </div>
  );
}

// Machine value → human label for review.
const labelFor = (q: Question, v: string): string =>
  (q.options ?? []).find((o) => o.value === v)?.label ?? v;

function ReviewCard({
  config,
  answers,
  inlineText,
}: {
  config: ResolvedConfig;
  answers: AnswerMap;
  inlineText: InlineTextMap;
}) {
  const rows: { label: string; value: string }[] = [];
  for (const q of config.questions) {
    const a = answers[q.id];
    let display = "";
    if (Array.isArray(a)) display = a.map((v) => labelFor(q, v)).join(", ");
    else if (typeof a === "string") display = q.options ? labelFor(q, a) : a;
    if (!display) continue;
    rows.push({ label: q.title.replace(/\?$/, ""), value: display });
    if (q.conditionalField && inlineText[q.id]?.trim()) {
      rows.push({ label: q.conditionalField.label.replace(/\.$/, ""), value: inlineText[q.id].trim() });
    }
  }
  const startingPointAnswer = typeof answers.starting_point === "string" ? answers.starting_point : "";
  const unresolvedStart = startingPointAnswer === "none_fit" || startingPointAnswer === "not_sure_yet";

  return (
    <div>
      <h1 className="font-display font-extrabold text-ink tracking-[-0.02em] leading-[1.08] text-[clamp(24px,3.6vw,34px)]">
        Check your answers
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[hsl(90_10%_28%)] max-w-[56ch]">
        Review what you have told us before we compare the possible routes.
      </p>
      <dl className="mt-6 rounded-md border-2 border-ink divide-y-2 divide-ink/10 bg-white">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-1 sm:gap-4 px-4 py-3">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{row.label}</dt>
            <dd className="text-[15px] text-ink break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      {unresolvedStart && (
        <div className="mt-4 rounded-md border-l-4 border-path bg-tint px-3 py-2.5">
          <p className="text-[13.5px] text-ink leading-snug">
            We couldn't identify your current starting point from the standard options. Your result will still work but may be less specific.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export interface ModularRealityCheckWizardProps {
  role: RoleContext & { role_slug: string; role_name: string };
  config: ResolvedConfig;
  onResult: (result: RealityCheckResult, answers: AnswerMap, inlineText: InlineTextMap) => void;
}

export function ModularRealityCheckWizard({ role, config, onResult }: ModularRealityCheckWizardProps) {

  const { toast } = useToast();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [inlineText, setInlineTextState] = useState<InlineTextMap>({});
  const [stepId, setStepId] = useState<string>(config.questions[0]?.id ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from role-scoped v3 draft; invalidate any legacy v2 draft for
  // Electrician (its questions no longer match).
  useEffect(() => {
    invalidateLegacyDraftForRole(role.role_slug);
    const draft = loadModularDraft(role.role_slug, config.questionnaireVersion);
    if (draft) {
      const cleanAnswers = sanitiseAnswerMap(config.questions, draft.answers);
      const cleanInline = sanitiseInlineText(config.questions, cleanAnswers, draft.inlineText);
      setAnswers(cleanAnswers);
      setInlineTextState(cleanInline);
      const visibleIds = config.questions.map((q) => q.id).concat(REVIEW_ID);
      setStepId(visibleIds.includes(draft.stepId) ? draft.stepId : (config.questions[0]?.id ?? ""));
    }
    setHydrated(true);
  }, [role.role_slug, config]);

  // Persist on every change (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    saveModularDraft({
      roleSlug: role.role_slug,
      questionnaireVersion: config.questionnaireVersion,
      answers,
      inlineText,
      stepId,
    });
  }, [hydrated, role.role_slug, config.questionnaireVersion, answers, inlineText, stepId]);

  const questionIds = useMemo(() => config.questions.map((q) => q.id), [config]);
  const visibleIds = useMemo(() => [...questionIds, REVIEW_ID], [questionIds]);
  const totalQuestions = questionIds.length;
  const safeIndex = Math.max(0, visibleIds.indexOf(stepId));
  const currentId = visibleIds[safeIndex];
  const isReview = currentId === REVIEW_ID;
  const currentQuestion = !isReview ? config.questions.find((q) => q.id === currentId) : null;

  const currentQuestionNumber = isReview ? totalQuestions : Math.min(safeIndex + 1, totalQuestions);
  const progressPct = Math.round((currentQuestionNumber / Math.max(1, totalQuestions)) * 100);

  const setAnswer = (id: string, v: string | string[]) => {
    const q = config.questions.find((x) => x.id === id);
    if (!q) return;
    const cleaned = sanitiseAnswer(q, v);
    setAnswers((prev) => {
      const next = { ...prev };
      if (cleaned === undefined) delete next[id];
      else next[id] = cleaned;
      // Clear inline text if the trigger option is no longer selected.
      setInlineTextState((prevInline) => sanitiseInlineText(config.questions, next, prevInline));
      return next;
    });
  };

  const setInlineText = (id: string, v: string) => {
    setInlineTextState((prev) => ({ ...prev, [id]: v }));
  };

  const canAdvance = isReview
    ? config.questions.every((q) => isAnswered(q, answers[q.id]))
    : currentQuestion
    ? isAnswered(currentQuestion, answers[currentQuestion.id])
    : false;

  const goNext = async () => {
    if (isReview) return submit();
    setStepId(visibleIds[Math.min(safeIndex + 1, visibleIds.length - 1)]);
  };
  const goBack = () => setStepId(visibleIds[Math.max(safeIndex - 1, 0)]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    // Final sanitisation so nothing hidden leaks through.
    const cleanedAnswers = sanitiseAnswerMap(config.questions, answers);
    const cleanedInline = sanitiseInlineText(config.questions, cleanedAnswers, inlineText);
    const signals = config.extractSignals(cleanedAnswers, cleanedInline);
    const startingPointForAnalytics =
      typeof cleanedAnswers.starting_point === "string" ? cleanedAnswers.starting_point : null;
    const trainingBudgetForAnalytics =
      typeof cleanedAnswers.training_budget === "string" ? cleanedAnswers.training_budget : null;
    trackEvent("reality_check_submitted", {
      role: role.role_name,
      questionnaire_version: config.questionnaireVersion,
      starting_point: startingPointForAnalytics,
      training_budget: trainingBudgetForAnalytics,
    });
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("reality-check", {
        body: { role, answers: {}, [config.requestBodyKey]: signals },
      });

      if (fnErr) throw fnErr;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const result = (data as { result: RealityCheckResult }).result;
      trackEvent("reality_check_result", { role: role.role_name, verdict: result?.overallVerdict });
      clearModularDraft(role.role_slug, config.questionnaireVersion);
      onResult(result, cleanedAnswers, cleanedInline);
    } catch (e) {
      const msg = (e as Error).message || "Something went wrong. Try again.";
      setError(msg);
      toast({ title: "Couldn't reality-check", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center gap-3 px-6 py-3.5 bg-tint border-b-2 border-ink">
        <span className="font-mono text-[12px] tracking-[0.14em] uppercase text-muted-foreground">
          {isReview ? `Review · ${totalQuestions} questions` : `Question ${currentQuestionNumber} of ${totalQuestions}`}
        </span>
        <span className="flex-1 max-w-[220px] h-[6px] border-[1.5px] border-ink rounded-full overflow-hidden bg-white" aria-hidden="true">
          <span className="block h-full bg-path transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </span>
      </div>

      {config.scopeNote && !isReview && (
        <p className="px-6 sm:px-10 pt-4 text-[13px] leading-snug text-muted-foreground border-b border-dashed border-[hsl(40_15%_82%)] pb-4">
          {config.scopeNote}
        </p>
      )}

      <div key={currentId} className="p-6 sm:p-10">
        {isReview ? (
          <ReviewCard config={config} answers={answers} inlineText={inlineText} />
        ) : currentQuestion ? (
          <QuestionCard
            q={currentQuestion}
            answers={answers}
            inlineText={inlineText}
            setAnswer={setAnswer}
            setInlineText={setInlineText}
            submitting={submitting}
          />
        ) : null}
        {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 px-6 py-4 border-t-2 border-dashed border-[hsl(40_15%_82%)]">
        <button
          type="button"
          onClick={goBack}
          disabled={safeIndex === 0 || submitting}
          className="font-body font-bold text-[15px] bg-transparent border-2 border-transparent text-muted-foreground px-4 py-2.5 rounded-[5px] hover:text-ink hover:border-ink disabled:opacity-35 disabled:cursor-default disabled:hover:border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance || submitting}
          className="font-display font-bold text-[16px] bg-path text-white border-0 px-7 py-3.5 rounded-[5px] hover:bg-ink disabled:bg-[hsl(40_15%_82%)] disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-path focus-visible:ring-offset-2 focus-visible:ring-offset-white inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Finding your route…" : isReview ? "Show my realistic routes →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
