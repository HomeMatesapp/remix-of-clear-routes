import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, GraduationCap, ClipboardList, AlertTriangle, BarChart3 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const enquirySchema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  work_email: z.string().trim().email("Enter a valid work email").max(255),
  institution: z.string().trim().min(1, "Required").max(200),
  job_title: z.string().trim().min(1, "Required").max(150),
  learner_count: z.string().trim().max(50).optional(),
  message: z.string().trim().min(1, "Required").max(2000),
  enquiry_type: z.enum(["demo", "pilot"]),
  contact_consent: z.literal(true, {
    errorMap: () => ({ message: "Please tick to consent" }),
  }),
});

const ForInstitutions = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    work_email: "",
    institution: "",
    job_title: "",
    learner_count: "",
    message: "",
    enquiry_type: "demo" as "demo" | "pilot",
    contact_consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = enquirySchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    const data = parsed.data as {
      name: string;
      work_email: string;
      institution: string;
      job_title: string;
      learner_count?: string;
      message: string;
      enquiry_type: "demo" | "pilot";
      contact_consent: true;
    };
    const { error } = await supabase.from("institution_enquiries").insert(data);
    setSubmitting(false);
    if (error) {
      toast({
        title: "Could not send enquiry",
        description: "Please try again, or email hello@clearroutes.co.uk.",
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
  };

  const scrollToForm = (type: "demo" | "pilot") => {
    setForm((f) => ({ ...f, enquiry_type: type }));
    document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>For institutions — Clear Routes for schools and colleges</title>
        <meta
          name="description"
          content="Clear Routes helps Careers Leaders in schools and colleges reality-check student career choices before commitment — reducing dropout risk and wasted course funding."
        />
      </Helmet>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 pt-14 pb-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">For schools & colleges</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-medium text-foreground">
            Help students pick a route they're more likely to finish.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Clear Routes gives Careers Leaders a structured way to reality-check a student's career
            choice before they commit to a course, apprenticeship or training programme — surfacing
            budget conflicts, qualification gaps and routes that don't fit a student's need to earn.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => scrollToForm("demo")}>Request a demonstration</Button>
            <Button variant="outline" onClick={() => scrollToForm("pilot")}>
              Discuss a pilot
            </Button>
          </div>
        </section>

        {/* How it helps */}
        <section className="container mx-auto px-4 py-10 max-w-3xl">
          <h2 className="font-display text-2xl font-medium text-foreground">How Clear Routes helps</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground">
            Students often pick a route that doesn't match their financial reality, prior
            qualifications or local options — and discover the mismatch months or years in. That
            costs them time and savings, and costs the institution funding through dropouts and
            transfers.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground">
            Clear Routes runs each student's chosen role through a structured reality-check and
            returns a route judgement: the best route in for them, a backup, a route to be careful
            with, and the first concrete next step. Staff see where the friction is before the
            student commits.
          </p>
        </section>

        {/* Workflow */}
        <section className="container mx-auto px-4 py-10 max-w-3xl">
          <h2 className="font-display text-2xl font-medium text-foreground">
            Careers Leader and student workflow
          </h2>
          <ol className="mt-6 space-y-4">
            {[
              {
                icon: GraduationCap,
                title: "Student reality-checks a role",
                body: "The student picks a role they're considering and answers short questions about their situation — income need, hours, location, qualifications.",
              },
              {
                icon: ClipboardList,
                title: "They get a route judgement",
                body: "Best route in, backup route, route to be careful with, local realism, and a first move. They can save the decision to their account.",
              },
              {
                icon: BarChart3,
                title: "Careers Leader sees the cohort view",
                body: "Staff see aggregated patterns across the cohort: where students are heading, where the friction is, and who may need a follow-up conversation.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-border bg-card p-5">
                <div className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* What staff can identify */}
        <section className="container mx-auto px-4 py-10 max-w-3xl">
          <h2 className="font-display text-2xl font-medium text-foreground">
            Problems staff can identify earlier
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              {
                title: "Budget conflicts",
                body: "A student picks a route that requires unpaid placements or relocation costs they can't absorb.",
              },
              {
                title: "Qualification gaps",
                body: "A route that needs a specific GCSE, A-level or maths grade the student hasn't got — and a realistic way to bridge it.",
              },
              {
                title: "Routes that don't fit a need to earn",
                body: "A long unpaid training route picked by a student who needs income from month one.",
              },
              {
                title: "Local opportunity mismatch",
                body: "A route with very few local employers or training places within commuting distance.",
              },
            ].map(({ title, body }, i) => (
              <li key={i} className="flex gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-1 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-foreground">{title}.</span>{" "}
                  <span className="text-sm text-muted-foreground">{body}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Dashboard summary */}
        <section className="container mx-auto px-4 py-10 max-w-3xl">
          <h2 className="font-display text-2xl font-medium text-foreground">
            What the institution dashboard includes
          </h2>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Cohort overview of roles students are reality-checking",
              "Flagged students with route-fit issues worth a conversation",
              "Aggregated qualification gaps across the cohort",
              "Local realism patterns by postcode area",
              "Export of anonymised cohort data for reporting",
              "Staff invites and role-based access",
            ].map((item) => (
              <li key={item} className="flex gap-2 rounded-lg border border-border bg-card p-4">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Sensitive personal support circumstances are not shared with staff by default.
          </p>
        </section>

        {/* Pricing */}
        <section className="container mx-auto px-4 py-10 max-w-3xl">
          <h2 className="font-display text-2xl font-medium text-foreground">Indicative pricing</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Pricing depends on cohort size and implementation requirements. Figures below are
            indicative and subject to pilot validation — they are not a fixed price list.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">Pilot</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For one cohort during a limited pilot period.
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                Pricing discussed based on cohort size.
              </p>
            </div>
            <div className="rounded-xl border-2 border-primary bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">School or college licence</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For ongoing use across multiple cohorts.
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                Indicative from <span className="text-foreground">£2,500 / year</span>, subject to
                pilot validation.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">Multi-site or partnership</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For college groups, trusts or larger organisations.
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">Contact us for pricing.</p>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section
          id="contact-form"
          className="container mx-auto px-4 py-12 max-w-2xl scroll-mt-20"
        >
          <h2 className="font-display text-2xl font-medium text-foreground">
            Request a demonstration or discuss a pilot
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Tell us a bit about your institution and we'll be in touch.
          </p>

          {submitted ? (
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Thanks — your enquiry has been received.</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We'll reply by email within a few working days. If it's urgent, email
                hello@clearroutes.co.uk.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <div className="flex gap-3 flex-wrap">
                {(["demo", "pilot"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, enquiry_type: t }))}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      form.enquiry_type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {t === "demo" ? "Request a demonstration" : "Discuss a pilot"}
                  </button>
                ))}
              </div>

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={100}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="work_email">Work email</Label>
                <Input
                  id="work_email"
                  type="email"
                  value={form.work_email}
                  onChange={(e) => setForm({ ...form, work_email: e.target.value })}
                  maxLength={255}
                />
                {errors.work_email && (
                  <p className="text-xs text-destructive mt-1">{errors.work_email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  maxLength={200}
                />
                {errors.institution && (
                  <p className="text-xs text-destructive mt-1">{errors.institution}</p>
                )}
              </div>

              <div>
                <Label htmlFor="job_title">Job title</Label>
                <Input
                  id="job_title"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  maxLength={150}
                />
                {errors.job_title && (
                  <p className="text-xs text-destructive mt-1">{errors.job_title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="learner_count">Approximate number of learners</Label>
                <Input
                  id="learner_count"
                  placeholder="e.g. 120"
                  value={form.learner_count}
                  onChange={(e) => setForm({ ...form, learner_count: e.target.value })}
                  maxLength={50}
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  maxLength={2000}
                />
                {errors.message && (
                  <p className="text-xs text-destructive mt-1">{errors.message}</p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="consent"
                  checked={form.contact_consent}
                  onCheckedChange={(v) =>
                    setForm({ ...form, contact_consent: v === true })
                  }
                />
                <Label
                  htmlFor="consent"
                  className="text-sm font-normal text-muted-foreground leading-relaxed"
                >
                  I consent to Clear Routes contacting me about this enquiry. We will not share
                  your details with third parties.
                </Label>
              </div>
              {errors.contact_consent && (
                <p className="text-xs text-destructive">{errors.contact_consent}</p>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send enquiry"}
              </Button>
            </form>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ForInstitutions;
