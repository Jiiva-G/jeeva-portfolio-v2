import { forwardRef, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { scenes, type SceneId } from "@/data/portfolio";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" } & Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "className" | "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
>;

export function Reveal({ children, delay = 0, className, as = "div", ...rest }: RevealProps) {
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component
      {...rest}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

/** `03 / Systems` — ties each section back to the progress indicator. */
export function Eyebrow({ scene, children }: { scene: SceneId; children?: ReactNode }) {
  const index = scenes.findIndex((s) => s.id === scene);
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
      <span className="text-accent-bright">{String(index + 1).padStart(2, "0")}</span>
      <span className="h-px w-8 bg-line-strong" aria-hidden="true" />
      {children ?? scenes[index].label}
    </p>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-line bg-white/[0.025] px-2.5 py-1 font-mono text-[11px] text-ink/80", className)}>
      {children}
    </span>
  );
}

/** Slight pull toward the pointer. No-op for touch and reduced motion. */
function useMagnetic<T extends HTMLElement>(strength = 0.25) {
  const ref = useRef<T | null>(null);
  const handlers = {
    onPointerMove: (e: React.PointerEvent<T>) => {
      const el = ref.current;
      if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
    },
    onPointerLeave: () => {
      if (ref.current) ref.current.style.transform = "";
    },
  };
  return [ref, handlers] as const;
}

const actionBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[14px] font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-out will-change-transform";
const actionVariants = {
  primary: "bg-ink text-bg hover:bg-white hover:shadow-[0_0_32px_-4px_rgba(124,182,255,0.55)]",
  ghost: "border border-line-strong bg-white/[0.02] text-ink hover:border-accent/60 hover:bg-accent/10",
};

type Variant = keyof typeof actionVariants;

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

export const ActionLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }>(
  ({ variant = "ghost", className, ...props }, forwarded) => {
    const [ref, handlers] = useMagnetic<HTMLAnchorElement>();
    const external = props.href?.startsWith("http");
    return (
      <a
        ref={mergeRefs(ref, forwarded)}
        {...handlers}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
        className={cn(actionBase, actionVariants[variant], className)}
      />
    );
  },
);
ActionLink.displayName = "ActionLink";

export function ActionButton({ variant = "ghost", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const [ref, handlers] = useMagnetic<HTMLButtonElement>();
  return <button ref={ref} type="button" {...handlers} {...props} className={cn(actionBase, actionVariants[variant], className)} />;
}
