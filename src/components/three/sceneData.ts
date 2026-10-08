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
  [0, 0, -190], // 8 · convergence / contact
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

// ── stobay.ai — RAG pipeline ────────────────────────────────────────────────
export const RAG_STEPS: { id: string; text: string; pos: Vec3 }[] = [
  { id: "rag-query", text: "Query", pos: [-4.4, 0.9, 0.8] },
  { id: "rag-docs", text: "Documents", pos: [-3.2, 0.05, -0.3] },
  { id: "rag-chunk", text: "Chunking", pos: [-2.0, -0.15, -0.5] },
  { id: "rag-embed", text: "Embeddings", pos: [-0.8, 0.1, -0.4] },
  { id: "rag-vector", text: "Vector DB", pos: [0.5, 0, -0.2] },
  { id: "rag-retrieve", text: "Retrieval", pos: [1.6, 0.25, 0.1] },
  { id: "rag-context", text: "Context", pos: [2.6, 0.5, 0.4] },
  { id: "rag-llm", text: "LLM", pos: [3.6, 0, 0.7] },
  { id: "rag-response", text: "Response", pos: [4.7, 0.75, 1.1] },
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

// ── Connect — System Convergence ────────────────────────────────────────────
export type ConvergenceKind = "genai" | "rag" | "multi" | "spatial" | "realtime" | "systems";

export type ConvergenceChannel = { id: string; index: string; text: string; kind: ConvergenceKind; from: Vec3 };

/** Six systems, six conduits, one hexagonal core (local to CENTERS[8]). */
export const CONVERGENCE = {
  coreY: 0.55,
  /** Radius of the hex frame; channel ports sit just outside it. */
  radius: 1.45,
  channels: [
    { id: "conv-genai", index: "01", text: "GenAI", kind: "genai", from: [-5.8, 4.0, -4.5] },
    { id: "conv-rag", index: "02", text: "RAG", kind: "rag", from: [-8.2, 0.7, 1.4] },
    { id: "conv-realtime", index: "03", text: "Real-time", kind: "realtime", from: [-9.6, -2.5, 1.4] },
    { id: "conv-multi", index: "04", text: "Multi-agent", kind: "multi", from: [9.6, -2.7, 1.2] },
    { id: "conv-spatial", index: "05", text: "Spatial", kind: "spatial", from: [8.2, 0.3, 1.1] },
    { id: "conv-systems", index: "06", text: "Systems", kind: "systems", from: [5.8, 4.2, -5.0] },
  ] as ConvergenceChannel[],
};

/** Where a channel plugs into the core. */
export function convergencePort(ch: ConvergenceChannel): Vec3 {
  const len = Math.hypot(ch.from[0], ch.from[2]) || 1;
  const r = CONVERGENCE.radius + 0.1;
  const y = CONVERGENCE.coreY + Math.max(-0.7, Math.min(0.7, ch.from[1] * 0.16));
  return [(ch.from[0] / len) * r, y, (ch.from[2] / len) * r];
}

/** Point along a channel: u = 0 at its far end, u = 1 at the core port. */
export function convergencePoint(ch: ConvergenceChannel, u: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const p = convergencePort(ch);
  const c: Vec3 = [ch.from[0] * 0.42, ch.from[1] * 0.35 + CONVERGENCE.coreY * 0.6, ch.from[2] * 0.42];
  const iu = 1 - u;
  out[0] = iu * iu * ch.from[0] + 2 * iu * u * c[0] + u * u * p[0];
  out[1] = iu * iu * ch.from[1] + 2 * iu * u * c[1] + u * u * p[1];
  out[2] = iu * iu * ch.from[2] + 2 * iu * u * c[2] + u * u * p[2];
  return out;
}
