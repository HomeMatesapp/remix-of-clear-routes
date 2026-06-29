// Region — closed enum for where a user lives in the UK.
//
// IMPORTANT: a region describes where the user lives. It is NOT the same as
// an opportunity's coverage area. An opportunity may be local to a region,
// remote-only, or UK-wide ("national"). Keep those vocabularies separate.
//
// Internal values are stable; user-facing labels can be refined without
// breaking saved decisions or persisted profiles.

export type Region =
  | "london"
  | "greater_manchester"
  | "west_midlands"
  | "other_uk";

export const REGIONS: { value: Region; label: string }[] = [
  { value: "london",             label: "London" },
  { value: "greater_manchester", label: "Greater Manchester" },
  { value: "west_midlands",      label: "Birmingham and the West Midlands" },
  { value: "other_uk",           label: "Elsewhere in the UK" },
];

// Regions where Release 1 supports verified local opportunity coverage.
// (Coverage itself ships in Release 3 — Release 1 only labels honesty.)
export const SUPPORTED_OPPORTUNITY_REGIONS: ReadonlySet<Region> = new Set([
  "london",
  "greater_manchester",
  "west_midlands",
]);

export const regionLabel = (r: Region | null | undefined): string | null =>
  (r && REGIONS.find((x) => x.value === r)?.label) || null;

export const isSupportedRegion = (r: Region | null | undefined): boolean =>
  !!r && SUPPORTED_OPPORTUNITY_REGIONS.has(r);
