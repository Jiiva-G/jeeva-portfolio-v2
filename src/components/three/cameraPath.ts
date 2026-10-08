import * as THREE from "three";
import { add, CENTERS, type Vec3 } from "./sceneData";
import { smoothstep } from "./frameState";

type Key = {
  stage: number;
  scene: number;
  pos: Vec3;
  target: Vec3;
  /** How the camera arrives at this key: an eased move between places, or a slow linear pan. */
  ease: "move" | "pan";
};

// Camera choreography. Offsets are relative to the scene centre.
const KEYS: Key[] = [
  { stage: 0, scene: 0, pos: [0, 0.2, 9.8], target: [0, 0, 0], ease: "move" },
  { stage: 1, scene: 1, pos: [3.5, 2.2, 10.5], target: [0, 0, 0], ease: "move" },
  { stage: 1.8, scene: 2, pos: [-2.4, 1.6, 12.2], target: [-1.2, 0, 0], ease: "move" },
  { stage: 2.3, scene: 2, pos: [1.4, 1.0, 11.2], target: [1.2, 0, 0], ease: "pan" },
  { stage: 2.8, scene: 3, pos: [0.2, 1.3, 11.5], target: [-0.3, -0.4, 0], ease: "move" },
  { stage: 3.3, scene: 3, pos: [0.6, 1.4, 9.6], target: [-0.6, -1.6, 1.2], ease: "pan" },
  { stage: 3.8, scene: 4, pos: [-3.5, 8.5, 10.5], target: [-1, 0, 0], ease: "move" },
  { stage: 4.3, scene: 4, pos: [1.2, 7.5, 9], target: [1.2, 0, -0.8], ease: "pan" },
  { stage: 5, scene: 5, pos: [-0.6, 1.0, 11.6], target: [-0.6, 0, 0], ease: "move" },
  { stage: 5.8, scene: 6, pos: [-3, 1.6, 10.8], target: [0, 0, 0], ease: "move" },
  { stage: 6.3, scene: 6, pos: [2.2, 0.6, 10.4], target: [0, 0, 0], ease: "pan" },
  { stage: 7, scene: 7, pos: [-13.6, 2.8, -0.4], target: [0, -0.1, -3.1], ease: "move" },
  // Final scene: a slightly elevated view, so the orbits read as ellipses around the core.
  { stage: 8, scene: 8, pos: [0, 5.36, 11.1], target: [0, 0, 0], ease: "move" },
];

const posCurve = new THREE.CatmullRomCurve3(
  KEYS.map((k) => new THREE.Vector3(...add(CENTERS[k.scene], k.pos))),
  false,
  "centripetal",
);
const targetCurve = new THREE.CatmullRomCurve3(
  KEYS.map((k) => new THREE.Vector3(...add(CENTERS[k.scene], k.target))),
  false,
  "centripetal",
);

/** Curve parameter for a stage value: eased between places so the camera settles at each one. */
function curveParam(stage: number) {
  const last = KEYS.length - 1;
  if (stage <= KEYS[0].stage) return 0;
  if (stage >= KEYS[last].stage) return 1;
  let i = 0;
  while (i < last - 1 && stage > KEYS[i + 1].stage) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const local = (stage - a.stage) / (b.stage - a.stage);
  const eased = b.ease === "pan" ? local : smoothstep(0, 1, local);
  return (i + eased) / last;
}

export function sampleCamera(stage: number, pos: THREE.Vector3, target: THREE.Vector3) {
  const u = curveParam(stage);
  posCurve.getPoint(u, pos);
  targetCurve.getPoint(u, target);
}

/** Points along the whole journey — used to scatter foreground dust the camera flies through. */
export function journeyPoints(samples: number) {
  return posCurve.getSpacedPoints(samples);
}

/**
 * Horizontal off-axis shift per stage (fraction of viewport width) so each subject sits
 * beside its text panel. Negative = subject appears on the right.
 */
export const VIEW_SHIFT = [-0.2, -0.18, -0.2, 0.21, -0.2, 0.2, -0.2, -0.2, -0.145];
