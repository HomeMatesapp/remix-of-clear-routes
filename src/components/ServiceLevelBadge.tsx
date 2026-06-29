import {
  type RoleServiceLevel,
  SERVICE_LEVEL_LABEL,
  SERVICE_LEVEL_DESCRIPTION,
} from "@/lib/reality-check/service-levels";

const toneFor: Record<RoleServiceLevel, string> = {
  info_only:      "bg-gray-100 text-gray-700 border-gray-200",
  reality_check:  "bg-amber-100 text-amber-800 border-amber-200",
  full_support:   "bg-emerald-100 text-emerald-800 border-emerald-200",
};

/**
 * Honest, plain-language badge for how much of Clear Routes is available for
 * a given role. Never imply "verified opportunities" for `reality_check` —
 * that only ships at `full_support`.
 */
export const ServiceLevelBadge = ({
  level,
  size = "sm",
}: {
  level: RoleServiceLevel | null | undefined;
  size?: "sm" | "xs";
}) => {
  const l: RoleServiceLevel = level ?? "info_only";
  const padding = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      title={SERVICE_LEVEL_DESCRIPTION[l]}
      className={`inline-flex items-center rounded-full border font-medium ${padding} ${toneFor[l]}`}
    >
      {SERVICE_LEVEL_LABEL[l]}
    </span>
  );
};
