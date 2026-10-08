// Particle formations for each stage of the scroll story.
// Every formation assigns a target position + colour to every particle; the render loop
// blends between neighbouring formations as the visitor scrolls.

import { capabilities, skillGroups } from "@/data/portfolio";
import { frame } from "./frameState";
import { AUDIO, GEO, HERO_ORBITS, heroOrbitPoint, NAV, ORBITAL, orbitPoint, STOBAY_STAGES, TIMELINE, type Vec3 } from "./sceneData";

export type LabelTone = "accent" | "muted" | "skill" | "orbit";

export type SceneLabel = { id: string; text: string; position: Vec3; tone?: LabelTone; group?: string };

export type Formation = {
  positions: Float32Array;
  colors: Float32Array;
  /** Radians per second around Y. Only for formations without labels. */
  spin: number;
  labels: SceneLabel[];
  /** Pairs of points drawn as thin connection lines. */
  links: Vec3[];
  /** Optional per-frame displacement (waveforms, travelling pulses). */
  animate?: (i: number, t: number, out: Vec3) => void;
};

type RGB = [number, number, number];

const WHITE: RGB = [0.8, 0.86, 1];
const BLUE: RGB = [0.22, 0.5, 1];
const BRIGHT: RGB = [0.6, 0.82, 1];
const DIM: RGB = [0.07, 0.11, 0.22];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Builder {
  positions: Float32Array;
  colors: Float32Array;
  cursor = 0;
  rand: () => number;

  constructor(public count: number, seed: number) {
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.rand = rng(seed);
  }

  /** Number of particles for a share of the total. */
  share(fraction: number) {
    return Math.floor(this.count * fraction);
  }

  get full() {
    return this.cursor >= this.count;
  }

  push(x: number, y: number, z: number, color: RGB, brightness = 1) {
    if (this.full) return -1;
    const i = this.cursor++;
    // Direct writes: this runs ~20k times during start-up, so no temporary arrays.
    const o = i * 3;
    const p = this.positions;
    const c = this.colors;
    p[o] = x;
    p[o + 1] = y;
    p[o + 2] = z;
    c[o] = color[0] * brightness;
    c[o + 1] = color[1] * brightness;
    c[o + 2] = color[2] * brightness;
    return i;
  }

  /** Random mix of white and blue so surfaces don't look flat. */
  tone(bias = 0.5): RGB {
    const t = this.rand() < bias ? this.rand() * 0.4 : 0.6 + this.rand() * 0.4;
    return [WHITE[0] + (BLUE[0] - WHITE[0]) * t, WHITE[1] + (BLUE[1] - WHITE[1]) * t, WHITE[2] + (BLUE[2] - WHITE[2]) * t];
  }

  gauss() {
    // Box–Muller, clamped to avoid far outliers.
    const u = Math.max(this.rand(), 1e-6);
    const v = this.rand();
    return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  }

  ball(cx: number, cy: number, cz: number, radius: number, n: number, color: RGB | null, brightness = 1) {
    for (let k = 0; k < n; k++) {
      this.push(cx + this.gauss() * radius * 0.5, cy + this.gauss() * radius * 0.5, cz + this.gauss() * radius * 0.5, color ?? this.tone(), brightness);
    }
  }

  stream(a: Vec3, b: Vec3, n: number, brightness = 0.6, jitter = 0.03) {
    for (let k = 0; k < n; k++) {
      const t = this.rand();
      this.push(
        a[0] + (b[0] - a[0]) * t + this.gauss() * jitter,
        a[1] + (b[1] - a[1]) * t + this.gauss() * jitter,
        a[2] + (b[2] - a[2]) * t + this.gauss() * jitter,
        BLUE,
        brightness,
      );
    }
  }

  /** Remaining particles become faint ambient dust far from the subject. */
  fillDust() {
    while (!this.full) {
      const r = 6 + this.rand() * 6;
      const th = this.rand() * Math.PI * 2;
      const ph = Math.acos(2 * this.rand() - 1);
      this.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th) - 3, DIM, 0.8);
    }
  }

  build(extra: Omit<Formation, "positions" | "colors">): Formation {
    this.fillDust();
    return { positions: this.positions, colors: this.colors, ...extra };
  }
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function fibonacciSphere(i: number, n: number, r: number): Vec3 {
  const y = 1 - (i / Math.max(n - 1, 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const th = GOLDEN * i;
  return [Math.cos(th) * radius * r, y * r, Math.sin(th) * radius * r];
}

function rotateX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

// ── 0 · Hero — orbital dust and distant data points around the person ───────
function heroField(count: number): Formation {
  const b = new Builder(count, 1);
  // Faint dust along each orbital plane: the orbits are discovered, not drawn.
  for (const o of HERO_ORBITS) {
    const n = b.share(0.03);
    for (let k = 0; k < n; k++) {
      const p = heroOrbitPoint(o, b.rand() * Math.PI * 2);
      b.push(p[0] + b.gauss() * 0.06, p[1] + b.gauss() * 0.06, p[2] + b.gauss() * 0.06, BLUE, 0.32);
    }
  }
  // Distant data points far behind — depth, not a web.
  const jitter = () => (b.rand() - 0.5) * 0.8;
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 7; x++) {
        b.ball(-6 + x * 2 + jitter(), -3.3 + y * 2.2 + jitter(), -4.8 - z * 2.6 + jitter(), 0.14, Math.max(3, b.share(0.0035)), BRIGHT, 0.32 + b.rand() * 0.3);
      }
  // Atmospheric haze around (never in front of) the person.
  const haze = b.share(0.12);
  for (let placed = 0; placed < haze; ) {
    const x = (b.rand() * 2 - 1) * 6.5;
    const y = (b.rand() * 2 - 1) * 4;
    const z = 1.5 - b.rand() * 8;
    if (Math.abs(x) < 1.9 && y > -2.8 && y < 2.6 && z > -1.4) continue;
    b.push(x, y, z, b.tone(0.3), 0.28);
    placed++;
  }
  return b.build({ spin: 0, labels: [], links: [] });
}

// ── 1 · Capability clusters ──────────────────────────────────────────────────
export const capabilityAnchors: Vec3[] = [
  [0, 1.75, 0.6],
  [-1.9, -1.05, -0.8],
  [1.9, -1.05, 0.4],
];

function capabilityCluster(count: number): Formation {
  const b = new Builder(count, 2);
  const links: Vec3[] = [];
  const labels: SceneLabel[] = [{ id: "cap-center", text: "AI Systems", position: [0, 0.75, 0], tone: "accent" }];
  b.ball(0, 0, 0, 0.6, b.share(0.08), BRIGHT, 0.8);

  capabilities.forEach((cap, ci) => {
    const anchor = capabilityAnchors[ci];
    b.ball(anchor[0], anchor[1], anchor[2], 0.55, b.share(0.1), null, 0.95);
    b.stream([0, 0, 0], anchor, b.share(0.04), 0.7);
    links.push([0, 0, 0], anchor);
    labels.push({ id: `cap-${cap.id}`, text: cap.title, position: [anchor[0], anchor[1] + 0.68, anchor[2]] });

    // Each technology becomes a small satellite node around its cluster.
    const outward = Math.atan2(anchor[1], anchor[0]);
    cap.nodes.forEach((_, ni) => {
      const spread = Math.PI * 1.1;
      const a = outward - spread / 2 + (ni / Math.max(cap.nodes.length - 1, 1)) * spread;
      const r = 0.95 + (ni % 2) * 0.22;
      const node: Vec3 = [anchor[0] + Math.cos(a) * r, anchor[1] + Math.sin(a) * r * 0.8, anchor[2] + (b.rand() - 0.5) * 1.0];
      b.ball(node[0], node[1], node[2], 0.1, Math.max(4, b.share(0.006)), BRIGHT, 0.95);
      links.push(anchor, node);
    });
  });
  return b.build({ spin: 0, labels, links });
}

// ── 2 · stobay.ai — capability flow particles (meshes carry the stages) ─────
// Public-safe: knowledge → retrieval → reasoning → response, with no internal architecture.
function stobaySystem(count: number): Formation {
  const b = new Builder(count, 3);
  const P = (i: number) => STOBAY_STAGES[i].pos;
  for (let i = 0; i < STOBAY_STAGES.length - 1; i++) b.stream(P(i), P(i + 1), b.share(0.025), 0.45, 0.03);
  // A faint haze of knowledge around the source material.
  b.ball(P(0)[0], P(0)[1], P(0)[2], 0.8, b.share(0.04), WHITE, 0.5);
  // A soft spherical field around the retrieval lens.
  const field = b.share(0.12);
  for (let k = 0; k < field; k++) {
    const p = fibonacciSphere(k, field, 0.9 + b.rand() * 0.25);
    b.push(P(1)[0] + p[0], P(1)[1] + p[1], P(1)[2] + p[2], k % 6 === 0 ? BRIGHT : b.tone(0.5), 0.7);
  }
  // What was found flows on into reasoning, then out as the answer.
  b.stream(P(1), P(2), b.share(0.06), 0.95, 0.06);
  b.ball(P(2)[0], P(2)[1], P(2)[2], 0.35, b.share(0.04), BRIGHT, 0.75);
  b.ball(P(3)[0], P(3)[1], P(3)[2], 0.3, b.share(0.02), WHITE, 0.6);
  return b.build({ spin: 0, labels: [], links: [] });
}

// ── 3 · Spatial intelligence — globe with region of interest ────────────────
function globe(count: number): Formation {
  const b = new Builder(count, 4);
  const R = GEO.radius + 0.03;
  const surface = b.share(0.45);
  for (let k = 0; k < surface; k++) {
    const p = fibonacciSphere(k, surface, R);
    b.push(p[0], p[1], p[2], b.tone(0.5), 0.55);
  }
  const { lat: lat0, lon: lon0 } = GEO.region;
  const onSphere = (lat: number, lon: number, r: number): Vec3 => [r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)];
  const region = b.share(0.12);
  for (let k = 0; k < region; k++) {
    const p = onSphere(lat0 + b.gauss() * 0.13, lon0 + b.gauss() * 0.2, R * 1.01);
    b.push(p[0], p[1], p[2], BRIGHT, 1.15);
  }
  const outline = b.share(0.03);
  for (let k = 0; k < outline; k++) {
    const a = (k / outline) * Math.PI * 2;
    const p = onSphere(lat0 + Math.sin(a) * 0.3, lon0 + Math.cos(a) * 0.42, R * 1.02);
    b.push(p[0], p[1], p[2], WHITE, 1.1);
  }
  const orbit = b.share(0.06);
  for (let k = 0; k < orbit; k++) {
    const a = (k / orbit) * Math.PI * 2;
    const p = rotateX([Math.cos(a) * 2.55, 0, Math.sin(a) * 2.55], 0.32);
    b.push(p[0], p[1], p[2], BLUE, 0.5);
  }
  return b.build({ spin: 0.12, labels: [], links: [] });
}

