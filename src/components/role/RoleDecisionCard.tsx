import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
          : "border-ink/80",
        !comingSoon && to && "hover:bg-tint"
      )}
    >
      {badge && (
        <div className="mb-3 inline-flex self-start items-center font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-[hsl(var(--path))] text-[hsl(var(--path))]">
          {badge}
        </div>
      )}
      <h3 className="font-display text-xl leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink/75 flex-1">{description}</p>
      {comingSoon ? (
        <div className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ink/50">
          Coming in the next release
        </div>
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

  if (comingSoon || !to) {
    return <div className="block h-full">{body}</div>;
  }
  return (
    <Link to={to} onClick={onClick} className="block h-full">
      {body}
    </Link>
  );
};
