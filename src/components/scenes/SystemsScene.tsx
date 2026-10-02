import { useRef, useState } from "react";
import { systems, type System } from "@/data/portfolio";
import ProjectDialog from "../ProjectDialog";
import ProjectModule from "../ProjectModule";
import { Eyebrow, Reveal } from "../primitives";
import SceneBlock from "./SceneBlock";

export default function SystemsScene() {
  const [selected, setSelected] = useState<System | null>(null);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  return (
    <section id="systems" tabIndex={-1} aria-labelledby="systems-title" className="relative outline-none">
      {systems.map((system, i) => (
        <SceneBlock
          key={system.id}
          as="div"
          id={`system-${system.id}`}
          scene="systems"
          stage={system.stage}
          // Alternate sides so each system's environment gets its own part of the frame.
          align={i % 2 === 0 ? "left" : "right"}
          // Taller blocks give the camera time to travel through each pipeline.
          className="lg:min-h-[150vh]"
          panelClassName="lg:max-w-[31rem]"
        >
          {i === 0 && (
            <Reveal className="mb-12">
              <Eyebrow scene="systems" />
              <h2 id="systems-title" className="mt-6 text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
                Selected systems
              </h2>
              <p className="mt-3 max-w-[28rem] text-[15px] leading-relaxed text-muted">Keep scrolling — each system assembles itself as you move through it.</p>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <ProjectModule
              system={system}
              onOpen={(el) => {
                opener.current = el;
                setSelected(system);
                setOpen(true);
              }}
            />
          </Reveal>
        </SceneBlock>
      ))}

      <ProjectDialog system={selected} open={open} onOpenChange={setOpen} returnFocusTo={opener.current} />
    </section>
  );
}