// ── 4 · AR navigation — street lights and the computed route ────────────────
const routeParam: number[] = [];

export function navRoute() {
  const S = NAV.step;
  const pts = NAV.path.map(([x, z]) => [x * S, z * S] as [number, number]);
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lengths.reduce((s, l) => s + l, 0);
  /** Point on the route at normalised distance s (0–1), as (x, z). */
  const at = (s: number): [number, number] => {
    let d = Math.min(Math.max(s, 0), 1) * total;
    let seg = 0;
    while (seg < lengths.length - 1 && d > lengths[seg]) d -= lengths[seg++];
    const t = d / lengths[seg];
    return [pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * t, pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * t];
  };
  return { pts, at, total };
}

function navigation(count: number): Formation {
  const b = new Builder(count, 5);
  const S = NAV.step;
  const half = NAV.blocks * S;
  const lights = b.share(0.22);
  for (let k = 0; k < lights; k++) {
    const along = (b.rand() * 2 - 1) * half;
    const lane = (Math.floor(b.rand() * (NAV.blocks * 2 + 1)) - NAV.blocks) * S;
    const [x, z] = k % 2 ? [along, lane] : [lane, along];
    b.push(x, 0.04, z, b.tone(0.4), 0.4);
  }
  const route = navRoute();
  const routeN = b.share(0.12);
  for (let k = 0; k < routeN; k++) {
    const [x, z] = route.at(k / routeN);
    const i = b.push(x, 0.1, z, BRIGHT, 1);
    if (i >= 0) routeParam[i] = k / routeN;
  }
  const [ex, ez] = route.at(1);
  const pin = b.share(0.03);
  for (let k = 0; k < pin; k++) b.push(ex + b.gauss() * 0.03, (k / pin) * 1.7, ez + b.gauss() * 0.03, BRIGHT, 0.9);
  return b.build({
    spin: 0,
    labels: [],
    links: [],
    animate: (i, t, out) => {
      const s = routeParam[i];
      if (s === undefined) return;
      const pulse = Math.max(0, Math.sin((s - t * 0.18) * Math.PI * 6));
      out[1] += pulse * pulse * 0.08;
    },
  });
}

