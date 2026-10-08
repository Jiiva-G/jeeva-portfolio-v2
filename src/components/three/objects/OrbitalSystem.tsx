import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { orbitNodeLinks, sceneState } from "@/lib/sceneStore";
import { clamp01, frame, smoothstep } from "../frameState";
import { CENTERS, ORBITAL, orbitPoint, type Vec3 } from "../sceneData";
import { createGlowTexture } from "../textures";

const SCENE = 8;
const ORIGIN = new THREE.Vector3(...CENTERS[SCENE]);
const NODE_POS: Vec3[] = ORBITAL.nodes.map((n) => orbitPoint(ORBITAL.rings[n.ring], n.angle));
const RING_SEGMENTS = 192;
/** Half the square hit area that sits over each node marker (see .orbit-node__hit). */
const HIT_HALF = 14;
const PULSE_TRAVEL = 0.7;
const WAVE_START = 0.75;
const WAVE_DURATION = 1.7;

/**
 * Final scene — an orbital system. An engineered crystalline core, three inclined orbits with
 * travelling bodies and trails (the trails are the stage's particle formation), and six fixed
 * nodes. The node links themselves are HTML in ContactScene; on desktop this component pins each
 * one over its node every frame, so the 3D node is the click/focus target. Never hidden with
 * `visibility`: unplaced links stay in the accessibility tree and tab order.
 */
