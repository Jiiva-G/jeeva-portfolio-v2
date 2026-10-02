import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** Below this width content stacks over the 3D scene instead of sitting beside it. */
export const useCompactLayout = () => useMediaQuery("(max-width: 1023px)");

export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");