// ── 5 · Real-time audio — voice waveform into the ASR node ──────────────────
const waveMeta: { x: number; line: number }[] = [];
const WAVE_FROM = AUDIO.device[0] + 0.6;
const WAVE_TO = AUDIO.asr[0] - 0.55;
const WAVE_MID = (WAVE_FROM + WAVE_TO) / 2;

function waveform(count: number): Formation {
  const b = new Builder(count, 6);
  const lines = 7;
  const perLine = b.share(0.08);
  for (let l = 0; l < lines; l++) {
    const z = (l - (lines - 1) / 2) * 0.18;
    for (let k = 0; k < perLine; k++) {
      const x = WAVE_FROM + (k / perLine) * (WAVE_TO - WAVE_FROM);
      const i = b.push(x, 0, z, l === 3 ? BRIGHT : b.tone(0.5), l === 3 ? 1.1 : 0.5);
      if (i >= 0) waveMeta[i] = { x, line: l };
    }
  }
  // Recognised text flowing out of the ASR node to the captions and listening devices.
  b.stream(AUDIO.asr, AUDIO.caption, b.share(0.05), 0.85, 0.04);
  for (const l of AUDIO.listeners) b.stream(AUDIO.asr, l, b.share(0.018), 0.45, 0.03);
  return b.build({
    spin: 0,
    labels: [],
    links: [],
    animate: (i, t, out) => {
      const m = waveMeta[i];
      if (!m) return;
      const u = (m.x - WAVE_MID) / ((WAVE_TO - WAVE_FROM) / 2);
      const env = Math.exp(-u * u * 1.6);
      const amp = 0.12 + 0.6 * env * (0.6 + 0.4 * Math.sin(t * 1.3 + m.line));
      out[1] += Math.sin(m.x * 3.4 - t * 3 + m.line * 0.7) * amp * (m.line === 3 ? 1 : 0.6);
    },
  });
}

