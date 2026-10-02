import { useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LabelContext } from "./labelDefs";
import type { Vec3 } from "./sceneData";

/**
 * Projects its world position to the screen every frame and moves the matching HTML label there.
 * `visibility` returns 0–1; labels behind the camera or off-screen are hidden.
 */
export function LabelAnchor({ id, position = [0, 0, 0], visibility }: { id: string; position?: Vec3; visibility: () => number }) {
  const labels = useContext(LabelContext);
  const ref = useRef<THREE.Object3D>(null);
  const last = useRef(-1);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const el = labels.get(id);
    if (!el || !ref.current) return;
    let w = visibility();
    if (w > 0.01) {
      ref.current.getWorldPosition(v);
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) w = 0;
    }
    if (w < 0.01) {
      if (last.current !== 0) {
        el.style.opacity = "0";
        last.current = 0;
      }
      return;
    }
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    el.style.opacity = w.toFixed(3);
    last.current = w;
  });

  return <object3D ref={ref} position={position} />;
}
