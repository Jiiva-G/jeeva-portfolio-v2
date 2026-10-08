// Shared geometry for the 3D world: where each scene lives and the layout of its objects.
// Particle formations and meshes both read from here so they always line up.

export type Vec3 = [number, number, number];

/** World-space centre of each stage's environment. The camera travels between them. */
export const CENTERS: Vec3[] = [
  [0, 0, 0], // 0 · hero core
  [0, 0.4, -8], // 1 · capabilities
  [4, 0, -32], // 2 · stobay.ai RAG pipeline
  [-4, 0.5, -58], // 3 · spatial intelligence
  [4, -2, -84], // 4 · AR navigation
  [-4, 0.5, -110], // 5 · real-time audio
  [3, 0, -136], // 6 · stack constellation
  [-3, 0, -162], // 7 · timeline
  [0, 0, -190], // 8 · orbital system / contact
];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ── Hero — person at the centre of orbiting domain "worlds" ─────────────────
/** Transparent cutout of the real portrait (598×920 source). */
export const HERO_PERSON = { height: 4.7, width: 4.7 * (598 / 920), y: -0.2 };

export type HeroDomainKind = "genai" | "rag" | "multi" | "realtime" | "spatial" | "systems";

export type HeroOrbit = {
  id: string;
  text: string;
  kind: HeroDomainKind;
  radius: number;
  /** Tilt of the orbital plane. Positive tiltX dips the near half below the face. */
  tiltX: number;
  tiltZ: number;
  /** Vertical offset of the orbit centre. */
  y: number;
  /** Radians per second — deliberately slow. */
  speed: number;
  phase: number;
  size: number;
  /** Kept on compact screens (fewer bodies on mobile). */
  compact: boolean;
};

export const HERO_ORBITS: HeroOrbit[] = [
  { id: "orbit-genai", text: "GenAI", kind: "genai", radius: 2.9, tiltX: 0.42, tiltZ: 0.2, y: 0.55, speed: 0.07, phase: 0.4, size: 0.34, compact: true },
  { id: "orbit-rag", text: "RAG", kind: "rag", radius: 3.55, tiltX: 0.3, tiltZ: -0.24, y: 0.15, speed: 0.056, phase: 2.2, size: 0.32, compact: true },
  { id: "orbit-multi", text: "Multi-agent", kind: "multi", radius: 3.0, tiltX: 0.5, tiltZ: 0.12, y: -0.75, speed: 0.085, phase: 4.3, size: 0.3, compact: false },
  { id: "orbit-realtime", text: "Real-time", kind: "realtime", radius: 3.9, tiltX: 0.22, tiltZ: 0.06, y: 0.95, speed: 0.046, phase: 5.4, size: 0.3, compact: true },
  { id: "orbit-spatial", text: "Spatial", kind: "spatial", radius: 3.25, tiltX: 0.62, tiltZ: -0.42, y: -0.6, speed: 0.062, phase: 1.15, size: 0.33, compact: true },
  { id: "orbit-systems", text: "Systems", kind: "systems", radius: 4.3, tiltX: 0.34, tiltZ: 0.28, y: -0.15, speed: 0.041, phase: 3.3, size: 0.36, compact: false },
];

/** Position on a hero orbit at angle `a` (local to the hero centre). */
export function heroOrbitPoint(o: HeroOrbit, a: number, scale = 1): Vec3 {
  const r = o.radius * scale;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  // Rx(tiltX) then Rz(tiltZ)
  const y1 = -z * Math.sin(o.tiltX);
  const z1 = z * Math.cos(o.tiltX);
  const cz = Math.cos(o.tiltZ);
  const sz = Math.sin(o.tiltZ);
  return [x * cz - y1 * sz, x * sz + y1 * cz + o.y * scale, z1];
}

// ── stobay.ai — capability flow ─────────────────────────────────────────────
/** Public-safe representation: what the system does, not how it is built internally. */
export const STOBAY_STAGES: { id: string; text: string; pos: Vec3 }[] = [
  { id: "stobay-knowledge", text: "Business knowledge", pos: [-3.4, 0.1, -0.3] },
  { id: "stobay-retrieval", text: "Intelligent retrieval", pos: [-0.6, 0.05, -0.3] },
  { id: "stobay-reasoning", text: "Contextual reasoning", pos: [2.2, 0.15, 0.4] },
  { id: "stobay-response", text: "AI response", pos: [4.5, 0.75, 1.0] },
];

