import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneState } from "@/lib/sceneStore";
import { clamp01, frame, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { CENTERS, CONVERGENCE, convergencePoint, convergencePort, type ConvergenceChannel, type Vec3 } from "../sceneData";
import { createDotTexture, createFloorTexture, createGlowTexture } from "../textures";

const SCENE = 8;
const { coreY: CY, radius: R } = CONVERGENCE;
const FRAME_H = 2.5;
const RING_Y = [CY - 0.8, CY, CY + 0.8];
const PULSE_TIME = 0.6; // CTA → core
const WAVE_SPEED = 0.9; // core → out along every channel

type ConvState = {
  vis: number;
  build: number;
  act: number;
  wasOn: boolean;
  pulseStart: number;
};
type StateRef = MutableRefObject<ConvState>;

/** 0→1 for a short window after the CTA pulse reaches the core. */
const arrival = (s: ConvState) => Math.exp(-Math.pow((frame.time - s.pulseStart - PULSE_TIME) * 5, 2));
/** Progress of the outbound wave along the channels (−1 = none). */
const wave = (s: ConvState) => {
  const w = (frame.time - s.pulseStart - PULSE_TIME) * WAVE_SPEED;
  return w >= 0 && w <= 1.3 ? w : -1;
};

// ── Channels ─────────────────────────────────────────────────────────────────
const channelVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const channelFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uWave;
  uniform float uAct;
  varying float vT;
  void main() {
    float inflow = pow(fract(vT * 7.0 - uTime * 0.35), 10.0);
    float band = uWave < 0.0 ? 0.0 : exp(-pow((vT - (1.0 - uWave)) * 12.0, 2.0));
    float a = (0.08 + 0.45 * inflow + 0.9 * band + 0.12 * uAct) * smoothstep(0.0, 0.18, vT) * uOpacity;
    gl_FragColor = vec4(0.5, 0.72, 1.0, a);
  }
`;

function Channel({ ch, state, lowPower }: { ch: ConvergenceChannel; state: StateRef; lowPower: boolean }) {
  const n = lowPower ? 5 : 9;
  const line = useMemo(() => {
    const N = 120;
    const pts: number[] = [];
    const ts: number[] = [];
    const p: Vec3 = [0, 0, 0];
    for (let i = 0; i <= N; i++) {
      convergencePoint(ch, i / N, p);
      pts.push(...p);
      ts.push(i / N);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: channelVertex,
      fragmentShader: channelFragment,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uWave: { value: -1 }, uAct: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Line(g, m);
  }, [ch]);

  const port = useMemo(() => {
    const p = convergencePort(ch);
    const o = new THREE.Object3D();
    o.position.set(...p);
    o.lookAt(p[0] * 2, p[1], p[2] * 2);
    return { pos: p, rot: o.rotation.clone() };
  }, [ch]);

  // Packets that carry this system's character toward the core.
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(26 * 3), 3));
    return g;
  }, []);
  const waveLine = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#bcd8ff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  }, []);
  const dot = useMemo(createDotTexture, []);
  const pointsMat = useRef<THREE.PointsMaterial>(null);
  const portMat = useRef<THREE.MeshBasicMaterial>(null);
  const tmp = useMemo(() => ({ dummy: new THREE.Object3D(), a: [0, 0, 0] as Vec3, b: [0, 0, 0] as Vec3 }), []);

  const instanceCount = ch.kind === "multi" ? n * 3 : n;

  useFrame(() => {
    const s = state.current;
    const t = frame.time;
    const m = line.material as THREE.ShaderMaterial;
    m.uniforms.uTime.value = t;
    m.uniforms.uOpacity.value = s.vis;
    m.uniforms.uWave.value = wave(s);
    m.uniforms.uAct.value = s.act;
    if (portMat.current) portMat.current.color.setRGB(0.15 + 0.5 * s.act + 0.6 * arrival(s), 0.3 + 0.5 * s.act + 0.5 * arrival(s), 0.7 + 0.3 * s.act);

    const speed = 0.06;
    const env = (u: number) => smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u)) * s.vis;
    const { dummy, a, b } = tmp;

    if (meshRef.current) {
      for (let k = 0; k < n; k++) {
        const u = (k / n + t * speed) % 1;
        convergencePoint(ch, u, a);
        convergencePoint(ch, Math.min(u + 0.02, 1), b);
        const sc = Math.max(env(u), 0.001);
        if (ch.kind === "multi") {
          // Coordinated agents: three nodes moving in formation.
          for (let j = 0; j < 3; j++) {
            const ang = (j / 3) * Math.PI * 2 + t * 0.8;
            dummy.position.set(a[0] + Math.cos(ang) * 0.12, a[1] + Math.sin(ang) * 0.12, a[2]);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(sc);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(k * 3 + j, dummy.matrix);
          }
          continue;
        }
        dummy.position.set(a[0], a[1], a[2]);
        dummy.lookAt(b[0], b[1], b[2]);
        if (ch.kind === "systems") dummy.rotation.set(t * 0.6 + k, t * 0.4 + k, 0);
        if (ch.kind === "spatial") dummy.rotation.set(0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(k, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (ch.kind === "genai") {
      // Generated data: a soft particle stream swirling along the conduit.
      const arr = pointsGeo.attributes.position.array as Float32Array;
      for (let k = 0; k < 26; k++) {
        const u = (k / 26 + t * speed * 1.2) % 1;
        convergencePoint(ch, u, a);
        const ang = k * 2.4 + t * 1.5;
        const r = 0.14 * (1 - u * 0.7);
        arr.set([a[0] + Math.cos(ang) * r, a[1] + Math.sin(ang) * r, a[2] + Math.sin(ang * 0.7) * r], k * 3);
      }
      pointsGeo.attributes.position.needsUpdate = true;
      if (pointsMat.current) pointsMat.current.opacity = 0.9 * s.vis;
    }

    if (ch.kind === "realtime") {
      // A live signal travelling down the channel.
      const arr = waveLine.geometry.attributes.position.array as Float32Array;
      const head = (t * speed * 1.4) % 1;
      for (let i = 0; i < 64; i++) {
        const u = clamp01(head - (i / 63) * 0.3);
        convergencePoint(ch, u, a);
        const e = Math.sin((i / 63) * Math.PI);
        arr.set([a[0], a[1] + Math.sin(i * 0.8 - t * 8) * 0.13 * e, a[2]], i * 3);
      }
      waveLine.geometry.attributes.position.needsUpdate = true;
      (waveLine.material as THREE.LineBasicMaterial).opacity = s.vis * 0.9 * (1 - smoothstep(0.85, 1, head)) * smoothstep(0, 0.15, head + 0.001);
    }
  });

  const labelPos = useMemo<Vec3>(() => {
    // Upper channels carry their marker further in so it stays on screen; lower ones stay clear of the heading.
    const p = convergencePoint(ch, ch.from[1] > 2 ? 0.42 : 0.2);
    return [p[0], p[1] + 0.32, p[2]];
  }, [ch]);

  const packetMaterial = (
    <meshStandardMaterial
      color={ch.kind === "multi" ? "#9cc6ff" : "#2a3d66"}
      emissive={ch.kind === "multi" ? "#7cb6ff" : "#2f6fe8"}
      emissiveIntensity={ch.kind === "multi" ? 0.9 : 0.3}
      metalness={0.3}
      roughness={0.4}
    />
  );

  return (
    <group>
      <primitive object={line} />
      {ch.kind === "rag" && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, instanceCount]} frustumCulled={false}>
          <boxGeometry args={[0.17, 0.22, 0.012]} />
          {packetMaterial}
        </instancedMesh>
      )}
      {ch.kind === "spatial" && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, instanceCount]} frustumCulled={false}>
          <boxGeometry args={[0.24, 0.012, 0.24]} />
          {packetMaterial}
        </instancedMesh>
      )}
      {ch.kind === "systems" && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, instanceCount]} frustumCulled={false}>
          <boxGeometry args={[0.13, 0.13, 0.13]} />
          {packetMaterial}
        </instancedMesh>
      )}
      {ch.kind === "multi" && (
        <instancedMesh ref={meshRef} args={[undefined, undefined, instanceCount]} frustumCulled={false}>
          <sphereGeometry args={[0.032, 10, 10]} />
          {packetMaterial}
        </instancedMesh>
      )}
      {ch.kind === "genai" && (
        <points geometry={pointsGeo} frustumCulled={false}>
          <pointsMaterial ref={pointsMat} map={dot} size={0.11} color="#cfe3ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
      {ch.kind === "realtime" && <primitive object={waveLine} />}

      {/* Input port on the core */}
      <group position={port.pos} rotation={port.rot}>
        <mesh>
          <boxGeometry args={[0.26, 0.16, 0.12]} />
          <meshStandardMaterial color="#16223f" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.062]}>
          <planeGeometry args={[0.18, 0.05]} />
          <meshBasicMaterial ref={portMat} color="#264a8f" toneMapped={false} />
        </mesh>
      </group>
      <LabelAnchor id={ch.id} position={labelPos} visibility={() => state.current.vis * 0.85} />
    </group>
  );
}

// ── Core ─────────────────────────────────────────────────────────────────────
const hexPoint = (k: number, r = R): [number, number] => {
  const a = Math.PI / 6 + (k / 6) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

function Core({ state, lowPower }: { state: StateRef; lowPower: boolean }) {
  const glow = useMemo(createGlowTexture, []);
  const floor = useMemo(createFloorTexture, []);

  const frameParts = useMemo(() => {
    const pts = Array.from({ length: 7 }, (_, k) => {
      const [x, z] = hexPoint(k % 6);
      return new THREE.Vector3(x, 0, z);
    });
    const loop = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: "#5e8fe0", transparent: true, depthWrite: false });
    const loops = [CY - FRAME_H / 2, CY + FRAME_H / 2].map((y) => {
      const l = new THREE.Line(loop, lineMat);
      l.position.y = y;
      return l;
    });
    return {
      loops,
      lineMat,
      strut: new THREE.BoxGeometry(0.045, 1, 0.045).translate(0, 0.5, 0),
      faceMat: new THREE.MeshStandardMaterial({ color: "#9cc6ff", transparent: true, depthWrite: false, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.1 }),
    };
  }, []);
  const faces = useMemo(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const [x0, z0] = hexPoint(k);
        const [x1, z1] = hexPoint(k + 1);
        return { pos: [(x0 + x1) / 2, CY, (z0 + z1) / 2] as Vec3, rotY: -Math.atan2(z1 - z0, x1 - x0) };
      }),
    [],
  );
  const segmentGeos = useMemo(
    () =>
      Array.from({ length: 6 }, (_, k) => new THREE.RingGeometry(0.62, 1.12, 10, 1, (k / 6) * Math.PI * 2 + 0.06, (Math.PI * 2) / 6 - 0.12).rotateX(-Math.PI / 2)),
    [],
  );
  // One material per system segment so each lights with its own channel.
  const segmentMats = useMemo(
    () => Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ color: "#16223f", emissive: "#3d8bff", metalness: 0.55, roughness: 0.3, side: THREE.DoubleSide })),
    [],
  );
  const lattice = useMemo(() => {
    const cells: { home: THREE.Vector3; from: THREE.Vector3 }[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    // 3×3×3 modules on capable devices, a lighter 2×3×2 lattice on low-power ones.
    const xz = lowPower ? [-1, 1] : [-1, 0, 1];
    for (const x of xz)
      for (let y = -1; y <= 1; y++)
        for (const z of xz) {
          const dir = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(2.2 + rand() * 1.5);
          cells.push({ home: new THREE.Vector3(x * 0.2, y * 0.2, z * 0.2), from: dir });
        }
    return cells;
  }, [lowPower]);

  const struts = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Group | null)[]>([]);
  const latticeRef = useRef<THREE.InstancedMesh>(null);
  const latticeGroup = useRef<THREE.Group>(null);
  const latticeMat = useRef<THREE.MeshStandardMaterial>(null);
  const spine = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const floorMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringAngles = useRef([0, 0, 0]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    const t = frame.time;
    const v = s.vis;
    const b = s.build;
    const hit = arrival(s);

    // Assembly while arriving: struts rise, rings stack, modules lock into the lattice.
    const kStruts = smoothstep(0, 0.45, b);
    struts.current.forEach((m) => {
      if (m) m.scale.y = Math.max(kStruts, 0.001) * FRAME_H;
    });
    frameParts.faceMat.opacity = v * 0.03 * smoothstep(0.3, 0.7, b);
    frameParts.lineMat.opacity = v * 0.55 * kStruts;

    rings.current.forEach((g, i) => {
      if (!g) return;
      const k = smoothstep(0.25 + i * 0.12, 0.6 + i * 0.12, b);
      const dir = i % 2 ? -1 : 1;
      if (!frame.reduced) ringAngles.current[i] += dt * (0.1 + 0.05 * i + s.act * 0.5) * dir;
      g.rotation.y = ringAngles.current[i] + (frame.reduced ? i * 0.3 : 0);
      g.scale.setScalar(Math.max(k, 0.001) * (1 + hit * 0.06));
    });
    segmentMats.forEach((m, k) => {
      // Each segment flashes as its system's data arrives.
      const flash = frame.reduced ? 0 : Math.pow((t * 0.3 + k / 6) % 1, 8);
      m.emissiveIntensity = (0.04 + 0.5 * flash + 0.55 * s.act + 0.7 * hit) * v;
    });

    const kLattice = smoothstep(0.5, 1, b);
    if (latticeRef.current) {
      lattice.forEach((c, i) => {
        dummy.position.copy(c.from).multiplyScalar(1 - kLattice).add(c.home);
        dummy.rotation.set((1 - kLattice) * (i + t), (1 - kLattice) * i, 0);
        dummy.scale.setScalar(Math.max(smoothstep(0.4, 0.7, b), 0.001));
        dummy.updateMatrix();
        latticeRef.current!.setMatrixAt(i, dummy.matrix);
      });
      latticeRef.current.instanceMatrix.needsUpdate = true;
    }
    if (latticeGroup.current && !frame.reduced) {
      latticeGroup.current.rotation.y += dt * (0.15 + s.act * 0.6);
      latticeGroup.current.rotation.x = Math.sin(t * 0.25) * 0.15;
    }
    if (latticeMat.current) latticeMat.current.emissiveIntensity = 0.25 + 0.8 * s.act + 1.1 * hit;
    if (spine.current) spine.current.opacity = v * (0.3 + 0.5 * s.act + 0.4 * hit) * kStruts;
    if (glowMat.current) glowMat.current.opacity = v * (0.16 + 0.22 * s.act + 0.25 * hit);
    if (floorMat.current) floorMat.current.opacity = v * 0.22;
  });

  return (
    <group>
      <mesh position={[0, CY - FRAME_H / 2 - 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial ref={floorMat} map={floor} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <sprite position={[0, CY, -0.6]} scale={[5.5, 5.5, 1]}>
        <spriteMaterial ref={glowMat} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* Hex frame: six struts, one per system */}
      {Array.from({ length: 6 }, (_, k) => {
        const [x, z] = hexPoint(k);
        return (
          <mesh
            key={k}
            ref={(m) => {
              struts.current[k] = m;
            }}
            geometry={frameParts.strut}
            position={[x, CY - FRAME_H / 2, z]}
          >
            <meshStandardMaterial color="#22345e" metalness={0.5} roughness={0.35} />
          </mesh>
        );
      })}
      {frameParts.loops.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      {faces.map((f, k) => (
        <mesh key={k} position={f.pos} rotation={[0, f.rotY, 0]} material={frameParts.faceMat}>
          <planeGeometry args={[R, FRAME_H]} />
        </mesh>
      ))}

      {/* Stacked rings, six segments each */}
      {RING_Y.map((y, i) => (
        <group
          key={y}
          position={[0, y, 0]}
          ref={(g) => {
            rings.current[i] = g;
          }}
        >
          {segmentGeos.map((g, k) => (
            <mesh key={k} geometry={g} material={segmentMats[k]} />
          ))}
        </group>
      ))}

      {/* Light spine through the centre */}
      <mesh position={[0, CY, 0]}>
        <cylinderGeometry args={[0.02, 0.02, FRAME_H, 8]} />
        <meshBasicMaterial ref={spine} color="#9cc6ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Internal modules locking into a lattice */}
      <group ref={latticeGroup} position={[0, CY, 0]}>
        <instancedMesh ref={latticeRef} args={[undefined, undefined, lattice.length]} frustumCulled={false}>
          <boxGeometry args={[0.11, 0.11, 0.11]} />
          <meshStandardMaterial ref={latticeMat} color="#1d2b4d" emissive="#3d8bff" metalness={0.4} roughness={0.3} />
        </instancedMesh>
      </group>
    </group>
  );
}

// ── CTA → core pulse ─────────────────────────────────────────────────────────
function CtaLink({ state }: { state: StateRef }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#9cc6ff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  }, []);
  const head = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    return g;
  }, []);
  const headMat = useRef<THREE.PointsMaterial>(null);
  const dot = useMemo(createDotTexture, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const core = useMemo(() => new THREE.Vector3(CENTERS[SCENE][0], CENTERS[SCENE][1] + CY, CENTERS[SCENE][2]), []);

  useFrame(({ camera }) => {
    const s = state.current;
    const lm = line.material as THREE.LineBasicMaterial;
    if (s.act < 0.01) {
      lm.opacity = 0;
      if (headMat.current) headMat.current.opacity = 0;
      return;
    }
    // CTA position on screen → a point in front of the core.
    tmp.set(sceneState.ctaX, sceneState.ctaY, 0.5).unproject(camera).sub(camera.position).normalize();
    tmp.multiplyScalar(camera.position.distanceTo(core) * 0.55).add(camera.position);
    const sx = tmp.x - CENTERS[SCENE][0];
    const sy = tmp.y - CENTERS[SCENE][1];
    const sz = tmp.z - CENTERS[SCENE][2];
    const arr = line.geometry.attributes.position.array as Float32Array;
    arr.set([sx, sy, sz, 0, CY, 0]);
    line.geometry.attributes.position.needsUpdate = true;
    lm.opacity = s.vis * s.act * 0.35;

    const p = frame.reduced ? 1 : clamp01((frame.time - s.pulseStart) / PULSE_TIME);
    const e = p * p * (3 - 2 * p);
    (head.attributes.position.array as Float32Array).set([sx + (0 - sx) * e, sy + (CY - sy) * e, sz + (0 - sz) * e]);
    head.attributes.position.needsUpdate = true;
    if (headMat.current) headMat.current.opacity = s.vis * s.act * (p < 1 ? 1 : 0);
  });

  return (
    <>
      <primitive object={line} />
      <points geometry={head} frustumCulled={false}>
        <pointsMaterial ref={headMat} map={dot} size={0.3} color="#e6f0ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

/**
 * Final scene — System Convergence. Six conduits, each carrying its system's kind of data,
 * converge into one hexagonal core that assembles as the visitor arrives. The primary CTA
 * (see ContactScene) sends a pulse into the core, which answers with a wave along every channel.
 */
export default function ConvergenceScene({ lowPower }: { lowPower: boolean }) {
  const state = useRef<ConvState>({ vis: 0, build: 0, act: 0, wasOn: false, pulseStart: -100 });
  const root = useRef<THREE.Group>(null);

  // Runs before the children so they all read this frame's state (on-demand rendering draws one frame).
  useFrame((_, delta) => {
    const s = state.current;
    const st = frame.stage;
    // Channels fade in while the camera is still approaching, so streams are visible as they form.
    s.vis = smoothstep(7.05, 7.6, st);
    s.build = smoothstep(7.3, 7.97, st);
    if (root.current) root.current.visible = s.vis > 0.005;
    const on = sceneState.connect && s.vis > 0.5;
    if (on && !s.wasOn) s.pulseStart = frame.time;
    s.wasOn = on;
    const target = on ? 1 : 0;
    s.act = frame.reduced ? target : s.act + (target - s.act) * (1 - Math.exp(-Math.min(delta, 0.05) * 4));
  }, -1);

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <Core state={state} lowPower={lowPower} />
      {CONVERGENCE.channels.map((ch) => (
        <Channel key={ch.id} ch={ch} state={state} lowPower={lowPower} />
      ))}
      <CtaLink state={state} />
    </group>
  );
}
