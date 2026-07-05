import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
}

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-ink",
  good: "text-wood",
  warn: "text-[hsl(42,68%,36%)]",
  bad: "text-danger",
};

export const RoleMetricCard = ({ label, value, tone = "default" }: Props) => (
  <div className="border-2 border-ink bg-paper p-4 rounded-md">
    <div className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
      {label}
    </div>
    <div className={cn("mt-1 font-display text-lg leading-tight", toneClass[tone])}>
      {value}
    </div>
  </div>
);
