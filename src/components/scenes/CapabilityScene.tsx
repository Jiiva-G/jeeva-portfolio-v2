import { capabilities, systems } from "@/data/portfolio";
import { highlightSceneLabel, scrollToScene } from "@/lib/sceneStore";
import { Eyebrow, Reveal } from "../primitives";
import SceneBlock from "./SceneBlock";

const systemsById = new Map(systems.map((s) => [s.id, s]));

export default function CapabilityScene() {
  return (
    <SceneBlock id="capabilities" scene="capabilities" stage={1} labelledBy="capabilities-title">
      <Reveal>
        <Eyebrow scene="capabilities">What I build</Eyebrow>
        <h2 id="capabilities-title" className="mt-6 text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
          Three domains. <span className="text-muted">One connected system.</span>
        </h2>
      </Reveal>

      <ol className="mt-8 divide-y divide-line border-y border-line">
        {capabilities.map((cap, i) => (
          <Reveal
            as="li"
            key={cap.id}
            delay={0.08 * i}
            className="group py-5"
            onPointerEnter={() => highlightSceneLabel(`cap-${cap.id}`, true)}
            onPointerLeave={() => highlightSceneLabel(`cap-${cap.id}`, false)}
          >
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-[11px] text-accent-bright">{cap.index}</span>
              <div className="min-w-0">
                <h3 className="text-[1.08rem] font-semibold tracking-[-0.01em] text-ink">{cap.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{cap.summary}</p>
                <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-ink/55">
                  <span className="sr-only">Technologies: </span>
                  {cap.nodes.join(" · ")}
                </p>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted/70">Applied in</span>
                  {cap.appliedIn.map((id, k) => (
                    <span key={id} className="flex items-center gap-2">
                      {k > 0 && <span aria-hidden="true">·</span>}
                      <a
                        href={`#system-${id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToScene(`system-${id}`);
                        }}
                        className="text-ink/85 underline decoration-accent/40 underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
                      >
                        {systemsById.get(id)?.shortName}
                      </a>
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </SceneBlock>
  );
}