// ── Spatial intelligence ────────────────────────────────────────────────────
export const GEO = {
  radius: 1.72,
  region: { lat: 0.25, lon: 0.6 },
  tile: { center: [-0.7, -2.7, 1.5] as Vec3, size: 3.2 },
  query: [-2.3, 2.1, 0.4] as Vec3,
};

// ── AR navigation ───────────────────────────────────────────────────────────
export const NAV = {
  step: 0.9,
  blocks: 4, // streets from -blocks..blocks
  /** Shortest path along the street grid, in grid cells (x, z). */
  path: [
    [-4, 4],
    [-4, 1],
    [-1, 1],
    [-1, -2],
    [2, -2],
    [2, -4],
    [3, -4],
  ] as [number, number][],
};

// ── Real-time audio ─────────────────────────────────────────────────────────
export const AUDIO = {
  device: [-4.2, 0, 0] as Vec3,
  asr: [0, 0, 0] as Vec3,
  caption: [2.1, -0.15, 0.5] as Vec3,
  listeners: [
    [3.4, 1.35, -1.4],
    [3.7, -1.3, -1.1],
  ] as Vec3[],
};

// ── Timeline — time runs toward the viewer ──────────────────────────────────
export const TIMELINE: { id: string; text: string; pos: Vec3; latest?: boolean }[] = [
  { id: "tl-bsc", text: "B.Sc. · 2019–2022", pos: [-2.0, -1.2, -6.85] },
  { id: "tl-msc", text: "M.Sc. AI & ML · 2023–2025", pos: [-0.8, -0.55, -4.6] },
  { id: "tl-aboss", text: "ABOSS · Aug 2025", pos: [0.4, 0.1, -2.1] },
  { id: "tl-neorains", text: "NeoRains · Jan 2026 → now", pos: [1.6, 0.75, 0.5], latest: true },
];

// ── Connect — orbital system ────────────────────────────────────────────────
/** One orbital plane around the core (local to CENTERS[8]): a circle tilted about X, then Z. */
export type OrbitRing = { radius: number; tiltX: number; tiltZ: number; /** Radians per second for bodies and trails. */ speed: number };

export type OrbitNodeKind = "work" | "systems" | "experience" | "contact" | "resume" | "connect";

export type OrbitNode = {
  kind: OrbitNodeKind;
  index: string;
  title: string;
  descriptor: string;
  ring: number;
  angle: number;
  /** Label above/below the node instead of beside it (beside = facing away from the core). */
  label?: "top" | "bottom";
};

export const ORBITAL = {
  rings: [
    { radius: 2.15, tiltX: 0.15, tiltZ: 0.12, speed: 0.16 },
    { radius: 3.0, tiltX: -0.12, tiltZ: -0.16, speed: -0.11 },
    { radius: 3.85, tiltX: 0.08, tiltZ: 0.2, speed: 0.07 },
  ] as OrbitRing[],
  /**
   * Fixed positions on the rings: the nodes are click targets, so they never drift. Placed (by a
   * layout search) so every label clears the text column, the nav, the core and each other at
   * 1440×900 and 1280×720.
   */
  nodes: [
    { kind: "work", index: "01", title: "Work", descriptor: "Build · Ship · Iterate", ring: 1, angle: 3.95 },
    { kind: "systems", index: "02", title: "Systems", descriptor: "Architect · Integrate · Scale", ring: 2, angle: 4.84, label: "top" },
    { kind: "experience", index: "03", title: "Experience", descriptor: "Design · Build · Deliver", ring: 1, angle: 2.45 },
    { kind: "contact", index: "04", title: "Contact", descriptor: "Collaborate · Create · Grow", ring: 2, angle: 1.9, label: "bottom" },
    { kind: "resume", index: "05", title: "Resume", descriptor: "Skills · Projects · Impact", ring: 1, angle: 0.69 },
    { kind: "connect", index: "06", title: "Connect", descriptor: "Let’s build together", ring: 0, angle: 5.94 },
  ] as OrbitNode[],
};

/** Point on an orbital ring at angle `a` (local to the core). */
export function orbitPoint(ring: OrbitRing, a: number, out: Vec3 = [0, 0, 0], radius = ring.radius): Vec3 {
  const x = Math.cos(a) * radius;
  const z = Math.sin(a) * radius;
  const y1 = -z * Math.sin(ring.tiltX);
  const z1 = z * Math.cos(ring.tiltX);
  const cz = Math.cos(ring.tiltZ);
  const sz = Math.sin(ring.tiltZ);
  out[0] = x * cz - y1 * sz;
  out[1] = x * sz + y1 * cz;
  out[2] = z1;
  return out;
}
