import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { System } from "@/data/portfolio";
import ArchitectureFlow from "./ArchitectureFlow";
import { Tag } from "./primitives";

type Props = {
  system: System | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to refocus on close (Radix only does this for its own Dialog.Trigger). */
  returnFocusTo: HTMLElement | null;
};

/** `system` stays set after closing so the exit animation still has content to show. */
export default function ProjectDialog({ system, open, onOpenChange, returnFocusTo }: Props) {
  return (
    <Dialog.Root open={open && !!system} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[80] bg-[rgba(3,5,10,0.6)] backdrop-blur-md" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusTo?.focus({ preventScroll: true });
          }}
          className="dialog-content fixed inset-x-3 bottom-3 top-16 z-[90] mx-auto flex max-w-4xl flex-col overflow-hidden rounded-[1.6rem] border border-line-strong bg-surface/95 shadow-[0_40px_140px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(61,139,255,0.08)] focus:outline-none sm:inset-x-6 sm:bottom-auto sm:top-1/2 sm:max-h-[88vh] sm:-translate-y-1/2"
        >
          {system && (
            <div className="overflow-y-auto overscroll-contain">
              {/* Spatial header: the system's architecture as a lit node rail. */}
              <div className="dialog-stage relative overflow-hidden border-b border-line px-6 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                      <span className="text-accent-bright">{system.index}</span> · {system.role}
                    </p>
                    <Dialog.Title className="mt-3 max-w-[22ch] text-balance text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.4rem]">
                      {system.name}
                    </Dialog.Title>
                    <Dialog.Description className="mt-3 max-w-[40rem] text-[15.5px] leading-relaxed text-ink/80">{system.description}</Dialog.Description>
                  </div>
                  <Dialog.Close
                    className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface/60 text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-ink"
                    aria-label="Close system brief"
                  >
                    <X size={16} />
                  </Dialog.Close>
                </div>
                <div className="mt-8">
                  <h3 className="sr-only">Architecture</h3>
                  <ArchitectureFlow steps={system.architecture} layout="rail" label={`${system.name} architecture`} />
                </div>
              </div>

              <div className="grid gap-8 px-6 py-7 sm:grid-cols-[1fr_14rem] sm:px-10 sm:py-9">
                <div className="space-y-7">
                  <section>
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Context</h3>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{system.context}</p>
                  </section>
                  <section>
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">What I built</h3>
                    <ul className="mt-3 space-y-2.5">
                      {system.contribution.map((item) => (
                        <li key={item} className="flex gap-3 text-[14.5px] leading-relaxed text-ink/85">
                          <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
                <section>
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Stack</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {system.stack.map((t) => (
                      <li key={t}>
                        <Tag>{t}</Tag>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
