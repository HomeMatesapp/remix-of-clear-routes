import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const HowItWorks = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Helmet><title>How Clear Routes works</title></Helmet>
    <Navbar />
    <main className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="font-display text-4xl font-medium text-foreground">How Clear Routes works</h1>
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
    </main>
    <Footer />
  </div>
);

export default HowItWorks;
