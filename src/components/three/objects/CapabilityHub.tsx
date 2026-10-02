import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { capabilityAnchors } from "../formations";
import { frame, presence, progress } from "../frameState";
import { CENTERS } from "../sceneData";
import { createGlowTexture } from "../textures";

const SCENE = 1;

/** Solid hubs for the capability ecosystem: the AI-systems core and one node per domain. */
export default function CapabilityHub() {
  const glow = useMemo(createGlowTexture, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 0)), []);
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const hubs = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    if (!root.current) return;
    const s = frame.stage;
    const p = presence(s, SCENE, 1.1);
    root.current.visible = p > 0;
    if (!root.current.visible) return;
    const t = frame.time;
    if (core.current) {
      core.current.rotation.y = t * 0.3;
      core.current.rotation.x = t * 0.17;
    }
    // Domains emerge one after another as the scene settles.
    const a = progress(s, 0.55, 1.15) * 3;
    hubs.current.forEach((h, i) => {
      if (!h) return;
      const k = Math.min(Math.max(a - i, 0), 1);
      h.scale.setScalar(0.001 + k);
      h.rotation.y = t * 0.4 + i;
    });
  });

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <group ref={core}>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#9cc6ff" transparent opacity={0.8} />
        </lineSegments>
        <mesh>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#0c1a38" emissive="#3d8bff" emissiveIntensity={1.2} flatShading metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
      <sprite scale={[2.6, 2.6, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {capabilityAnchors.map((a, i) => (
        <group
          key={i}
          position={a}
          ref={(g) => {
            hubs.current[i] = g;
          }}
        >
          <mesh>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#1a2c55" emissive="#2f6fe8" emissiveIntensity={0.9} metalness={0.5} roughness={0.25} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
