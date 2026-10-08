import { useEffect, useState } from "react";
import { SCENE_INVALIDATE, sceneState, STAGE_COUNT } from "@/lib/sceneStore";
import type { SceneId } from "@/data/portfolio";

/**
 * Tracks every element marked with `data-stage` / `data-scene` and converts the
 * scroll position into a continuous stage value for the 3D scene, plus the
 * currently active scene for navigation UI.
 */
export function useSceneScroll() {
  const [active, setActive] = useState<SceneId>("intro");

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-stage]"));
      if (!blocks.length) return;

      const center = window.innerHeight / 2;
      let stage = 0;
      let activeScene = blocks[0].dataset.scene as SceneId;

      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        const index = Number(block.dataset.stage);
        if (rect.top <= center) {
          const local = Math.min(Math.max((center - rect.top) / rect.height, 0), 1);
          // Centre of a block maps to its integer stage; edges are the morph between neighbours.
          stage = index + local - 0.5;
          activeScene = block.dataset.scene as SceneId;
        }
      }

      const next = Math.min(Math.max(stage, 0), STAGE_COUNT - 1);
      if (next !== sceneState.stage) {
        sceneState.stage = next;
        // On-demand (reduced-motion) rendering may already have drawn this frame with the old stage.
        window.dispatchEvent(new Event(SCENE_INVALIDATE));
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // Exposed as a CSS variable so progress UI updates without React re-renders.
      document.documentElement.style.setProperty("--scroll-progress", String(max > 0 ? window.scrollY / max : 0));
      setActive(activeScene);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return active;
}

/** Normalised pointer position for subtle parallax in the 3D scene. */
export function usePointerTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      sceneState.pointerX = 0;
      sceneState.pointerY = 0;
      return;
    }
    const onMove = (e: PointerEvent) => {
      sceneState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled]);
}
