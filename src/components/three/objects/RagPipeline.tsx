import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, frame, presence, progress, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { add, CENTERS, RAG_STEPS } from "../sceneData";
import { createGlowTexture, createLinesTexture } from "../textures";

const SCENE = 2;
const P = (i: number) => RAG_STEPS[i].pos;
const RETRIEVAL_PULSES = 10;

/** stobay.ai — query → documents → chunks → embeddings → vector DB → retrieval → context → LLM → response. */
export default function RagPipeline() {
  const textures = useMemo(
    () => ({
      query: createLinesTexture(2, { rows: 1, header: false, accentRows: [0] }),
      docs: [5, 9, 13, 17].map((seed) => createLinesTexture(seed)),
      context: createLinesTexture(21, { rows: 8, accentRows: [1, 2, 5] }),
      response: createLinesTexture(29, { rows: 7, accentRows: [0, 1, 2, 3, 4, 5, 6] }),
      glow: createGlowTexture(),
    }),
    [],
  );

  const spine = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(RAG_STEPS.map((s) => new THREE.Vector3(...s.pos)), false, "centripetal");
    const material = new THREE.LineBasicMaterial({ color: "#4d8dff", transparent: true, depthWrite: false });
    return { curve, material, line: new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)), material) };
  }, []);
  // Anchored at its left edge so the response "writes" from left to right.
  const responseGeo = useMemo(() => new THREE.PlaneGeometry(1.1, 1.3).translate(0.55, 0, 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const llmEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(0.58)), []);
  const pulseGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RETRIEVAL_PULSES * 3), 3));
    return g;
  }, []);

  const root = useRef<THREE.Group>(null);
  const docs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const chunks = useRef<THREE.InstancedMesh>(null);
  const llm = useRef<THREE.Group>(null);
  const llmCore = useRef<THREE.MeshStandardMaterial>(null);
  const response = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.PointsMaterial>(null);
  const dbRings = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const contextMat = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const steps = useRef<number[]>(RAG_STEPS.map(() => 0));
  const vis = useRef(0);

  useFrame(() => {
    const s = frame.stage;
    const p = presence(s, SCENE, 1.15);
    vis.current = smoothstep(0.4, 0.9, p);
    if (!root.current) return;
    root.current.visible = p > 0;
    if (!root.current.visible) return;

    // Each stage of the pipeline switches on in sequence as the visitor scrolls.
    const a = progress(s, 1.58, 2.32) * RAG_STEPS.length;
    steps.current = RAG_STEPS.map((_, i) => clamp01(a - i));
    const st = steps.current;
    const t = frame.time;

    docs.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = 0.25 + st[1] * 0.9 - i * 0.05;
    });
    if (chunks.current) {
      const spread = 0.6 + st[2] * 0.6;
      for (let i = 0; i < 12; i++) {
        const cx = (i % 3) - 1;
        const cy = Math.floor(i / 3) - 1.5;
        dummy.position.set(cx * 0.24 * spread, cy * 0.19 * spread, Math.sin(i * 1.7 + t) * 0.05 * st[2]);
        dummy.rotation.set(0, 0.3, Math.sin(i + t * 0.5) * 0.1 * st[2]);
        dummy.updateMatrix();
        chunks.current.setMatrixAt(i, dummy.matrix);
      }
      chunks.current.instanceMatrix.needsUpdate = true;
      (chunks.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + st[2] * 0.9;
    }
    dbRings.current.forEach((m, i) => {
      if (m) m.opacity = 0.25 + st[4] * 0.65 * (1 - i * 0.15);
    });
    if (contextMat.current) contextMat.current.emissiveIntensity = 0.2 + st[6] * 0.9;
    if (llm.current && llmCore.current) {
      llm.current.rotation.y = t * 0.35;
      llm.current.rotation.x = t * 0.2;
      llmCore.current.emissiveIntensity = 0.3 + st[7] * 2.2;
    }
    if (response.current) response.current.scale.x = Math.max(0.001, st[8]);
    spine.material.opacity = 0.18 + 0.3 * clamp01(a / RAG_STEPS.length);

    // Retrieval pulses travel along the spine up to the furthest active stage.
    const reach = clamp01(a / RAG_STEPS.length);
    const arr = pulseGeo.attributes.position.array as Float32Array;
    for (let k = 0; k < RETRIEVAL_PULSES; k++) {
      const u = (frame.reduced ? k / RETRIEVAL_PULSES : (t * 0.12 + k / RETRIEVAL_PULSES) % 1) * reach;
      spine.curve.getPoint(u, tmp);
      arr.set([tmp.x, tmp.y, tmp.z], k * 3);
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

      {/* Query */}
      <mesh position={P(0)} rotation={[0, 0.3, 0]}>
        <planeGeometry args={[1.2, 0.36]} />
        <meshBasicMaterial map={textures.query} transparent opacity={0.95} toneMapped={false} />
      </mesh>

      {/* Documents */}
      {textures.docs.map((tex, i) => (
        <mesh key={i} position={add(P(1), [i * 0.11, -i * 0.07, -i * 0.24])} rotation={[0, 0.38 + i * 0.05, 0.02 * i]}>
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

      {/* Chunks */}
      <instancedMesh ref={chunks} args={[undefined, undefined, 12]} position={P(2)}>
        <boxGeometry args={[0.2, 0.15, 0.025]} />
        <meshStandardMaterial {...dark} emissive="#3d8bff" />
      </instancedMesh>

      {/* Vector DB */}
      <group position={P(4)}>
        {[-0.5, 0, 0.5].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.014, 8, 64]} />
            <meshBasicMaterial
              ref={(m) => {
                dbRings.current[i] = m;
              }}
              color="#7cb6ff"
              transparent
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 1, 32, 1, true]} />
          <meshBasicMaterial color="#3d8bff" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Context */}
      <mesh position={P(6)} rotation={[0, -0.2, 0]}>
        <planeGeometry args={[0.85, 1.06]} />
        <meshStandardMaterial ref={contextMat} {...dark} map={textures.context} emissiveMap={textures.context} emissive="#ffffff" side={THREE.DoubleSide} />
      </mesh>

      {/* LLM processing core */}
      <group position={P(7)}>
        <group ref={llm}>
          <lineSegments geometry={llmEdges}>
            <lineBasicMaterial color="#9cc6ff" transparent opacity={0.75} />
          </lineSegments>
          <mesh>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial ref={llmCore} color="#0c1a38" emissive="#3d8bff" metalness={0.4} roughness={0.3} flatShading />
          </mesh>
        </group>
        <sprite scale={[2.2, 2.2, 1]}>
          <spriteMaterial map={textures.glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>

      {/* Response — generated left to right */}
      <group position={add(P(8), [-0.55, 0, 0])} rotation={[0, -0.32, 0]}>
        <mesh ref={response} geometry={responseGeo}>
          <meshBasicMaterial map={textures.response} transparent toneMapped={false} />
        </mesh>
      </group>

      {RAG_STEPS.map((step, i) => (
        <LabelAnchor key={step.id} id={step.id} position={add(step.pos, [0, i === 8 ? 0.95 : 0.8, 0])} visibility={labelVis(i)} />
      ))}
    </group>
  );
}