// ── 6 · Stack constellation — technologies at different depths ──────────────
const FEATURED_TECH = new Set([
  "Python",
  "FastAPI",
  "React",
  "LangChain",
  "LangGraph",
  "CrewAI",
  "Qdrant",
  "PostgreSQL",
  "PostGIS",
  "Leaflet.js",
  "MapLibre GL",
  "WebSocket",
  "Whisper",
  "Sarvam AI (Saaras v3)",
  "n8n",
]);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function constellation(count: number): Formation {
  const b = new Builder(count, 7);
  const links: Vec3[] = [];
  const labels: SceneLabel[] = [{ id: "stack-center", text: "AI / Systems", position: [0, 0.62, 0], tone: "accent" }];
  b.ball(0, 0, 0, 0.55, b.share(0.07), BRIGHT, 1);
  const R = 2.1;
  skillGroups.forEach((group, gi) => {
    const a = Math.PI / 2 - (gi / skillGroups.length) * Math.PI * 2;
    const g: Vec3 = [Math.cos(a) * R, Math.sin(a) * R * 0.82, (gi % 2 ? 0.8 : -0.8) + Math.sin(a * 2) * 0.3];
    b.ball(g[0], g[1], g[2], 0.3, b.share(0.045), null, 1);
    b.stream([0, 0, 0], g, b.share(0.022), 0.55);
    links.push([0, 0, 0], g);
    group.skills.forEach((skill, si) => {
      const sa = a + ((si - (group.skills.length - 1) / 2) / group.skills.length) * 1.4;
      const r = 0.7 + (si % 2) * 0.22;
      const node: Vec3 = [g[0] + Math.cos(sa) * r, g[1] + Math.sin(sa) * r, g[2] + (b.rand() - 0.5) * 1.4];
      b.ball(node[0], node[1], node[2], 0.07, Math.max(3, b.share(0.004)), BRIGHT, 0.9);
      links.push(g, node);
      if (FEATURED_TECH.has(skill)) {
        labels.push({
          id: `tech-${slug(skill)}`,
          text: skill.replace(" (Saaras v3)", ""),
          position: [node[0], node[1] + 0.22, node[2]],
          tone: "skill",
          group: `stack-${group.id}`,
        });
      }
    });
  });
  return b.build({ spin: 0, labels, links });
}

