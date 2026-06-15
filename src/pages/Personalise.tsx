import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/posthog";
import {
  loadLocalProfile,
  loadRemoteProfile,
  saveLocalProfile,
  saveRemoteProfile,
  type PersonalisationProfile,
} from "@/lib/personalisation";

type ChoiceOption = { label: string; value: string };
type TriValue = true | false | null;

type Step =
  | { kind: "intro" }
  | { kind: "choice"; key: keyof PersonalisationProfile; question: string; options: ChoiceOption[] }
  | { kind: "industry" }
  | { kind: "degree" }
  | { kind: "consent" }
  | { kind: "tri"; key: keyof PersonalisationProfile; question: string; hint?: string }
  | { kind: "done" };

const QUALIFICATIONS = [
  "No qualifications",
  "Functional Skills",
  "GCSEs",
  "A-levels or T Levels",
  "Vocational qualification (NVQ, BTEC etc.)",
  "Degree",
  "Postgraduate qualification",
];

const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–50", "Over 50"];
const EMPLOYMENT = [
  "Employed full-time",
  "Employed part-time",
  "Self-employed",
  "Unemployed",
  "Student",
  "Returning after a career break",
  "Other",
];
const CHANGE_TYPES = [
  "Yes, completely new field",
  "Yes, adjacent move",
  "No, developing in my current field",
  "Not sure yet",
];
const INDUSTRIES = [
  "Retail",
  "Hospitality",
  "Healthcare",
  "Education",
  "Technology",
  "Finance",
  "Construction",
  "Manufacturing",
  "Transport & Logistics",
  "Public sector",
  "Creative & Media",
  "Legal",
  "Energy & Utilities",
  "Agriculture",
  "Other",
];

const toOpts = (xs: string[]): ChoiceOption[] => xs.map((x) => ({ label: x, value: x }));

const steps: Step[] = [
  { kind: "intro" },
  { kind: "choice", key: "age_range", question: "How old are you?", options: toOpts(AGE_RANGES) },
  {
    kind: "choice",
    key: "highest_qualification",
    question: "What is your highest qualification?",
    options: toOpts(QUALIFICATIONS),
  },
  {
    kind: "choice",
    key: "employment_status",
    question: "What is your current situation?",
    options: toOpts(EMPLOYMENT),
  },
  {
    kind: "choice",
    key: "changing_careers",
    question: "Are you changing careers?",
    options: toOpts(CHANGE_TYPES),
  },
  { kind: "industry" },
  { kind: "degree" },
  { kind: "consent" },
  { kind: "tri", key: "is_woman_nb", question: "Do you identify as a woman or non-binary?" },
  {
    kind: "tri",
    key: "has_disability",
    question: "Do you have a disability, long-term health condition, or are you neurodivergent?",
    hint: "Examples: ADHD, autism, dyslexia, physical disability, long-term illness, mental health condition.",
  },
  { kind: "tri", key: "is_care_leaver", question: "Have you ever been in local authority care?" },
  {
    kind: "tri",
    key: "is_refugee",
    question: "Are you a refugee, asylum seeker, or recently arrived in the UK?",
  },
  { kind: "tri", key: "is_veteran", question: "Are you a veteran or military family member?" },
  { kind: "tri", key: "has_criminal_record", question: "Do you have a criminal record?" },
  { kind: "done" },
];

const QUESTION_INDICES = steps
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => s.kind !== "intro" && s.kind !== "consent" && s.kind !== "done")
  .map(({ i }) => i);

