import { skillGroups } from "@/data/portfolio";
import { highlightSceneLabel } from "@/lib/sceneStore";
import { Eyebrow, Reveal } from "../primitives";
import SceneBlock from "./SceneBlock";

export default function StackScene() {
  return (
    <SceneBlock id="stack" scene="stack" stage={6} labelledBy="stack-title">
      <Reveal>
        <Eyebrow scene="stack">Toolkit</Eyebrow>
        <h2 id="stack-title" className="mt-6 text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
          One ecosystem, <span className="text-muted">organised by the job each tool does.</span>
        </h2>
      </Reveal>

      <dl className="mt-8 divide-y divide-line border-y border-line">
        {skillGroups.map((group, i) => (
          <Reveal
            key={group.id}
            delay={0.04 * i}
            className="grid gap-1.5 py-3.5 sm:grid-cols-[9.5rem_1fr] sm:gap-5"
            onPointerEnter={() => highlightSceneLabel(`stack-${group.id}`, true)}
            onPointerLeave={() => highlightSceneLabel(`stack-${group.id}`, false)}
          >
            <dt className="pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent-bright">{group.label}</dt>
            <dd className="text-[13.5px] leading-relaxed text-ink/80">
              {group.skills.map((skill, k) => (
                <span key={skill}>
                  <span className="whitespace-nowrap">{skill}</span>
                  {k < group.skills.length - 1 && (
                    <>
                      <span className="mx-2 text-muted/50" aria-hidden="true">
                        ·
                      </span>{" "}
                    </>
                  )}
                </span>
              ))}
            </dd>
          </Reveal>
        ))}
      </dl>
    </SceneBlock>
  );
}
