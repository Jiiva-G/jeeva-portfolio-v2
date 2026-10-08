import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ArrowUp, Check, Copy, FileDown, Github, Handshake, Layers, Linkedin, Mail, Milestone, Network, type LucideIcon } from "lucide-react";
import { links, profile } from "@/data/portfolio";
import { useCompactLayout } from "@/hooks/useMediaQuery";
import { orbitNodeLinks, SCENE_INVALIDATE, sceneState, scrollToScene } from "@/lib/sceneStore";
import { cn } from "@/lib/utils";
import { ORBITAL, type OrbitNode, type OrbitNodeKind } from "../three/sceneData";
import { ActionLink, Reveal } from "../primitives";

type NodeAction = { href: string; label: string; icon: LucideIcon; scene?: "capabilities" | "systems" | "experience"; download?: string };

/** Where each orbital node leads. Every node is a real link; the 3D node is only its presentation. */
const NODE_ACTIONS: Record<OrbitNodeKind, NodeAction> = {
  work: { href: "#capabilities", label: "Work — capabilities", icon: Layers, scene: "capabilities" },
  systems: { href: "#systems", label: "Systems", icon: Network, scene: "systems" },
  experience: { href: "#experience", label: "Experience", icon: Milestone, scene: "experience" },
  contact: { href: `mailto:${links.email}`, label: `Contact — email ${links.email}`, icon: Mail },
  resume: { href: profile.resume.href, label: "Download resume PDF", icon: FileDown, download: profile.resume.fileName },
  connect: { href: links.linkedin, label: "Connect on LinkedIn (opens in a new tab)", icon: Handshake },
};

const send = () => window.dispatchEvent(new Event(SCENE_INVALIDATE));

/**
 * Final scene — the orbital system. Left: a short editorial invitation. Right: the 3D system,
 * whose six nodes are the real links below, pinned over the nodes on desktop. Compact screens and
 * no-WebGL get plain links; nothing here depends on the 3D layer.
 */
