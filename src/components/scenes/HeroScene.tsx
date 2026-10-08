import { ArrowDown, ArrowRight, Github, Linkedin } from "lucide-react";
import { motion } from "framer-motion";
import { links, profile } from "@/data/portfolio";
import { scrollToScene } from "@/lib/sceneStore";
import Portrait from "../Portrait";
import { ActionButton, ActionLink } from "../primitives";
import SceneBlock from "./SceneBlock";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function HeroScene({ started, has3D }: { started: boolean; has3D: boolean }) {
  // Hold the entrance until the loader has cleared so it is actually seen.
  const anim = (delay: number) =>
    started
      ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, delay, ease: EASE } }
      : { initial: { opacity: 0, y: 24 } };

  return (
    <SceneBlock
      id="intro"
      scene="intro"
      stage={0}
      labelledBy="intro-title"
      className={has3D ? "max-lg:pt-[52svh]" : "max-lg:pt-24"}
      aside={
        !has3D && (
          <Portrait
            visible
            className="mx-auto mb-0 hidden w-[min(25vw,21rem)] lg:absolute lg:right-[14%] lg:top-1/2 lg:block lg:-translate-y-1/2"
          />
        )
      }
    >
      {!has3D && <Portrait visible className="mx-auto mb-6 w-[min(50vw,13rem)] lg:hidden" />}
      {has3D && <Portrait visible={false} />}

      <motion.h1
        {...anim(0.1)}
        id="intro-title"
        className="text-[clamp(3.4rem,9vw,7.2rem)] font-semibold uppercase leading-[0.86] tracking-[-0.045em] text-ink"
      >
        Jeeva G
      </motion.h1>

      <motion.p {...anim(0.22)} className="mt-5 font-mono text-[12.5px] uppercase tracking-[0.32em] text-accent-bright">
        {profile.title}
      </motion.p>

      <motion.p {...anim(0.36)} className="mt-7 max-w-[28rem] text-balance text-[clamp(1.35rem,2.3vw,1.85rem)] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
        {profile.positioning}
      </motion.p>

      <motion.ul {...anim(0.48)} className="mt-5 flex max-w-[30rem] flex-wrap gap-x-3 gap-y-1.5 font-mono text-[11.5px] text-muted" aria-label="Focus areas">
        {profile.domains.map((d, i) => (
          <li key={d} className="flex items-center gap-3">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-accent/70" aria-hidden="true" />}
            {d}
          </li>
        ))}
      </motion.ul>

      <motion.div {...anim(0.6)} className="mt-9 flex flex-wrap items-center gap-3">
        <ActionButton variant="primary" onClick={() => scrollToScene("capabilities")}>
          Enter the system <ArrowRight size={16} />
        </ActionButton>
        <ActionLink href={links.github} aria-label="GitHub (opens in a new tab)">
          <Github size={16} /> GitHub
        </ActionLink>
        <ActionLink href={links.linkedin} aria-label="LinkedIn (opens in a new tab)">
          <Linkedin size={16} /> LinkedIn
        </ActionLink>
      </motion.div>

      <motion.button
        {...(started ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 1.3, duration: 1 } } : { initial: { opacity: 0 } })}
        type="button"
        onClick={() => scrollToScene("capabilities")}
        aria-label="Go to capabilities"
        className="mt-14 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted transition-colors hover:text-ink lg:inline-flex"
      >
        <span className="scroll-cue relative flex h-9 w-[1px] overflow-hidden bg-line" aria-hidden="true" />
        <ArrowDown size={12} aria-hidden="true" />
      </motion.button>
    </SceneBlock>
  );
}
