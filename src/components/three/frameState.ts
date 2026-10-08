// Per-frame values computed once by the World rig and read by every scene object.

export const frame = {
  /** Smoothed, continuous stage (see useSceneScroll). */
  stage: 0,
  /** Animation clock in seconds; frozen when reduced motion is on. */
  time: 0,
  reduced: false,
  lowPower: false,
  /** Pointer is over the hero portrait (raycast). */
  portraitHover: false,
  /** Final scene, smoothed by the orbital system: focused ring (-1 none), its strength, and the CTA pulse wave. */
  orbitFocusRing: -1,
  orbitFocusAmt: 0,
  /** Radius (local units) of the outward pulse after "Get in touch" activates; <0 when idle. */
  orbitWave: -1,
};

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 1 at stage k, falling to 0 at ±width. */
export const presence = (stage: number, k: number, width = 1) => Math.max(0, 1 - Math.abs(stage - k) / width);

/** Linear 0→1 progress of the stage between a and b. */
export const progress = (stage: number, a: number, b: number) => clamp01((stage - a) / (b - a));
