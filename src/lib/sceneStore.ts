// Mutable state shared between the DOM scroll tracker and the WebGL render loop.
// Kept outside React on purpose: it changes every scroll/pointer event and the
// render loop reads it every frame, so routing it through state would re-render the tree.

export const sceneState = {
  /** Continuous stage value. Integer = a formation is fully formed; fractions = morphing. */
  stage: 0,
  /** Pointer position normalised to [-1, 1]. */
  pointerX: 0,
  pointerY: 0,
  /** Final scene: "Get in touch" is hovered/focused, so the orbital system comes online. */
  connect: false,
  /** "Get in touch" centre in normalised device coordinates — where the light pulse starts. */
  ctaX: -0.4,
  ctaY: -0.3,
  /** Final scene: index of the orbital node link that is hovered/focused, or -1. */
  orbitFocus: -1,
  /** Compact final scene: where the core should sit, as a fraction of the viewport height from the section's centre. */
  orbitCoreOffset: 0,
};

/**
 * The orbital node links (ORBITAL.nodes order). On desktop 3D layouts the orbital system pins each
 * one over its node every frame; elsewhere they are not rendered and plain links are used instead.
 */
export const orbitNodeLinks: { els: (HTMLElement | null)[] } = { els: [] };

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
