import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet-async";

const faqSections = [
  {
    heading: "About Clear Routes",
    questions: [
      {
        q: "What is Clear Routes?",
        a: "Clear Routes helps you reality-check a career route before you commit time or money to it. You pick a role from a library of 1,000 UK careers, tell us a bit about your situation, and get a route judgement: the best route in for you, a backup route, a route to avoid, what's realistic locally, and a first move to make this week. You can save any check as a career decision and revisit it later.",
      },
      {
        q: "Is Clear Routes free?",
        a: "Yes — the core product is free. Reality-checks, saved career decisions, the Decision Profile, role pages and support matching are all free to use. There is no subscription and no unlock.",
      },
      {
        q: "How is Clear Routes different from the National Careers Service?",
        a: "The National Careers Service gives broad, generic guidance. Clear Routes is decision-first. Instead of just describing a job, it judges a route in for someone in your situation — what's worth trying, what to avoid, and what's realistic given pay, competition, training options and where you live.",
      },
      {
        q: "Is Clear Routes only for the UK?",
        a: "Yes. Salary ranges, training providers, apprenticeships and support organisations are UK-specific. If you're outside the UK the route judgements will not apply to your situation.",
      },
    ],
  },
  {
    heading: "Reality-check, decisions and your profile",
    questions: [
      {
        q: "What is a Reality-check?",
        a: "A Reality-check is a short set of questions about your situation — time, money, qualifications, location, constraints — applied to a specific role. It returns a route judgement with a best route in, a backup, a route to avoid, a read on local realism, and a first move you can make this week. It is AI-assisted guidance, not a guarantee of outcome.",
      },
      {
        q: "What is My Career Decisions?",
        a: "My Career Decisions is your workspace for saved route checks. When a Reality-check gives you a judgement you'd like to keep, save it. You can come back, compare it against other roles you've checked, and update it as your situation changes.",
      },
      {
        q: "What is the Decision Profile?",
        a: "The Decision Profile is the set of constraints you've told us about — for example available hours, budget for training, whether you can relocate, and qualifications. Once it's filled in, future Reality-checks reuse it so you don't have to re-enter the same information for every role.",
      },
      {
        q: "How does support and funding matching work?",
        a: "If you've shared relevant details in your Decision Profile — for example being a care leaver, a veteran, disabled, a refugee, or under 25 — we surface UK funded support programmes that may be relevant to your situation. We say 'may be relevant', not 'you qualify'. Eligibility is always decided by the named programme, not by us, so always verify directly before relying on it.",
      },
      {
        q: "How accurate is the route judgement?",
        a: "It's a considered judgement based on your answers and our editorial data on the role. It is not a prediction, not regulated careers advice, and not a guarantee of any outcome. Use it as a structured second opinion alongside your own research and, where the decision is significant, a qualified careers adviser.",
      },
    ],
  },
  {
    heading: "Role pages",
    questions: [
      {
        q: "Where do the roles come from?",
        a: "We curate a library of 1,000 UK roles, from the very common (Software Engineer, Primary Teacher, Nurse) to the niche (Wind Turbine Technician, Forensic Accountant, Patent Attorney). The list is built from ONS occupation data, UCAS subject areas, government apprenticeship standards, and direct provider listings.",
      },
      {
        q: "How are the four pathways chosen?",
        a: "Each role shows up to four realistic ways in: school leaver, graduate, adjacent career, and no background. These are hand-written per role from a single source spreadsheet. If a route genuinely does not exist for a role, we say so rather than invent one.",
      },
      {
        q: "How accurate are the salary figures?",
        a: "Salary ranges are based on ONS Annual Survey of Hours and Earnings, current UK job postings, and sector reports. We show ranges by experience level (entry, mid, senior) rather than single numbers, and flag where London skews the figure. Each role page shows when the data was last reviewed.",
      },
      {
        q: "What does the AI impact badge mean?",
        a: "Each role is labelled low, medium, or high AI exposure based on published research (notably OECD and ONS automation studies, plus more recent generative-AI exposure indices). Low means the day-to-day work is largely safe from automation in the next 5–10 years. High means substantial parts of the role are already being automated.",
      },
    ],
  },
  {
    heading: "Providers, apprenticeships and support",
    questions: [
      {
        q: "How do you choose which training providers to list?",
        a: "Providers are curated from Ofsted-rated training organisations, recognised UK universities, registered Skills Bootcamp providers on the DfE list, and established professional bodies. We do not accept payment from providers to appear.",
      },
      {
        q: "What is a Skills Bootcamp?",
        a: "Skills Bootcamps are free or heavily subsidised UK training programmes funded by the Department for Education, typically 12–16 weeks long. Availability depends on your region and the Combined Authority you live under. Where a role page lists a bootcamp provider, we link to the official course page so you can check current eligibility.",
      },
      {
        q: "What is a degree apprenticeship?",
        a: "A degree apprenticeship lets you earn a full UK degree while working and being paid, with your tuition fees covered by your employer. They typically take 3–4 years.",
      },
      {
        q: "What's on the Support page?",
        a: "The /support page lists UK funded programmes and organisations that may be relevant to specific groups — under-25s, care leavers, disabled people, women and non-binary people, veterans, people with criminal records, refugees, and career changers. Eligibility is always decided by the named programme.",
      },
    ],
  },
  {
    heading: "Trust, sources and corrections",
    questions: [
      {
        q: "Where is your data sourced?",
        a: "Salary data: ONS ASHE and current UK job board postings. Apprenticeships: the Institute for Apprenticeships standards and gov.uk Find an Apprenticeship. Providers: Ofsted, the DfE Skills Bootcamps register, UCAS, and direct listings. Funding and support: gov.uk, Combined Authorities, and the named organisations. The /sources page lists everything in one place.",
      },
      {
        q: "How often is the data refreshed?",
        a: "Salaries and competition signals are reviewed quarterly. Apprenticeships, bootcamp availability, and funded support are reviewed at least twice a year and after every government spending announcement. Each role page shows a 'last reviewed' date.",
      },
      {
        q: "How is AI used in the product?",
        a: "Role page content — pathways, salaries, competition signals, provider lists — is hand-curated, not AI-generated. The Reality-check route judgement is AI-assisted: it combines your answers with our editorial data on the role to form a judgement. We show you the judgement, not raw model output, and we don't use it to invent providers, salaries or eligibility.",
      },
      {
        q: "How do I report something that is wrong?",
        a: "Email hello@clearroutes.co.uk with the role or provider and what is wrong. We investigate and correct verified inaccuracies as quickly as we can.",
      },
      {
        q: "Do you give regulated careers or financial advice?",
        a: "No. Clear Routes is an information service, not a regulated careers adviser and not a financial adviser. For regulated guidance speak to the National Careers Service, a qualified careers adviser, or — for money matters — an FCA-regulated adviser.",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqSections.flatMap((section) =>
    section.questions.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

const Faq = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>FAQ — Clear Routes | Honest UK career information</title>
        <meta
          name="description"
          content="Frequently asked questions about Clear Routes — how role pages work, where the data comes from, how we choose providers, and why everything is free."
        />
        <link rel="canonical" href="https://clearroutes.co.uk/faq" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
          <header className="mb-12">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-muted-foreground">
              Honest answers about how Clear Routes works.
            </p>
          </header>

          {faqSections.map((section) => (
            <section key={section.heading} className="mb-12">
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6 border-b border-border pb-3">
                {section.heading}
              </h2>

              <div className="space-y-8">
                {section.questions.map((item) => (
                  <article key={item.q}>
                    <h3 className="font-display text-base md:text-lg font-semibold text-foreground mb-2">
                      {item.q}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">{item.a}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Faq;
