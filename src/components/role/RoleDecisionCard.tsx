import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  cta?: string;
  to?: string;
  primary?: boolean;
  badge?: string;
  comingSoon?: boolean;
  onClick?: () => void;
}

export const RoleDecisionCard = ({
  title,
  description,
  cta,
  to,
  primary = false,
  badge,
  comingSoon = false,
  onClick,
}: Props) => {
  const body = (
    <div
      className={cn(
        "h-full flex flex-col p-6 rounded-lg border-2 bg-paper transition-colors",
        primary
          ? "border-ink border-l-[6px] border-l-[hsl(var(--path))] shadow-[0_2px_0_hsl(var(--ink))]"
          : "border-ink/80"
      )}
    >
      {badge && (
        <div
          className={cn(
            "mb-3 inline-flex self-start items-center font-mono text-[10px] uppercase tracking-widest px-2 py-1 border",
            primary
              ? "border-[hsl(var(--path))] text-[hsl(var(--path))]"
              : "border-ink/30 text-ink/60"
          )}
        >
          {badge}
        </div>
      )}
      <h3 className="font-display text-xl leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink/75 flex-1">{description}</p>
      {primary && cta && to ? (
        <Button
          asChild
          className="mt-6 w-full bg-[hsl(var(--path))] text-[hsl(var(--paper))] hover:bg-[hsl(var(--path))]/90"
        >
          <Link to={to} onClick={onClick} className="gap-2">
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : cta && to ? (
        <div
          className={cn(
            "mt-6 inline-flex items-center gap-1.5 font-medium text-sm",
            primary ? "text-[hsl(var(--path))]" : "text-ink"
          )}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );

  if (comingSoon || !to || primary) {
    return <div className="block h-full">{body}</div>;
  }
  return (
    <Link to={to} onClick={onClick} className="block h-full">
      {body}
    </Link>
  );
};
