import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, frame, presence, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { add, AUDIO, CENTERS } from "../sceneData";
import { roundedRectPoints, lineLoopGeometry } from "../shapes";
import { createDeviceTexture, createGlowTexture } from "../textures";

const SCENE = 5;
const CAPTION_ROWS = [1.45, 1.1, 1.3];

function Device({ position, scale = 1, rotationY = 0, screen }: { position: [number, number, number]; scale?: number; rotationY?: number; screen: THREE.Texture }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh>
        <boxGeometry args={[0.82, 1.5, 0.09]} />
        <meshStandardMaterial color="#121b30" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[0.7, 1.36]} />
        <meshStandardMaterial color="#05080f" emissive="#ffffff" emissiveMap={screen} emissiveIntensity={0.9} map={screen} />
      </mesh>
    </group>
  );
}

/** Voice → push-to-talk device → WebSocket audio stream → ASR → live captions → listening devices. */
export default function AudioScene() {
  const screen = useMemo(createDeviceTexture, []);
  const glow = useMemo(createGlowTexture, []);
  const captionFrame = useMemo(() => lineLoopGeometry(roundedRectPoints(1.9, 1.05, 0.08)), []);
  const barGeo = useMemo(() => new THREE.PlaneGeometry(1, 0.075).translate(0.5, 0, 0), []);

  const root = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const vis = useRef(0);

  useFrame(() => {
    if (!root.current) return;
    const p = presence(frame.stage, SCENE, 1.15);
    vis.current = smoothstep(0.4, 0.9, p);
    root.current.visible = p > 0;
    if (!root.current.visible) return;
    const t = frame.time;
    if (ringA.current) ringA.current.rotation.z = t * 0.6;
    if (ringB.current) {
      ringB.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.4;
      ringB.current.rotation.y = t * 0.9;
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.35 * (frame.reduced ? 0 : 1);

    // Captions write themselves line by line, then refresh — a continuous live feed.
    const cycle = frame.reduced ? 0.75 : (t * 0.22) % 1;
    bars.current.forEach((b, i) => {
      if (!b) return;
      const local = clamp01(cycle * 4 - i);
      b.scale.x = Math.max(0.001, local) * CAPTION_ROWS[i];
    });
  });

  const labelVis = () => vis.current;
  const cap = AUDIO.caption;

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <Device position={AUDIO.device} rotationY={0.35} screen={screen} />

      <group position={AUDIO.asr}>
        <mesh ref={ringA}>
          <torusGeometry args={[0.6, 0.022, 10, 80]} />
          <meshBasicMaterial color="#7cb6ff" toneMapped={false} />
        </mesh>
        <mesh ref={ringB}>
          <torusGeometry args={[0.42, 0.014, 8, 64]} />
          <meshBasicMaterial color="#3d8bff" toneMapped={false} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial ref={coreMat} color="#0c1a38" emissive="#3d8bff" flatShading metalness={0.3} roughness={0.3} />
        </mesh>
        <sprite scale={[2.4, 2.4, 1]}>
          <spriteMaterial map={glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>

      <group position={cap} rotation={[0, -0.3, 0]}>
        <mesh>
          <planeGeometry args={[1.9, 1.05]} />
          <meshBasicMaterial color="#0a1326" transparent opacity={0.75} />
        </mesh>
        <lineLoop geometry={captionFrame} position={[0, 0, 0.01]}>
          <lineBasicMaterial color="#7cb6ff" transparent opacity={0.6} />
        </lineLoop>
        {CAPTION_ROWS.map((_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              bars.current[i] = m;
            }}
            geometry={barGeo}
            position={[-0.78, 0.26 - i * 0.26, 0.02]}
          >
            <meshBasicMaterial color={i === 2 ? "#7cb6ff" : "#dbe6ff"} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {AUDIO.listeners.map((l, i) => (
        <Device key={i} position={l} scale={0.62} rotationY={-0.45} screen={screen} />
      ))}

      <LabelAnchor id="audio-voice" position={add(AUDIO.device, [0, 1.15, 0])} visibility={labelVis} />
      <LabelAnchor id="audio-stream" position={[-2.1, 0.95, 0]} visibility={labelVis} />
      <LabelAnchor id="audio-asr" position={add(AUDIO.asr, [0, 1.0, 0])} visibility={labelVis} />
      <LabelAnchor id="audio-captions" position={add(cap, [0, 0.85, 0])} visibility={labelVis} />
      <LabelAnchor id="audio-devices" position={add(AUDIO.listeners[0], [0, 0.75, 0])} visibility={labelVis} />
    </group>
  );
}
