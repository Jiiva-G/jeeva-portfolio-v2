import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timelinePath } from "../formations";
import { clamp01, frame, presence, progress, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { add, CENTERS, TIMELINE } from "../sceneData";
import { lineLoopGeometry, roundedRectPoints } from "../shapes";
import { createGlowTexture } from "../textures";

const SCENE = 7;
/** Where the camera looks from at this stage — plates face it (see cameraPath). */
const VIEW_FROM = new THREE.Vector3(-13.6, 2.8, -0.4);

/** Career as a path receding into depth: the oldest milestone is furthest away. */
export default function Timeline3D() {
  const pathLine = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(timelinePath().pts.map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#4d8dff", transparent: true, opacity: 0.45 }));
  }, []);
  const plateEdge = useMemo(() => lineLoopGeometry(roundedRectPoints(1.75, 0.5, 0.08)), []);
  const glow = useMemo(createGlowTexture, []);
  const rotations = useMemo(
    () =>
      TIMELINE.map((n) => {
        const o = new THREE.Object3D();
        o.position.set(n.pos[0], n.pos[1] + 0.95, n.pos[2]);
        o.lookAt(VIEW_FROM);
        return o.rotation.clone();
      }),
    [],
  );

  const root = useRef<THREE.Group>(null);
  const nodeMats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const edgeMats = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const acts = useRef<number[]>(TIMELINE.map(() => 0));
  const vis = useRef(0);

  useFrame(() => {
    if (!root.current) return;
    const s = frame.stage;
    const p = presence(s, SCENE, 1.15);
    vis.current = smoothstep(0.4, 0.9, p);
    root.current.visible = p > 0;
    if (!root.current.visible) return;
    const a = progress(s, 6.35, 6.95) * TIMELINE.length;
    acts.current = TIMELINE.map((_, i) => clamp01(a - i));
    acts.current.forEach((v, i) => {
      const n = nodeMats.current[i];
      if (n) n.opacity = 0.25 + v * (TIMELINE[i].latest ? 0.75 : 0.5);
      const e = edgeMats.current[i];
      if (e) e.opacity = 0.2 + v * 0.6;
    });
  });

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <primitive object={pathLine} />

      {TIMELINE.map((n, i) => (
        <group key={n.id}>
          <mesh position={n.pos}>
            <icosahedronGeometry args={[n.latest ? 0.14 : 0.1, 1]} />
            <meshBasicMaterial color={n.latest ? "#cfe3ff" : "#9cb4dd"} toneMapped={false} />
          </mesh>
          <sprite position={n.pos} scale={n.latest ? [1.8, 1.8, 1] : [1.1, 1.1, 1]}>
            <spriteMaterial
              ref={(m) => {
                nodeMats.current[i] = m;
              }}
              map={glow}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          {/* Glass plate carrying the label, connected to the path by a short stem. */}
          <group position={add(n.pos, [0, 0.95, 0])} rotation={rotations[i]}>
            <mesh>
              <planeGeometry args={[1.75, 0.5]} />
              <meshStandardMaterial color="#0d1730" metalness={0.3} roughness={0.25} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
            <lineLoop geometry={plateEdge} position={[0, 0, 0.01]}>
              <lineBasicMaterial
                ref={(m) => {
                  edgeMats.current[i] = m;
                }}
                color={n.latest ? "#7cb6ff" : "#5e7fb8"}
                transparent
              />
            </lineLoop>
          </group>
          <mesh position={add(n.pos, [0, 0.33, 0])}>
            <cylinderGeometry args={[0.008, 0.008, 0.66, 6]} />
            <meshBasicMaterial color="#4d8dff" transparent opacity={0.6} />
          </mesh>
          <LabelAnchor id={n.id} position={add(n.pos, [0, 0.95, 0])} visibility={() => vis.current * (0.35 + 0.65 * acts.current[i])} />
        </group>
      ))}
    </group>
  );
}