// ── 7 · Timeline — particles flowing toward the present ─────────────────────
const flowMeta: number[] = [];

export function timelinePath() {
  const pts: Vec3[] = TIMELINE.map((n) => n.pos);
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  pts.push([last[0] + (last[0] - prev[0]) * 0.8, last[1] + (last[1] - prev[1]) * 0.8, last[2] + (last[2] - prev[2]) * 0.8]);
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]));
  const total = lengths.reduce((s, l) => s + l, 0);
  const at = (s: number): Vec3 => {
    let d = (((s % 1) + 1) % 1) * total;
    let seg = 0;
    while (seg < lengths.length - 1 && d > lengths[seg]) d -= lengths[seg++];
    const t = d / lengths[seg];
    const a = pts[seg];
    const c = pts[seg + 1];
    return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  };
  return { pts, at };
}

function timeline(count: number): Formation {
  const b = new Builder(count, 8);
  const path = timelinePath();
  const along = b.share(0.32);
  for (let k = 0; k < along; k++) {
    const s = b.rand();
    const p = path.at(s);
    const i = b.push(p[0] + b.gauss() * 0.07, p[1] + b.gauss() * 0.07, p[2] + b.gauss() * 0.07, b.tone(0.5), 0.35 + s * 0.6);
    if (i >= 0) flowMeta[i] = s;
  }
  TIMELINE.forEach((n) => b.ball(n.pos[0], n.pos[1], n.pos[2], n.latest ? 0.32 : 0.22, b.share(0.03), n.latest ? BRIGHT : WHITE, n.latest ? 1.2 : 0.85));
  return b.build({
    spin: 0,
    labels: [],
    links: [],
    animate: (i, t, out) => {
      const s = flowMeta[i];
      if (s === undefined) return;
      const from = path.at(s);
      const to = path.at(s + t * 0.025);
      out[0] += to[0] - from[0];
      out[1] += to[1] - from[1];
      out[2] += to[2] - from[2];
    },
  });
}

