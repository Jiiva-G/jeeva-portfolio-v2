import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, frame, presence, progress, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { add, CENTERS, STOBAY_STAGES } from "../sceneData";
import { createGlowTexture, createLinesTexture } from "../textures";

const SCENE = 2;
const P = (i: number) => STOBAY_STAGES[i].pos;
const PULSES = 10;
/** Three tilted rings of the retrieval lens: [radius, tilt X, tilt Z]. */
const LENS_RINGS: [number, number, number][] = [
  [0.62, Math.PI / 2, 0],
  [0.54, Math.PI / 2.6, Math.PI / 3],
  [0.46, Math.PI / 2.2, -Math.PI / 3],
];

/**
 * stobay.ai as a public-safe capability flow: business knowledge → intelligent retrieval →
 * contextual reasoning → AI response. It shows what the system does, deliberately not how it
 * is built internally.
 */
export default function StobaySystem() {
  const textures = useMemo(
    () => ({
      docs: [5, 9, 13, 17].map((seed) => createLinesTexture(seed)),
      response: createLinesTexture(29, { rows: 7, accentRows: [0, 1, 2, 3, 4, 5, 6] }),
      glow: createGlowTexture(),
    }),
    [],
  );

  const spine = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(STOBAY_STAGES.map((s) => new THREE.Vector3(...s.pos)), false, "centripetal");
    const material = new THREE.LineBasicMaterial({ color: "#4d8dff", transparent: true, depthWrite: false });
    return { curve, material, line: new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)), material) };
  }, []);
  // Anchored at its left edge so the response "writes" from left to right.
  const responseGeo = useMemo(() => new THREE.PlaneGeometry(1.1, 1.3).translate(0.55, 0, 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const coreEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(0.58)), []);
  const pulseGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PULSES * 3), 3));
    return g;
  }, []);

  const root = useRef<THREE.Group>(null);
  const docs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lens = useRef<THREE.Group>(null);
  const lensRings = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const lensNode = useRef<THREE.MeshStandardMaterial>(null);
  const core = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const response = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.PointsMaterial>(null);
  const steps = useRef<number[]>(STOBAY_STAGES.map(() => 0));
  const vis = useRef(0);

  useFrame(() => {
    const s = frame.stage;
    const p = presence(s, SCENE, 1.15);
    vis.current = smoothstep(0.4, 0.9, p);
    if (!root.current) return;
    root.current.visible = p > 0;
    if (!root.current.visible) return;

    // Each stage switches on in sequence as the visitor scrolls.
    const a = progress(s, 1.58, 2.32) * STOBAY_STAGES.length;
    steps.current = STOBAY_STAGES.map((_, i) => clamp01(a - i));
    const st = steps.current;
    const t = frame.time;

    docs.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = 0.25 + st[0] * 0.9 - i * 0.05;
    });
    if (lens.current) {
      lens.current.rotation.y = t * 0.25;
      lens.current.rotation.z = Math.sin(t * 0.3) * 0.15;
    }
    lensRings.current.forEach((m, i) => {
      if (m) m.opacity = 0.25 + st[1] * 0.6 * (1 - i * 0.15);
    });
    if (lensNode.current) lensNode.current.emissiveIntensity = 0.3 + st[1] * 1.8;
    if (core.current && coreMat.current) {
      core.current.rotation.y = t * 0.35;
      core.current.rotation.x = t * 0.2;
      coreMat.current.emissiveIntensity = 0.3 + st[2] * 2.2;
    }
    if (response.current) response.current.scale.x = Math.max(0.001, st[3]);
    spine.material.opacity = 0.18 + 0.3 * clamp01(a / STOBAY_STAGES.length);

    // Pulses travel along the spine up to the furthest active stage.
    const reach = clamp01(a / STOBAY_STAGES.length);
    const arr = pulseGeo.attributes.position.array as Float32Array;
    for (let k = 0; k < PULSES; k++) {
      const u = (frame.reduced ? k / PULSES : (t * 0.12 + k / PULSES) % 1) * reach;
      spine.curve.getPoint(u, tmp);
      arr[k * 3] = tmp.x;
      arr[k * 3 + 1] = tmp.y;
      arr[k * 3 + 2] = tmp.z;
    }
    pulseGeo.attributes.position.needsUpdate = true;
    if (pulseMat.current) pulseMat.current.opacity = reach > 0.02 ? 0.9 : 0;
  });

  const labelVis = (i: number) => () => vis.current * (0.3 + 0.7 * steps.current[i]);
  const dark = { color: "#0e1628", metalness: 0.35, roughness: 0.45 };

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <primitive object={spine.line} />
      <points geometry={pulseGeo}>
        <pointsMaterial ref={pulseMat} size={0.11} color="#bcd8ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* Business knowledge: a stack of source material */}
      {textures.docs.map((tex, i) => (
        <mesh key={i} position={add(P(0), [i * 0.11, -i * 0.07, -i * 0.24])} rotation={[0, 0.38 + i * 0.05, 0.02 * i]}>
          <planeGeometry args={[0.74, 0.93]} />
          <meshStandardMaterial
            ref={(m) => {
              docs.current[i] = m;
            }}
            {...dark}
            map={tex}
            emissiveMap={tex}
            emissive="#ffffff"
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Intelligent retrieval: an abstract lens of tilted rings around a lit node */}
      <group position={P(1)}>
        <group ref={lens}>
          {LENS_RINGS.map(([r, tx, tz], i) => (
            <mesh key={i} rotation={[tx, 0, tz]}>
              <torusGeometry args={[r, 0.012, 8, 72]} />
              <meshBasicMaterial
                ref={(m) => {
                  lensRings.current[i] = m;
                }}
                color="#7cb6ff"
                transparent
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
        <mesh>
          <icosahedronGeometry args={[0.13, 1]} />
          <meshStandardMaterial ref={lensNode} color="#0c1a38" emissive="#7cb6ff" metalness={0.4} roughness={0.3} />
        </mesh>
        <sprite scale={[1.5, 1.5, 1]}>
          <spriteMaterial map={textures.glow} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>

      {/* Contextual reasoning: the processing core */}
      <group position={P(2)}>
        <group ref={core}>
          <lineSegments geometry={coreEdges}>
            <lineBasicMaterial color="#9cc6ff" transparent opacity={0.75} />
          </lineSegments>
          <mesh>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial ref={coreMat} color="#0c1a38" emissive="#3d8bff" metalness={0.4} roughness={0.3} flatShading />
          </mesh>
        </group>
        <sprite scale={[2.2, 2.2, 1]}>
          <spriteMaterial map={textures.glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>

      {/* AI response — generated left to right */}
      <group position={add(P(3), [-0.55, 0, 0])} rotation={[0, -0.32, 0]}>
        <mesh ref={response} geometry={responseGeo}>
          <meshBasicMaterial map={textures.response} transparent toneMapped={false} />
        </mesh>
      </group>

      {STOBAY_STAGES.map((stage, i) => (
        <LabelAnchor key={stage.id} id={stage.id} position={add(stage.pos, [0, i === 3 ? 0.95 : 0.8, 0])} visibility={labelVis(i)} />
      ))}
    </group>
  );
}
