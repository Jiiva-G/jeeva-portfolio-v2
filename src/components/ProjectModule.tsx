import { ArrowUpRight } from "lucide-react";
import type { System } from "@/data/portfolio";
import ArchitectureFlow from "./ArchitectureFlow";

/**
 * A system's text panel. The 3D environment beside it carries the visual story, so this stays
 * light: identity, one line, the pipeline in words, and the way into the full brief.
 */
export default function ProjectModule({ system, onOpen }: { system: System; onOpen: (opener: HTMLElement) => void }) {
  return (
    <article className="group relative border-l border-accent/40 pl-6 transition-colors duration-500 hover:border-accent" aria-labelledby={`${system.id}-title`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
        <span className="text-accent-bright">{system.index}</span>
        <span>{system.kicker}</span>
      </p>

      <h3 id={`${system.id}-title`} className="mt-4 text-balance text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
        {system.name}
      </h3>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted/80">{system.role}</p>
      <p className="mt-4 max-w-[30rem] text-[15.5px] leading-relaxed text-muted">{system.summary}</p>

      <div className="mt-5">
        <ArchitectureFlow steps={system.architecture} label={`${system.name} architecture`} />
      </div>

      <button
        type="button"
        onClick={(e) => onOpen(e.currentTarget)}
        className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-medium text-ink"
        aria-haspopup="dialog"
        aria-label={`Open system brief: ${system.name}`}
      >
        <span className="border-b border-accent/40 pb-0.5 transition-colors group-hover:border-accent">Open system brief</span>
        <ArrowUpRight size={16} className="text-accent-bright transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
    </article>
  );
}
