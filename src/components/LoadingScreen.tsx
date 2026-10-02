import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useMediaQuery";

const MIN_MS = 900;
const MAX_MS = 4000;
const SEEN_KEY = "jg-system-online";

function seenThisSession() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Short boot sequence while the 3D layer initialises. Never blocks longer than MAX_MS. */
export default function LoadingScreen({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const [skip] = useState(seenThisSession);
  const [phase, setPhase] = useState<"loading" | "online" | "done">(skip ? "done" : "loading");
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (skip) return;
    const min = setTimeout(() => setMinElapsed(true), reduced ? 300 : MIN_MS);
    const max = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
    // Timers belong to the initial boot sequence only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulated progress that eases toward 92% until the scene reports ready.
  useEffect(() => {
    if (phase !== "loading") return;
    const tick = setInterval(() => setProgress((p) => p + (92 - p) * 0.12), 90);
    return () => clearInterval(tick);
  }, [phase]);

  useEffect(() => {
    if (phase === "loading" && ((ready && minElapsed) || timedOut)) {
      setProgress(100);
      setPhase("online");
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage unavailable — the loader simply shows again next time */
      }
    }
  }, [ready, minElapsed, timedOut, phase]);

  useEffect(() => {
    if (phase !== "online") return;
    const t = setTimeout(() => setPhase("done"), reduced ? 250 : 650);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // Keep the page still while the overlay is up.
  useEffect(() => {
    if (phase === "done") return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
    };
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.6, ease: [0.22, 1, 0.36, 1] } }}
          role="status"
          aria-live="polite"
        >
          <div className="w-[min(320px,80vw)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              {phase === "online" ? (
                <span className="text-accent-bright">System online</span>
              ) : (
                <>
                  Initializing Jeeva&rsquo;s system<span className="loader-ellipsis" aria-hidden="true" />
                </>
              )}
            </p>
            <div className="mt-4 h-px w-full overflow-hidden bg-line">
              <div
                className="h-full origin-left bg-accent transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
            <p className="mt-3 flex justify-between font-mono text-[10px] text-muted/70" aria-hidden="true">
              <span>JG/CORE</span>
              <span>{Math.round(progress).toString().padStart(3, "0")}%</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
