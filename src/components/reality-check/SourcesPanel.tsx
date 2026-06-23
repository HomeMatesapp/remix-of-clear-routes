// Citations panel shown beneath every Reality-check verdict.
// Clearly separates sourced facts from Clear Routes' own interpretation.

import { ExternalLink, FileText, AlertTriangle } from "lucide-react";
import {
  hasOutdatedSources,
  type SourceEntry,
} from "@/lib/reality-check/sources";

interface Props {
  sources: SourceEntry[];
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short" });
};

export function SourcesPanel({ sources }: Props) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-gray-600 bg-gray-800/60 p-4">
        <div className="flex items-center gap-2 mb-2 text-gray-300">
          <FileText className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-wider">Sources</p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          No specific sources were used for this result beyond Clear Routes'
          general methodology. Treat the judgement as interpretive rather than
          evidence-backed.
        </p>
      </div>
    );
  }

  const outdated = hasOutdatedSources(sources);

  return (
    <div className="rounded-xl border border-gray-600 bg-gray-800/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-gray-200">
        <FileText className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider">
          Sources used
        </p>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 text-[11px]">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
          <p className="font-semibold text-emerald-300 uppercase tracking-wider">Sourced facts</p>
          <p className="text-gray-300 leading-snug mt-0.5">
            Salary ranges, demand signals, regulator rules and pathway
            descriptions — drawn from the publications listed below.
          </p>
        </div>
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-2">
          <p className="font-semibold text-amber-200 uppercase tracking-wider">Clear Routes interpretation</p>
          <p className="text-gray-300 leading-snug mt-0.5">
            The verdict, best/backup route choice, local realism rating and
            first moves are our judgement, not statements of fact.
          </p>
        </div>
      </div>

      {outdated && (
        <div className="flex items-start gap-2 mb-3 rounded-md border border-amber-400/40 bg-amber-400/5 p-2 text-[11px] text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p className="leading-snug">
            One or more sources have not been re-checked in over 12 months. We
            are reviewing them — treat figures as approximate until updated.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {sources.map((s) => (
          <li key={s.id} className="text-xs leading-snug">
            <div className="flex items-start gap-1.5">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-white hover:text-amber-200 underline-offset-2 hover:underline inline-flex items-center gap-1"
              >
                {s.organisation} — {s.title}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.period} · Last checked {formatDate(s.lastChecked)}
            </p>
            <p className="text-[11px] text-gray-300 mt-0.5">{s.usage}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