export default function OrbitalSystem({ compact }: { compact: boolean }) {
  const glow = useMemo(createGlowTexture, []);
  const parts = useMemo(() => {
    const rings = ORBITAL.rings.map((ring) => {
      const pts = Array.from({ length: RING_SEGMENTS }, (_, k) => new THREE.Vector3(...orbitPoint(ring, (k / RING_SEGMENTS) * Math.PI * 2)));
      return new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: "#6f9be6", transparent: true, depthWrite: false, opacity: 0 }),
      );
    });
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.02, 1)),
      new THREE.LineBasicMaterial({ color: "#8fb8f5", transparent: true, depthWrite: false, opacity: 0 }),
    );
    const facetEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.74, 0)),
      new THREE.LineBasicMaterial({ color: "#b7d3ff", transparent: true, depthWrite: false, opacity: 0 }),
    );
    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.55, 0), new THREE.Vector3(0, 1.55, 0)]),
      new THREE.LineBasicMaterial({ color: "#6f9be6", transparent: true, depthWrite: false, opacity: 0 }),
    );
    const crystalEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.36, 0)),
      new THREE.LineBasicMaterial({ color: "#cfe3ff", transparent: true, depthWrite: false, opacity: 0 }),
    );
    return { rings, shell, facetEdges, axis, crystalEdges };
  }, []);

  const root = useRef<THREE.Group>(null);
  const shellGroup = useRef<THREE.Group>(null);
  const facetGroup = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Group>(null);
  const crystalMat = useRef<THREE.MeshStandardMaterial>(null);
  const facetMat = useRef<THREE.MeshStandardMaterial>(null);
  const frameMat = useRef<THREE.MeshStandardMaterial>(null);
  const lightMat = useRef<THREE.SpriteMaterial>(null);
  const pulse = useRef<THREE.Sprite>(null);
  const pulseMat = useRef<THREE.SpriteMaterial>(null);
  const bodies = useRef<(THREE.Mesh | null)[]>([]);
  const markers = useRef<(THREE.Group | null)[]>([]);
  const markerMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const haloMats = useRef<(THREE.SpriteMaterial | null)[]>([]);

  const st = useRef({ focusRing: -1, focusAmt: 0, online: 0, connectWas: false, pulseAt: -1, nodeAct: ORBITAL.nodes.map(() => 0), placed: false });
  const tmp = useMemo(
    () => ({ v: new THREE.Vector3(), core: new THREE.Vector3(), from: new THREE.Vector3(), p: [0, 0, 0] as Vec3, widths: new Map<number, [number, number, number]>() }),
    [],
  );

  useFrame(({ camera, size, clock }, delta) => {
    const s = st.current;
    const vis = smoothstep(7.55, 7.95, frame.stage);
    if (root.current) root.current.visible = vis > 0.003;
    if (vis <= 0.003) {
      if (s.placed) unplaceAll();
      frame.orbitWave = -1;
      return;
    }
    const t = frame.time;
    const ease = (target: number, cur: number, rate: number) => (frame.reduced ? target : cur + (target - cur) * (1 - Math.exp(-Math.min(delta, 0.05) * rate)));

    // Node hover/focus: its ring brightens, its particles open slightly, the core answers softly.
    const fi = sceneState.orbitFocus;
    if (fi >= 0) s.focusRing = ORBITAL.nodes[fi].ring;
    s.focusAmt = ease(fi >= 0 ? 1 : 0, s.focusAmt, 6);
    s.nodeAct = s.nodeAct.map((a, i) => ease(i === fi ? 1 : 0, a, 7));
    frame.orbitFocusRing = s.focusAmt > 0.001 ? s.focusRing : -1;
    frame.orbitFocusAmt = s.focusAmt;

    // "Get in touch": a light pulse travels from the button to the core, the core answers, and a
    // wave propagates out through the orbits before the system settles (online while engaged).
    if (sceneState.connect && !s.connectWas) s.pulseAt = clock.elapsedTime;
    s.connectWas = sceneState.connect;
    s.online = ease(sceneState.connect ? 1 : 0, s.online, 3);
    const since = s.pulseAt >= 0 && !frame.reduced ? clock.elapsedTime - s.pulseAt : Infinity;
    const travel = since < PULSE_TRAVEL ? since / PULSE_TRAVEL : -1;
    const flash = since < 1.6 ? Math.exp(-(((since - PULSE_TRAVEL) / 0.22) ** 2)) : 0;
    const waveU = (since - WAVE_START) / WAVE_DURATION;
    frame.orbitWave = waveU >= 0 && waveU <= 1 ? waveU * (ORBITAL.rings[2].radius + 0.8) : -1;

    tmp.core.copy(ORIGIN);
    if (pulse.current && pulseMat.current) {
      if (travel >= 0) {
        // Start point: the button's position, carried into the scene at the core's depth.
        tmp.from.set(sceneState.ctaX, sceneState.ctaY, 0.5).unproject(camera).sub(camera.position).normalize();
        tmp.from.multiplyScalar(camera.position.distanceTo(tmp.core) * 0.9).add(camera.position);
        const k = travel * travel * (3 - 2 * travel);
        pulse.current.position.copy(tmp.from).lerp(tmp.core, k).sub(ORIGIN);
        pulseMat.current.opacity = 0.85 * Math.sin(Math.PI * Math.min(travel * 1.1, 1)) + 0.1;
        pulse.current.visible = true;
      } else pulse.current.visible = false;
    }

    // Core: nested shells turning slowly against each other around a lit crystal.
    if (!frame.reduced) {
      shellGroup.current?.rotation.set(0.12, t * 0.05, 0);
      facetGroup.current?.rotation.set(t * 0.03, -t * 0.08, 0);
      crystal.current?.rotation.set(0, t * 0.16, 0);
    }
    const energy = 0.16 + 0.22 * s.online + 1.1 * flash + 0.14 * s.focusAmt;
    if (crystalMat.current) {
      crystalMat.current.emissiveIntensity = energy;
      crystalMat.current.opacity = vis * 0.72;
    }
    if (facetMat.current) facetMat.current.opacity = vis * (0.1 + 0.04 * s.online);
    if (frameMat.current) frameMat.current.opacity = vis * 0.6;
    if (lightMat.current) lightMat.current.opacity = vis * (0.22 + 0.16 * s.online + 0.45 * flash);
    (parts.shell.material as THREE.LineBasicMaterial).opacity = vis * (0.2 + 0.12 * s.online + 0.2 * flash);
    (parts.facetEdges.material as THREE.LineBasicMaterial).opacity = vis * (0.32 + 0.15 * s.online);
    (parts.axis.material as THREE.LineBasicMaterial).opacity = vis * 0.22;
    (parts.crystalEdges.material as THREE.LineBasicMaterial).opacity = vis * (0.55 + 0.25 * s.online + 0.2 * flash);

    // Orbits: faint by default; the focused one and the passing wave light up.
    parts.rings.forEach((line, ri) => {
      const ring = ORBITAL.rings[ri];
      const focus = frame.orbitFocusRing === ri ? s.focusAmt : 0;
      const wave = frame.orbitWave >= 0 ? Math.exp(-((ring.radius - frame.orbitWave) ** 2) * 2.5) : 0;
      (line.material as THREE.LineBasicMaterial).opacity = vis * (0.17 + 0.06 * s.online + 0.4 * focus + 0.35 * wave);
    });
    bodies.current.forEach((b, ri) => {
      if (!b) return;
      const ring = ORBITAL.rings[ri];
      orbitPoint(ring, ri * 2.1 + t * ring.speed, tmp.p);
      b.position.set(tmp.p[0], tmp.p[1], tmp.p[2]);
    });
    ORBITAL.nodes.forEach((_, i) => {
      const a = s.nodeAct[i];
      markers.current[i]?.scale.setScalar(1 + 0.35 * a);
      if (!frame.reduced) markers.current[i]?.rotation.set(0, t * 0.4 + i, 0);
      markerMats.current[i]?.color.setRGB(0.45 + 0.4 * a, 0.62 + 0.3 * a, 0.95);
      if (haloMats.current[i]) haloMats.current[i]!.opacity = vis * (0.16 + 0.34 * a + 0.12 * s.online);
    });

    if (!compact) pinLinks(vis, camera, size);
  });

  function unplaceAll() {
    st.current.placed = false;
    orbitNodeLinks.els.forEach((el) => {
      if (el?.hasAttribute("data-placed")) {
        el.removeAttribute("data-placed");
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      }
    });
  }

  /** Moves each node link over its node: the marker sits under the link's hit square, the text beside it, facing outward. */
  function pinLinks(vis: number, camera: THREE.Camera, size: { width: number; height: number }) {
    tmp.v.copy(ORIGIN).project(camera);
    const coreX = (tmp.v.x * 0.5 + 0.5) * size.width;
    let any = false;
    ORBITAL.nodes.forEach((_, i) => {
      const el = orbitNodeLinks.els[i];
      if (!el) return;
      tmp.v.set(...NODE_POS[i]).add(ORIGIN).project(camera);
      const x = (tmp.v.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.v.y * 0.5 + 0.5) * size.height;
      const focused = el === document.activeElement;
      // A focused link is fully opaque, so it only follows its node once the scene has arrived.
      const shown = vis > (focused ? 0.95 : 0.3) && tmp.v.z < 1 && x > 0 && x < size.width && y > 0 && y < size.height;
      if (!shown) {
        if (el.hasAttribute("data-placed")) {
          el.removeAttribute("data-placed");
          el.style.removeProperty("transform");
          el.style.removeProperty("opacity");
        }
        return;
      }
      any = true;
      const side = ORBITAL.nodes[i].label ?? (x >= coreX ? "right" : "left");
      if (el.dataset.side !== side) el.dataset.side = side;
      if (!el.hasAttribute("data-placed")) el.setAttribute("data-placed", "");
      // Measure once per layout width (text never changes; transforms don't affect layout).
      let m = tmp.widths.get(i);
      if (!m || m[2] !== size.width) {
        m = [el.offsetWidth, el.offsetHeight, size.width];
        tmp.widths.set(i, m);
      }
      // The hit square always lands on the node; the label sits beside, above or below it.
      const left = side === "right" ? x - HIT_HALF : side === "left" ? x + HIT_HALF - m[0] : x - m[0] / 2;
      const top = side === "top" ? y + HIT_HALF - m[1] : side === "bottom" ? y - HIT_HALF : y - m[1] / 2;
      const transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      if (el.style.transform !== transform) el.style.transform = transform;
      const opacity = focused ? "1" : clamp01((vis - 0.3) / 0.6).toFixed(2);
      if (el.style.opacity !== opacity) el.style.opacity = opacity;
    });
    st.current.placed = any;
  }

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      {/* Core: geodesic frame, faceted translucent shell, structural ring and axis, lit crystal */}
      <group ref={shellGroup}>
        <primitive object={parts.shell} />
      </group>
      <group ref={facetGroup}>
        <mesh>
          <icosahedronGeometry args={[0.74, 0]} />
          <meshStandardMaterial ref={facetMat} color="#9cc6ff" transparent opacity={0} metalness={0.3} roughness={0.08} flatShading side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <primitive object={parts.facetEdges} />
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.22, 0.007, 6, 128]} />
        <meshStandardMaterial ref={frameMat} color="#9cb4dd" metalness={0.7} roughness={0.3} transparent opacity={0} />
      </mesh>
      <primitive object={parts.axis} />
      <group ref={crystal} scale={[1, 1.55, 1]}>
        <mesh>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial ref={crystalMat} color="#3b67b0" emissive="#3d8bff" metalness={0.5} roughness={0.15} flatShading transparent opacity={0} depthWrite={false} />
        </mesh>
        <primitive object={parts.crystalEdges} />
      </group>
      {/* The light inside the crystal */}
      <mesh>
        <icosahedronGeometry args={[0.07, 1]} />
        <meshBasicMaterial color="#e6f0ff" toneMapped={false} />
      </mesh>
      <sprite scale={[1.05, 1.05, 1]}>
        <spriteMaterial ref={lightMat} map={glow} color="#cfe3ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* Orbits with one travelling body each */}
      {parts.rings.map((line, ri) => (
        <primitive key={ri} object={line} />
      ))}
      {ORBITAL.rings.map((_, ri) => (
        <mesh
          key={ri}
          ref={(m) => {
            bodies.current[ri] = m;
          }}
        >
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#cfe3ff" toneMapped={false} />
        </mesh>
      ))}

      {/* Fixed nodes: a small faceted marker with a soft halo */}
      {ORBITAL.nodes.map((node, i) => (
        <group key={node.kind} position={NODE_POS[i]}>
          <group
            ref={(g) => {
              markers.current[i] = g;
            }}
          >
            <mesh>
              <octahedronGeometry args={[0.085, 0]} />
              <meshBasicMaterial
                ref={(m) => {
                  markerMats.current[i] = m;
                }}
                color="#8fb8f5"
                toneMapped={false}
              />
            </mesh>
          </group>
          <sprite scale={[0.75, 0.75, 1]}>
            <spriteMaterial
              ref={(m) => {
                haloMats.current[i] = m;
              }}
              map={glow}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      ))}

      {/* "Get in touch" light pulse */}
      <sprite ref={pulse} scale={[0.55, 0.55, 1]} visible={false}>
        <spriteMaterial ref={pulseMat} map={glow} color="#cfe3ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
