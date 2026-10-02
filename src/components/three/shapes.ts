import * as THREE from "three";

/** Points around a rounded rectangle centred on the origin (XY plane). */
export function roundedRectPoints(w: number, h: number, r: number, segments = 6) {
  const pts: THREE.Vector3[] = [];
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const corners: [number, number, number][] = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, Math.PI * 1.5],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segments; i++) {
      const a = start + (i / segments) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  }
  return pts;
}

export function lineLoopGeometry(points: THREE.Vector3[]) {
  return new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
}