export default function ContactScene({ has3D }: { has3D: boolean }) {
  const [copied, setCopied] = useState(false);
  const [online, setOnline] = useState(false);
  const [focus, setFocus] = useState(-1);
  const cta = useRef<HTMLSpanElement>(null);
  const coreSlot = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const compact = useCompactLayout();
  // Desktop 3D: the orbital system pins the node links over its nodes.
  const pinned = has3D && !compact;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(
    () => () => {
      sceneState.connect = false;
      sceneState.orbitFocus = -1;
    },
    [],
  );

  // Compact 3D: tell the camera where the reserved slot for the core is (relative to the section's
  // centre, which is the viewport centre when this scene is settled).
  useEffect(() => {
    const slot = coreSlot.current;
    const sec = section.current;
    if (!slot || !sec) return;
    const measure = () => {
      const s = sec.getBoundingClientRect();
      const r = slot.getBoundingClientRect();
      sceneState.orbitCoreOffset = (r.top + r.height / 2 - (s.top + s.height / 2)) / window.innerHeight;
      send();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sec);
    return () => {
      ro.disconnect();
      sceneState.orbitCoreOffset = 0;
    };
  }, [has3D, compact]);

  const setConnection = (on: boolean) => {
    setOnline(on);
    sceneState.connect = on;
    const r = cta.current?.getBoundingClientRect();
    if (on && r) {
      sceneState.ctaX = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
      sceneState.ctaY = -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1);
    }
    send();
  };

  const setNodeFocus = (i: number, on: boolean) => {
    setFocus((cur) => (on ? i : cur === i ? -1 : cur));
    sceneState.orbitFocus = on ? i : sceneState.orbitFocus === i ? -1 : sceneState.orbitFocus;
    send();
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(links.email);
      setCopied(true);
    } catch {
      window.location.href = `mailto:${links.email}`;
    }
  };

  const resumeAction = NODE_ACTIONS.resume;

  return (
    <section
      ref={section}
      id="contact"
      data-scene="contact"
      data-stage={8}
      tabIndex={-1}
      aria-labelledby="contact-title"
      className={cn("relative flex min-h-[100svh] flex-col outline-none", !has3D && "bg-bg")}
    >
      {/* No-WebGL: the scene gets its own still backdrop (grid + light) instead of the page-wide 2D core. */}
      {!has3D && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="backdrop-grid absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_68%_45%,rgba(37,84,190,0.16),transparent_70%)]" />
        </div>
      )}
      {/* Soft shade behind the text so it stays legible over the scene. */}
      {has3D && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/30 to-transparent lg:bg-gradient-to-r lg:from-bg/85 lg:via-bg/40 lg:via-35% lg:to-transparent lg:to-60%"
        />
      )}

      <div
        className={cn(
          "relative mx-auto grid w-full max-w-[84rem] flex-1 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:items-center lg:px-16",
          compact ? "content-between gap-0 pb-8 pt-24" : "py-24",
        )}
      >
        <Reveal className="flex flex-col items-start">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
            <span className="text-accent-bright">//</span> Connect
          </p>
          <h2
            id="contact-title"
            className="mt-6 text-[clamp(2.1rem,min(4.2vw,7vh),3.6rem)] font-semibold uppercase leading-[0.96] tracking-[-0.04em] text-ink"
          >
            Let&rsquo;s build
            <br />
            what&rsquo;s next.
          </h2>
          <p className="mt-5 max-w-[24rem] text-pretty text-[15px] leading-relaxed text-muted">
            Drop a message or reach out — I&rsquo;m always open to new opportunities, collaborations and interesting conversations.
          </p>

          {/* Compact 3D: the core sits here, between the invitation and the actions. */}
          {has3D && compact && <div ref={coreSlot} aria-hidden="true" className="h-[36svh] min-h-[15rem] w-full" />}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              ref={cta}
              className="inline-flex"
              onPointerEnter={() => setConnection(true)}
              onPointerLeave={() => setConnection(false)}
              onFocus={() => setConnection(true)}
              onBlur={() => setConnection(false)}
            >
              <ActionLink variant="primary" href={`mailto:${links.email}`} aria-label={`Get in touch — email ${links.email}`}>
                Get in touch <ArrowRight size={16} />
              </ActionLink>
            </span>
            {/* Compact screens: Resume sits beside the CTA. Desktop reaches it through node 05 (3D or static). */}
            {compact && (
              <ActionLink href={resumeAction.href} download={resumeAction.download} type="application/pdf" aria-label={resumeAction.label} onKeyDown={spaceActivates}>
                <FileDown size={16} /> Resume
              </ActionLink>
            )}
          </div>

          <p
            aria-hidden="true"
            className={cn(
              "mt-5 flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors duration-500",
              online ? "text-accent-bright" : "text-muted",
            )}
          >
            <span className={cn("node-status-dot", online && "node-status-dot--open")} />
            Status · {online ? "Online" : "Standby"}
          </p>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11.5px] text-muted">
            <li>
              <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)" className="inline-flex min-h-[36px] items-center gap-2 transition-colors hover:text-ink">
                <Github size={14} aria-hidden="true" /> GitHub
              </a>
            </li>
            <li>
              <a href={links.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" className="inline-flex min-h-[36px] items-center gap-2 transition-colors hover:text-ink">
                <Linkedin size={14} aria-hidden="true" /> LinkedIn
              </a>
            </li>
            <li>
              <button type="button" onClick={copyEmail} className="inline-flex min-h-[36px] items-center gap-2 transition-colors hover:text-ink">
                {copied ? <Check size={14} className="text-accent-bright" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {links.email}
              </button>
            </li>
          </ul>
          <span className="sr-only" aria-live="polite">
            {copied ? "Email address copied to clipboard" : ""}
          </span>
        </Reveal>

        {/* The system's six nodes. Desktop 3D: pinned over the orbital nodes. No-WebGL desktop: a static diagram. */}
        {pinned && (
          <ul aria-label="Explore the system">
            {ORBITAL.nodes.map((node, i) => (
              <li key={node.kind}>
                <NodeLink node={node} i={i} pinned active={focus === i} onFocusChange={setNodeFocus} />
              </li>
            ))}
          </ul>
        )}
        {!has3D && !compact && <StaticOrbit focus={focus} onFocusChange={setNodeFocus} />}
      </div>

      <footer className="relative mx-auto grid w-full max-w-[84rem] grid-cols-[1fr_auto] items-center gap-4 border-t border-line px-5 py-4 font-mono text-[11px] text-muted sm:px-8 md:grid-cols-[1fr_auto_1fr] lg:px-16">
        <p>
          © {new Date().getFullYear()} {profile.name}
        </p>
        <p className="hidden tracking-[0.22em] text-muted/85 md:block">IDEAS → SYSTEMS → REAL IMPACT</p>
        <button type="button" onClick={() => scrollToScene("intro")} className="inline-flex min-h-[44px] items-center gap-2 justify-self-end transition-colors hover:text-ink">
          Back to top <ArrowUp size={12} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

/** Links only activate on Enter natively; the resume download also answers Space. */
function spaceActivates(e: KeyboardEvent<HTMLAnchorElement>) {
  if (e.key === " ") {
    e.preventDefault();
    e.currentTarget.click();
  }
}

function NodeLink({ node, i, pinned, active, onFocusChange }: { node: OrbitNode; i: number; pinned: boolean; active: boolean; onFocusChange: (i: number, on: boolean) => void }) {
  const action = NODE_ACTIONS[node.kind];
  const Icon = action.icon;
  const external = action.href.startsWith("http");

  return (
    <a
      ref={(el) => {
        if (pinned) orbitNodeLinks.els[i] = el;
      }}
      href={action.href}
      aria-label={action.label}
      {...(action.download ? { download: action.download, type: "application/pdf" } : {})}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-kind={node.kind}
      className={cn("orbit-node", pinned ? "orbit-node--pinned" : "orbit-node--static", active && "is-active")}
      onClick={(e) => {
        if (action.scene) {
          e.preventDefault();
          scrollToScene(action.scene);
        }
      }}
      onKeyDown={action.download ? spaceActivates : undefined}
      onPointerEnter={() => onFocusChange(i, true)}
      onPointerLeave={() => onFocusChange(i, false)}
      onFocus={(e) => {
        onFocusChange(i, true);
        // Focused before the scene has placed it (e.g. tabbing in mid-journey): bring the scene in,
        // as the browser would for an in-flow element. It shows as a tile until it is placed.
        if (pinned && !e.currentTarget.hasAttribute("data-placed")) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          document.getElementById("contact")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
      }}
      onBlur={() => onFocusChange(i, false)}
    >
      {pinned && <span className="orbit-node__hit" aria-hidden="true" />}
      <span className="orbit-node__body" aria-hidden="true">
        <span className="orbit-node__meta">
          <Icon size={11} />
          {node.index}
        </span>
        <span className="orbit-node__title">{node.title}</span>
        <span className="orbit-node__desc">{node.descriptor}</span>
      </span>
    </a>
  );
}

/** No-WebGL desktop: a still drawing of the orbital system with the six nodes as plain links. */
function StaticOrbit({ focus, onFocusChange }: { focus: number; onFocusChange: (i: number, on: boolean) => void }) {
  return (
    <div className="relative hidden lg:block">
      <svg viewBox="0 0 520 360" className="mx-auto w-full max-w-[34rem]" aria-hidden="true">
        <defs>
          <radialGradient id="static-orbit-light">
            <stop offset="0%" stopColor="#cfe3ff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#3d8bff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3d8bff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="none" stroke="#6f9be6">
          <ellipse cx="260" cy="180" rx="230" ry="62" strokeOpacity="0.22" transform="rotate(-10 260 180)" />
          <ellipse cx="260" cy="180" rx="176" ry="52" strokeOpacity="0.26" transform="rotate(9 260 180)" />
          <ellipse cx="260" cy="180" rx="122" ry="40" strokeOpacity="0.3" transform="rotate(-4 260 180)" />
        </g>
        <circle cx="260" cy="180" r="70" fill="url(#static-orbit-light)" />
        <g stroke="#9cc6ff" strokeOpacity="0.7" fill="#0c1a38">
          <polygon points="260,128 284,180 260,232 236,180" />
          <polyline points="236,180 260,196 284,180" fill="none" strokeOpacity="0.35" />
          <line x1="260" y1="128" x2="260" y2="232" strokeOpacity="0.35" />
        </g>
        <line x1="260" y1="96" x2="260" y2="264" stroke="#6f9be6" strokeOpacity="0.22" />
      </svg>
      <ul aria-label="Explore the system" className="mx-auto mt-6 grid max-w-[34rem] grid-cols-2 gap-3">
        {ORBITAL.nodes.map((node, i) => (
          <li key={node.kind}>
            <NodeLink node={node} i={i} pinned={false} active={focus === i} onFocusChange={onFocusChange} />
          </li>
        ))}
      </ul>
    </div>
  );
}
