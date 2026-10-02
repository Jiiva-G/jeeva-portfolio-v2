import { education, experience } from "@/data/portfolio";
import { Eyebrow, Reveal } from "../primitives";
import SceneBlock from "./SceneBlock";

export default function ExperienceScene() {
  return (
    <SceneBlock id="experience" scene="experience" stage={7} labelledBy="experience-title">
      <Reveal>
        <Eyebrow scene="experience" />
        <h2 id="experience-title" className="mt-6 text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
          Where the systems were built
        </h2>
      </Reveal>

      <ol className="mt-8 space-y-6">
        {experience.map((role, i) => (
          <Reveal as="li" key={role.company} delay={0.08 * i} className="relative pl-6">
            <span
              className={`absolute left-0 top-[0.45rem] h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-accent shadow-[0_0_14px_rgba(61,139,255,0.9)]" : "border border-line-strong bg-bg"}`}
              aria-hidden="true"
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-bright">{role.period}</p>
            <h3 className="mt-1.5 text-[1.2rem] font-semibold tracking-[-0.01em] text-ink">
              {role.company} <span className="font-normal text-muted">· {role.title}</span>
            </h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{role.summary}</p>
            <p className="mt-1 text-[12px] text-muted/70">{role.location}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.1} className="mt-9 border-t border-line pt-5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Education</h3>
        <ul className="mt-3 space-y-2.5">
          {education.map((e) => (
            <li key={e.degree} className="text-[13.5px] leading-snug">
              <span className="text-ink">{e.degree}</span>
              <span className="block text-muted">
                {e.school} · {e.period} · CGPA {e.cgpa}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </SceneBlock>
  );
}
