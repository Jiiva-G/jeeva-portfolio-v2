import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { navItems, profile, scenes, type SceneId } from "@/data/portfolio";
import { scrollToScene } from "@/lib/sceneStore";
import { cn } from "@/lib/utils";

export default function Navbar({ active }: { active: SceneId }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id: SceneId) => {
    setOpen(false);
    scrollToScene(id);
  };

  const activeIndex = scenes.findIndex((s) => s.id === active);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Primary"
        className={cn(
          "pointer-events-auto relative flex w-full max-w-[44rem] items-center justify-between rounded-full border px-2 py-1.5 transition-all duration-500",
          scrolled ? "border-line bg-surface/70 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "border-transparent bg-transparent",
        )}
      >
        <button
          type="button"
          onClick={() => go("intro")}
          className="group flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[13px] font-medium tracking-[0.24em] text-ink"
          aria-label={`${profile.name} — back to top`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(61,139,255,0.6)]" />
          </span>
          {profile.shortName}
        </button>

        <ul className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const current = item.target === active;
            return (
              <li key={item.target}>
                <button
                  type="button"
                  onClick={() => go(item.target)}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-[13px] transition-colors duration-300",
                    current ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {current && <span className="absolute inset-0 rounded-full bg-white/[0.06]" aria-hidden="true" />}
                  <span className="relative">{item.label}</span>
                </button>
              </li>
            );
          })}
          {/* Quiet direct download; the 3D resume module in Connect stays the in-scene treatment. */}
          <li className="ml-1 flex items-center border-l border-line pl-1">
            <a
              href={profile.resume.href}
              download={profile.resume.fileName}
              type="application/pdf"
              aria-label="Resume — download PDF"
              className="rounded-full px-4 py-2 text-[13px] text-muted transition-colors duration-300 hover:text-ink"
            >
              Resume
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-2 md:hidden">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, "0")} / {scenes[activeIndex]?.label}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/60 text-ink backdrop-blur"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {open && (
          <ul
            id="mobile-menu"
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-3xl border border-line bg-surface/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
          >
            {navItems.map((item) => (
              <li key={item.target}>
                <button
                  type="button"
                  onClick={() => go(item.target)}
                  aria-current={item.target === active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px]",
                    item.target === active ? "bg-white/[0.06] text-ink" : "text-muted",
                  )}
                >
                  {item.label}
                  <span className="font-mono text-[10px] text-muted">
                    {String(scenes.findIndex((s) => s.id === item.target) + 1).padStart(2, "0")}
                  </span>
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <a
                href={profile.resume.href}
                download={profile.resume.fileName}
                type="application/pdf"
                aria-label="Resume — download PDF"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px] text-muted"
              >
                Resume
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PDF</span>
              </a>
            </li>
          </ul>
        )}
      </nav>
    </header>
  );
}