const Personalise = () => {
  const [params] = useSearchParams();
  const from = params.get("from");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PersonalisationProfile>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [degreeSubject, setDegreeSubject] = useState("");
  const [industryQuery, setIndustryQuery] = useState("");

  // Hydrate
  useEffect(() => {
    (async () => {
      let p: PersonalisationProfile = loadLocalProfile();
      if (user) {
        const remote = await loadRemoteProfile(user.id);
        p = { ...p, ...remote };
      }
      setProfile(p);
      setDegreeSubject(p.degree_subject || "");
      setIndustryQuery(p.current_industry || "");
      // Resume position
      if (p.personalisation_completed_at) {
        setStepIdx(steps.findIndex((s) => s.kind === "done"));
      } else if (typeof p.personalisation_last_step === "number") {
        setStepIdx(Math.min(p.personalisation_last_step, steps.length - 1));
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const persist = async (patch: PersonalisationProfile) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveLocalProfile(next);
    if (user) await saveRemoteProfile(user.id, patch);
  };

  const goTo = async (idx: number) => {
    const bounded = Math.max(0, Math.min(idx, steps.length - 1));
    setStepIdx(bounded);
    await persist({ personalisation_last_step: bounded });
  };

  const advance = () => goTo(stepIdx + 1);
  const back = () => goTo(stepIdx - 1);

  const step = steps[stepIdx];

  const questionNumber = useMemo(() => {
    const pos = QUESTION_INDICES.indexOf(stepIdx);
    return pos === -1 ? null : pos + 1;
  }, [stepIdx]);

  const skipAll = async () => {
    trackEvent("personalisation_skipped", { step: stepIdx });
    if (from) navigate(`/role/${from}`);
    else navigate("/");
  };

  const finish = async () => {
    await persist({ personalisation_completed_at: new Date().toISOString() });
    trackEvent("personalisation_completed");
    setStepIdx(steps.findIndex((s) => s.kind === "done"));
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1" />
        <Footer />
      </div>
    );
  }

  const totalQuestions = QUESTION_INDICES.length;
  const progressValue = questionNumber ? (questionNumber / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Your Decision Profile | Clear Routes</title>
        <meta
          name="description"
          content="Save the constraints used by your Reality-checks — so future route checks reuse your situation, funding and support context."
        />
      </Helmet>
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-10 sm:py-14 max-w-2xl w-full">
        {/* Header row: back + progress + skip */}
        {step.kind !== "intro" && step.kind !== "done" && (
          <div className="flex items-center justify-between gap-3 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={back}
              disabled={stepIdx === 0}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex-1 max-w-[200px]">
              {questionNumber && (
                <>
                  <div className="text-xs text-muted-foreground text-center mb-1">
                    Question {questionNumber} of {totalQuestions}
                  </div>
                  <Progress value={progressValue} className="h-1.5" />
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={skipAll} className="text-muted-foreground">
              Skip
            </Button>
          </div>
        )}

        {step.kind === "intro" && (
          <div className="text-center py-8">
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-foreground">
              Build your Decision Profile.
            </h1>
            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
              A few short questions so every Reality-check reuses your situation — your hours, qualifications, and any
              support you might be relevant for.
            </p>
            <div className="mt-10 flex flex-col gap-3 max-w-sm mx-auto">
              <Button size="lg" onClick={advance}>
                Start
              </Button>
              <Button variant="ghost" onClick={skipAll}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {step.kind === "choice" && (
          <ChoiceQuestion
            question={step.question}
            options={step.options}
            selected={(profile[step.key] as string) || ""}
            onSelect={async (v) => {
              await persist({ [step.key]: v } as PersonalisationProfile);
              setTimeout(advance, 120);
            }}
          />
        )}

        {step.kind === "industry" && (
          <IndustryQuestion
            value={industryQuery}
            onChange={setIndustryQuery}
            onSelect={async (v) => {
              setIndustryQuery(v);
              await persist({ current_industry: v });
              setTimeout(advance, 120);
            }}
          />
        )}

        {step.kind === "degree" && (
          <DegreeQuestion
            hasDegree={profile.has_degree}
            subject={degreeSubject}
            onSubjectChange={setDegreeSubject}
            onAnswer={async (yes) => {
              if (!yes) {
                await persist({ has_degree: false, degree_subject: null as unknown as string });
                setTimeout(advance, 120);
              } else {
                await persist({ has_degree: true });
              }
            }}
            onContinue={async () => {
              await persist({ degree_subject: degreeSubject.trim() || undefined });
              advance();
            }}
          />
        )}

        {step.kind === "consent" && (
          <div className="py-4">
            <h2 className="font-display text-2xl sm:text-3xl font-medium text-foreground">
              Optional support and funding questions
            </h2>
            <p className="mt-4 text-muted-foreground">
              The next questions help us show support programmes and funding opportunities you may be
              eligible for. Your answers are private and are never shared with providers.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Button
                size="lg"
                onClick={async () => {
                  await persist({ consented_sensitive: true });
                  advance();
                }}
              >
                Continue
              </Button>
              <Button variant="ghost" onClick={finish}>
                Skip remaining questions
              </Button>
            </div>
          </div>
        )}

        {step.kind === "tri" && (
          <TriQuestion
            question={step.question}
            hint={step.hint}
            selected={profile[step.key] as TriValue | undefined}
            onSelect={async (v) => {
              await persist({ [step.key]: v } as PersonalisationProfile);
              // Last tri question → finish
              if (stepIdx === steps.findIndex((s) => s.kind === "done") - 1) {
                await finish();
              } else {
                setTimeout(advance, 120);
              }
            }}
          />
        )}

        {step.kind === "done" && (
          <div className="text-center py-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-foreground">
              Your Decision Profile is saved.
            </h1>
            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
              Future Reality-checks will reuse this, and we'll surface support and funding that may be relevant where it
              fits the role.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              {from ? (
                <Button asChild size="lg">
                  <Link to={`/role/${from}`}>Reality-check this role</Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/">Reality-check a career</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/my-decisions">View saved decisions</Link>
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

const ChoiceQuestion = ({
  question,
  options,
  selected,
  onSelect,
}: {
  question: string;
  options: ChoiceOption[];
  selected: string;
  onSelect: (v: string) => void;
}) => (
  <div>
    <h2 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-8">{question}</h2>
    <div className="flex flex-col gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onSelect(o.value)}
          className={`text-left rounded-xl border px-5 py-4 text-base transition-colors ${
            selected === o.value
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-background hover:border-foreground/40 hover:bg-muted/40 text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const TriQuestion = ({
  question,
  hint,
  selected,
  onSelect,
}: {
  question: string;
  hint?: string;
  selected: TriValue | undefined;
  onSelect: (v: TriValue) => void;
}) => {
  const options: { label: string; value: TriValue }[] = [
    { label: "Yes", value: true },
    { label: "No", value: false },
    { label: "Prefer not to say", value: null },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-2">{question}</h2>
      {hint && <p className="text-sm text-muted-foreground mb-6">{hint}</p>}
      <div className="flex flex-col gap-3 mt-6">
        {options.map((o) => {
          const isSelected = selected === o.value;
          return (
            <button
              key={String(o.value)}
              onClick={() => onSelect(o.value)}
              className={`text-left rounded-xl border px-5 py-4 text-base transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:border-foreground/40 hover:bg-muted/40 text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const IndustryQuestion = ({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
}) => {
  const filtered = INDUSTRIES.filter((i) => i.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-2">
        Which industry do you currently work in?
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Start typing or pick from the list.</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Healthcare, Technology, Retail"
        className="h-12 text-base"
      />
      <div className="flex flex-col gap-2 mt-4">
        {filtered.map((i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="text-left rounded-lg border border-border bg-background px-4 py-3 hover:border-foreground/40 hover:bg-muted/40 text-foreground"
          >
            {i}
          </button>
        ))}
        {value.trim() && !INDUSTRIES.some((i) => i.toLowerCase() === value.trim().toLowerCase()) && (
          <button
            onClick={() => onSelect(value.trim())}
            className="text-left rounded-lg border border-primary bg-primary/5 px-4 py-3 text-foreground"
          >
            Use "{value.trim()}"
          </button>
        )}
      </div>
    </div>
  );
};

const DegreeQuestion = ({
  hasDegree,
  subject,
  onSubjectChange,
  onAnswer,
  onContinue,
}: {
  hasDegree: boolean | undefined;
  subject: string;
  onSubjectChange: (v: string) => void;
  onAnswer: (yes: boolean) => void;
  onContinue: () => void;
}) => (
  <div>
    <h2 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-8">
      Do you already have a degree?
    </h2>
    <div className="flex flex-col gap-3">
      {[
        { label: "Yes", value: true },
        { label: "No", value: false },
      ].map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onAnswer(o.value)}
          className={`text-left rounded-xl border px-5 py-4 text-base transition-colors ${
            hasDegree === o.value
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-background hover:border-foreground/40 hover:bg-muted/40 text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
    {hasDegree === true && (
      <div className="mt-8">
        <label className="block text-sm font-medium text-foreground mb-2">
          What subject is your degree in?
        </label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="e.g. Software Engineering"
          className="h-12 text-base"
        />
        <Button className="mt-4 w-full sm:w-auto" size="lg" onClick={onContinue} disabled={!subject.trim()}>
          Continue
        </Button>
      </div>
    )}
  </div>
);

export default Personalise;
