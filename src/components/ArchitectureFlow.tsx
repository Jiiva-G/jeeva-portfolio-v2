import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Simplified pipeline diagram.
 * - inline: steps in words for the scene panel
 * - rail: a spatial node rail for the detail view
 */
export default function ArchitectureFlow({ steps, layout = "inline", label }: { steps: string[]; layout?: "inline" | "rail"; label: string }) {
  if (layout === "rail") {
    return (
      <ol className="arch-rail relative grid gap-y-5 sm:grid-flow-col sm:auto-cols-fr sm:gap-x-2" aria-label={label}>
        <span className="arch-rail__line absolute hidden sm:block" aria-hidden="true" />
        {steps.map((step, i) => (
          <li key={step} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-3 sm:text-center">
            <span
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] backdrop-blur",
                i === steps.length - 1 ? "border-accent bg-accent/25 text-ink shadow-[0_0_24px_rgba(61,139,255,0.6)]" : "border-line-strong bg-surface/80 text-muted",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[13px] leading-tight text-ink/90 sm:max-w-[7rem]">{step}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em]" aria-label={label}>
      {steps.map((step, i) => (
        <Fragment key={step}>
          <li className={i === steps.length - 1 ? "text-accent-bright" : "text-ink/60"}>{step}</li>
          {i < steps.length - 1 && (
            <li aria-hidden="true" className="text-accent/60">
              →
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}