// ── 8 · Orbital system — trails on the rings around the core ────────────────
const trailMeta: { ring: number; a: number; r: number; lift: number }[] = [];
const trailTmp: Vec3 = [0, 0, 0];

function orbitalField(count: number): Formation {
  const b = new Builder(count, 9);
  // Travelling trails: a few short comet-like arcs per ring, brightest at the head.
  ORBITAL.rings.forEach((ring, ri) => {
    for (let trail = 0; trail < 2; trail++) {
      const head = b.rand() * Math.PI * 2;
      const len = b.share(0.018);
      for (let k = 0; k < len; k++) {
        const u = k / len;
        const i = b.push(0, 0, 0, u < 0.12 ? BRIGHT : BLUE, 0.95 - u * 0.7);
        const dir = Math.sign(ring.speed) || 1;
        if (i >= 0) trailMeta[i] = { ring: ri, a: head - dir * u * 0.9, r: ring.radius + b.gauss() * 0.025, lift: b.gauss() * 0.02 };
      }
    }
    // Faint dust that gives each ring a particulate texture.
    const dust = b.share(0.035);
    for (let k = 0; k < dust; k++) {
      const p = orbitPoint(ring, b.rand() * Math.PI * 2, trailTmp, ring.radius + b.gauss() * 0.05);
      b.push(p[0], p[1] + b.gauss() * 0.03, p[2], b.tone(0.6), 0.32);
    }
  });
  // A light shimmer close to the core.
  b.ball(0, 0, 0, 0.9, b.share(0.025), WHITE, 0.35);
  // A calm, sparse field around the system.
  const field = b.share(0.06);
  for (let placed = 0; placed < field; ) {
    const x = (b.rand() * 2 - 1) * 9;
    const y = -3.5 + b.rand() * 7;
    const z = -8 + b.rand() * 10;
    if (Math.hypot(x, y, z) < 4.6) continue;
    b.push(x, y, z, b.tone(0.3), 0.22);
    placed++;
  }
  return b.build({
    spin: 0,
    labels: [],
    links: [],
    animate: (i, t, out) => {
      const m = trailMeta[i];
      if (!m) return;
      const ring = ORBITAL.rings[m.ring];
      // A focused node's ring opens slightly; the "Get in touch" wave ripples outward through the rings.
      const focus = frame.orbitFocusRing === m.ring ? frame.orbitFocusAmt * 0.12 : 0;
      const wave = frame.orbitWave >= 0 ? Math.exp(-((m.r - frame.orbitWave) ** 2) * 3) * 0.18 : 0;
      const p = orbitPoint(ring, m.a + t * ring.speed, trailTmp, m.r + focus + wave);
      out[0] += p[0];
      out[1] += p[1] + m.lift;
      out[2] += p[2];
    },
  });
}

/** One builder per stage, in scroll order. Builders append to the shared per-particle metadata above, so they must run in this order after a reset. */
const STAGE_BUILDERS = [heroField, capabilityCluster, stobaySystem, globe, navigation, waveform, constellation, timeline, orbitalField];

function resetFormationMeta() {
  routeParam.length = 0;
  waveMeta.length = 0;
  flowMeta.length = 0;
  trailMeta.length = 0;
}

/**
 * Builds every stage's formation, one stage per task, so start-up never holds the main thread in a
 * single long block (the loading screen's timers and progress keep running on slow CPUs).
 * Returns a cancel function; `done` is not called after cancelling.
 */
export function buildFormationsIncrementally(count: number, done: (formations: Formation[]) => void): () => void {
  let cancelled = false;
  let timer = 0;
  const out: Formation[] = [];
  const step = () => {
    if (cancelled) return;
    if (out.length === 0) resetFormationMeta();
    out.push(STAGE_BUILDERS[out.length](count));
    if (out.length < STAGE_BUILDERS.length) timer = window.setTimeout(step, 0);
    else done(out);
  };
  timer = window.setTimeout(step, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
