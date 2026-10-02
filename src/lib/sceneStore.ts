// Mutable state shared between the DOM scroll tracker and the WebGL render loop.
// Kept outside React on purpose: it changes every scroll/pointer event and the
// render loop reads it every frame, so routing it through state would re-render the tree.

export const sceneState = {
  /** Continuous stage value. Integer = a formation is fully formed; fractions = morphing. */
  stage: 0,
  /** Pointer position normalised to [-1, 1]. */
  pointerX: 0,
  pointerY: 0,
  /** Final scene: the primary CTA is hovered/focused, so the next node comes online. */
  connect: false,
  /** Primary CTA centre in normalised device coordinates — where the node's beam aims. */
  ctaX: -0.4,
  ctaY: -0.3,
  /** Final scene: the resume download link is hovered/focused, so the resume module activates. */
  resume: false,
};

/**
 * The resume download link. On desktop 3D layouts the resume module pins it over its own
 * screen position every frame; everywhere else it stays in the normal document flow.
 */
export const resumeLink: { el: HTMLElement | null } = { el: null };

/** Fired when DOM state the 3D scene reads changes; on-demand (reduced-motion) rendering redraws on it. */
export const SCENE_INVALIDATE = "scene:invalidate";

/** Total number of 3D formations (see components/three/formations.ts). */
export const STAGE_COUNT = 9;

export function scrollToScene(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Move focus for keyboard and screen reader users without a second scroll jump.
  el.focus({ preventScroll: true });
}

/** Highlights the matching floating label(s) in the 3D scene — by id or by group (if the 3D layer is active). */
export function highlightSceneLabel(id: string, on: boolean) {
  document.querySelectorAll(`[data-label-id="${id}"], [data-label-group="${id}"]`).forEach((el) => el.classList.toggle("is-active", on));
}
