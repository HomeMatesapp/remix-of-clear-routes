import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>Terms of Service — Clear Routes</title>
        <meta name="description" content="Terms of Service for Clear Routes — UK career information platform." />
        <link rel="canonical" href="https://clearroutes.co.uk/terms" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />

        <main className="flex-1 container mx-auto px-4 py-12 md:py-20 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8">
            Terms of Service
          </h1>

          <p className="text-sm text-muted-foreground mb-8">Last updated: 8 June 2026</p>

          <div className="prose prose-sm max-w-none text-muted-foreground space-y-8">
            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">1. About Clear Routes</h2>
              <p>
                Clear Routes is a free UK product that helps people reality-check a career route before committing time or
                money. It includes Reality-check (an AI-assisted route judgement based on your situation), My Career Decisions
                (a workspace for saved route checks), a Decision Profile (your saved constraints), curated role pages, and
                support / funding matching where relevant. By using this website you agree to these terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">2. Free to use</h2>
              <p>
                Clear Routes is free. There is no paid tier, no subscription, and no checkout. If this ever changes we will make any paid
                feature clearly optional and we will not retroactively charge for content you previously accessed for free.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">3. Accounts, decisions and your Decision Profile</h2>
              <p>
                You can use the site without an account. If you create an account, we use it to store your saved career
                decisions (saved route checks) and your Decision Profile (the constraints you enter, such as available
                hours, training budget, qualifications and location). You are responsible for keeping your login
                credentials secure and for the accuracy of the information you enter. You can ask us to delete your
                account at any time by emailing hello@clearroutes.co.uk.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">4. What we provide — and what we don't</h2>
              <p>
                Clear Routes provides curated UK careers information and AI-assisted route judgements for general guidance.
                It is <strong>not</strong> regulated careers advice, <strong>not</strong> financial advice, and{" "}
                <strong>not</strong> legal advice. Reality-check outputs are judgements, not predictions, and we do not
                guarantee any career, salary, training, funding or employment outcome.
              </p>
              <p>
                Where we surface funded support programmes based on your Decision Profile, we are showing programmes that
                <em> may</em> be relevant. We do not decide eligibility — the named programme does. Always verify
                eligibility, availability and current funding directly with the named programme or provider before
                committing time or money.
              </p>
              <p>
                For regulated guidance please speak to the National Careers Service, a qualified careers adviser, an
                FCA-regulated financial adviser, or a solicitor as appropriate.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">5. Accuracy</h2>
              <p>
                We work hard to keep role information, salary ranges, apprenticeships, training providers and funded support up to date,
                and we list our sources on the <a href="/sources" className="text-primary hover:underline">/sources</a> page. However:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Skills Bootcamp funding windows change annually and vary by Combined Authority.</li>
                <li>Provider availability, course dates, and apprenticeship vacancies change frequently.</li>
                <li>Salary figures fluctuate with the UK job market.</li>
                <li>Professional body and regulatory requirements (e.g. RTPI, SRA, GMC) can change.</li>
              </ul>
              <p>
                Always verify specific details — particularly funding eligibility, course availability and regulatory requirements —
                directly with the named provider, the relevant Combined Authority, the relevant professional body, or gov.uk before
                committing time or money. Clear Routes is not liable for decisions made without that verification.
              </p>
              <p>
                If you spot something wrong, email{" "}
                <a href="mailto:hello@clearroutes.co.uk" className="text-primary hover:underline">hello@clearroutes.co.uk</a>{" "}
                and we will investigate and correct verified errors as quickly as we can.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">6. How we use AI</h2>
              <p>
                Role page content — pathways, salary ranges, competition signals, provider lists and AI-impact ratings —
                is hand-curated and reviewed before publication. We do not use large language models to invent providers,
                salaries, eligibility or competition data.
              </p>
              <p>
                The Reality-check feature is AI-assisted. It combines the answers you give about your situation with our
                editorial data on the role to produce a route judgement (best route in, backup route, route to avoid,
                local realism, first move). The judgement is generated for you and is not a guaranteed outcome. Treat it
                as a structured second opinion, not as regulated advice.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">7. Third-party links</h2>
              <p>
                Role and provider pages contain links to third-party websites — training providers, universities, gov.uk, professional
                bodies, and support organisations. We are not responsible for the content, availability, or practices of those sites.
                Following a link is at your own discretion.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">8. Intellectual property</h2>
              <p>
                All content on Clear Routes — including role descriptions, pathways, editorial commentary and curated provider lists — is
                owned by Clear Routes. You may link to pages freely. You may not reproduce, redistribute, scrape, or resell substantial
                portions of the content without our written permission.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">9. Acceptable use</h2>
              <p>
                Don't use the site to break the law, harm others, circumvent our security, or scrape content at volume. We may rate-limit
                or block access where we reasonably believe these terms are being breached.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">10. Limitation of liability</h2>
              <p>
                Clear Routes is provided "as is" and free of charge. To the fullest extent permitted by law we are not liable for any loss
                arising from your use of the platform, including career, training, financial or other outcomes resulting from reliance on
                information shown on the site or on third-party providers we link to. Nothing in these terms limits liability that cannot
                be limited by law.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">11. Changes to these terms</h2>
              <p>We may update these terms from time to time. Continued use of the platform after a change constitutes acceptance of the updated terms.</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-foreground mb-3">12. Contact</h2>
              <p>
                Questions about these terms? Email{" "}
                <a href="mailto:hello@clearroutes.co.uk" className="text-primary hover:underline">hello@clearroutes.co.uk</a>.
              </p>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Terms;
