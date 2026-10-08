import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, Copy, FileDown, Github, Linkedin } from "lucide-react";
import { links, profile } from "@/data/portfolio";
import { useCompactLayout } from "@/hooks/useMediaQuery";
import { resumeLink, SCENE_INVALIDATE, sceneState, scrollToScene } from "@/lib/sceneStore";
import { cn } from "@/lib/utils";
import { ActionLink, Eyebrow, Reveal } from "../primitives";

/**
 * Final scene — System Convergence. Every system in the portfolio streams into one core above
 * this text. The primary CTA is a plain mailto; hovering or focusing it also sends a pulse into
 * the core in the 3D scene, so nothing depends on the animation.
 */
export default function ContactScene({ has3D }: { has3D: boolean }) {
  const [copied, setCopied] = useState(false);
  const [online, setOnline] = useState(false);
  const cta = useRef<HTMLSpanElement>(null);
  const [resumeOn, setResumeOn] = useState(false);
  const resume = useRef<HTMLAnchorElement>(null);
  // Desktop 3D: the resume module pins this link over itself. Otherwise it is an inline link.
  const compact = useCompactLayout();
  const pinned = has3D && !compact;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => () => void (sceneState.connect = false), []);

  useEffect(() => {
    const el = resume.current;
    resumeLink.el = pinned ? el : null;
    return () => {
      resumeLink.el = null;
      sceneState.resume = false;
      // Drop the position the 3D module wrote, in case the layout switches to inline.
      el?.removeAttribute("data-placed");
      el?.style.removeProperty("transform");
      el?.style.removeProperty("opacity");
    };
  }, [pinned]);

  const setResumeActive = (on: boolean) => {
    setResumeOn(on);
    sceneState.resume = on;
    window.dispatchEvent(new Event(SCENE_INVALIDATE));
  };

  const setConnection = (on: boolean) => {
    setOnline(on);
    sceneState.connect = on;
    const r = cta.current?.getBoundingClientRect();
    if (on && r) {
      sceneState.ctaX = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
      sceneState.ctaY = -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1);
    }
    window.dispatchEvent(new Event(SCENE_INVALIDATE));
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(links.email);
      setCopied(true);
    } catch {
      window.location.href = `mailto:${links.email}`;
    }
  };

  return (
    <section
      id="contact"
      data-scene="contact"
      data-stage={8}
      tabIndex={-1}
      aria-labelledby="contact-title"
      className="relative flex min-h-[100svh] flex-col outline-none"
    >
      {/* A soft floor of shade under the text keeps it legible below the core. */}
      {has3D && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-bg/85 via-bg/45 to-transparent" />}

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-[84rem] flex-1 flex-col items-center px-5 pb-10 text-center sm:px-8",
          has3D ? "justify-end pt-[44svh] lg:pt-[45svh]" : "justify-center py-24",
        )}
      >
        <Reveal className="flex flex-col items-center">
          <Eyebrow scene="contact" />

          <h2
            id="contact-title"
            className="mt-6 max-w-[19ch] text-balance text-[clamp(2.1rem,min(4.8vw,6.8vh),4.1rem)] font-semibold uppercase leading-[0.94] tracking-[-0.045em] text-ink"
          >
            Let&rsquo;s build something intelligent.
          </h2>
          <p className="mt-4 max-w-[30rem] text-pretty text-[14.5px] leading-relaxed text-muted sm:text-[15.5px]">
            Six systems, one convergence point. The next one starts with a conversation.
          </p>

          <p
            aria-hidden="true"
            className={cn(
              "mt-6 flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.24em] transition-colors duration-500",
              online ? "text-accent-bright" : "text-muted",
            )}
          >
            <span className={cn("node-status-dot", online && "node-status-dot--open")} />
            System status // {online ? "Online" : "Standby"}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span
              ref={cta}
              className="inline-flex"
              onPointerEnter={() => setConnection(true)}
              onPointerLeave={() => setConnection(false)}
              onFocus={() => setConnection(true)}
              onBlur={() => setConnection(false)}
            >
              <ActionLink variant="primary" href={`mailto:${links.email}`} aria-label={`Initiate connection — email ${links.email}`}>
                Initiate connection <ArrowRight size={16} />
              </ActionLink>
            </span>
            <ActionLink href={links.github} aria-label="GitHub (opens in a new tab)">
              <Github size={16} /> GitHub
            </ActionLink>
            <ActionLink href={links.linkedin} aria-label="LinkedIn (opens in a new tab)">
              <Linkedin size={16} /> LinkedIn
            </ActionLink>
          </div>

          {/* Secondary output: the public-safe resume. A real download link; the 3D module is decoration around it. */}
          <a
            ref={resume}
            href={profile.resume.href}
            download={profile.resume.fileName}
            type="application/pdf"
            aria-label="Download resume PDF"
            className={cn("resume-link", pinned ? "resume-link--pinned" : "resume-link--inline", resumeOn && "is-active")}
            onPointerEnter={() => setResumeActive(true)}
            onPointerLeave={() => setResumeActive(false)}
            onFocus={(e) => {
              setResumeActive(true);
              // Focused before the 3D module has placed it (e.g. tabbing in while the camera is still
              // travelling): bring the scene into view, as the browser would for an in-flow element.
              if (pinned && !e.currentTarget.hasAttribute("data-placed")) {
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                document.getElementById("contact")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
              }
            }}
            onBlur={() => setResumeActive(false)}
            onKeyDown={(e) => {
              // Links only activate on Enter natively; Space downloads too.
              if (e.key === " ") {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
          >
            {pinned ? (
              <span className="resume-link__hit" aria-hidden="true" />
            ) : (
              <span className="resume-link__glyph" aria-hidden="true">
                <FileDown size={15} />
              </span>
            )}
            <span className="resume-link__text" aria-hidden="true">
              <span className="resume-link__meta">
                <span className={cn("node-status-dot", resumeOn && "node-status-dot--open")} />
                Resume // PDF
              </span>
              <span className="resume-link__action">
                Download resume <ArrowRight size={13} />
              </span>
            </span>
          </a>

          <button
            type="button"
            onClick={copyEmail}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full font-mono text-[12px] text-muted transition-colors hover:text-ink"
          >
            {copied ? <Check size={14} className="text-accent-bright" /> : <Copy size={14} />}
            {links.email}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? "Email address copied to clipboard" : ""}
          </span>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/85 [@media(max-height:780px)]:hidden">
            {profile.name} · {profile.title}
          </p>
        </Reveal>
      </div>

      <footer className="relative mx-auto flex w-full max-w-[84rem] flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-5 font-mono text-[11px] text-muted sm:px-8 lg:px-16">
        <p>
          © {new Date().getFullYear()} {profile.name} · {profile.location}
        </p>
        <button type="button" onClick={() => scrollToScene("intro")} className="inline-flex min-h-[44px] items-center gap-2 transition-colors hover:text-ink">
          Back to top <ArrowUp size={12} />
        </button>
      </footer>
    </section>
  );
}
