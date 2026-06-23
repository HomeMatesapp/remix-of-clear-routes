import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background mt-12">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-base font-semibold text-foreground mb-2">Clear Routes</div>
            <p className="text-muted-foreground">
              Reality-check a career route before you commit time or money.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-3">Explore</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-muted-foreground hover:text-foreground">Reality-check a career</Link></li>
              <li><Link to="/my-decisions" className="text-muted-foreground hover:text-foreground">My career decisions</Link></li>
              <li><Link to="/support" className="text-muted-foreground hover:text-foreground">Support & funding</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground">How this works</Link></li>
              <li><Link to="/sources" className="text-muted-foreground hover:text-foreground">Sources & methodology</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-3">Company</h4>
            <ul className="space-y-2">
              <li><Link to="/faq" className="text-muted-foreground hover:text-foreground">FAQ</Link></li>
              <li><Link to="/for-institutions" className="text-muted-foreground hover:text-foreground">For institutions</Link></li>
              <li><a href="mailto:hello@clearroutes.co.uk" className="text-muted-foreground hover:text-foreground">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-10 pt-6 text-xs text-muted-foreground text-center">
          © 2026 Clear Routes. Built for the UK job market.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
