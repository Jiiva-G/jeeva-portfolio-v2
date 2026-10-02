import { useMemo } from "react";
import * as THREE from "three";
import { journeyPoints } from "../cameraPath";
import { createDotTexture } from "../textures";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/**
 * Depth cues for the whole journey: near-camera dust the camera flies through (foreground),
 * a fogged infrastructure grid below (background) and distant data towers on the horizon.
 */
export default function Atmosphere({ lowPower }: { lowPower: boolean }) {
  const dot = useMemo(createDotTexture, []);

  const dust = useMemo(() => {
    const rand = rng(17);
    const samples = journeyPoints(lowPower ? 160 : 320);
    const arr: number[] = [];
    for (const p of samples) {
      for (let k = 0; k < 2; k++) {
        const r = 1.6 + rand() * 6;
        const a = rand() * Math.PI * 2;
        arr.push(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, p.z + (rand() - 0.5) * 6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [lowPower]);

  const floor = useMemo(() => {
    const pts: number[] = [];
    const y = -7.5;
    for (let x = -60; x <= 60; x += 4) pts.push(x, y, 30, x, y, -230);
    for (let z = 30; z >= -230; z -= 4) pts.push(-60, y, z, 60, y, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const towers = useMemo(() => {
    const rand = rng(29);
    const lines: number[] = [];
    const tops: number[] = [];
    const n = lowPower ? 40 : 80;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (18 + rand() * 24);
      const z = 20 - rand() * 240;
      const h = 6 + rand() * 16;
      lines.push(x, -7.5, z, x, -7.5 + h, z);
      tops.push(x, -7.5 + h, z);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(tops, 3));
    return { lines: lg, tops: tg };
  }, [lowPower]);

  return (
    <>
      <points geometry={dust} frustumCulled={false}>
        <pointsMaterial size={0.14} map={dot} color="#8fb3ff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments geometry={floor} frustumCulled={false}>
        <lineBasicMaterial color="#1a2a4f" transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={towers.lines} frustumCulled={false}>
        <lineBasicMaterial color="#22396b" transparent opacity={0.6} />
      </lineSegments>
      <points geometry={towers.tops} frustumCulled={false}>
        <pointsMaterial size={0.5} map={dot} color="#5b8fff" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}
