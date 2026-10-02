import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { navRoute } from "../formations";
import { frame, presence, progress, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { CENTERS, NAV } from "../sceneData";

const SCENE = 4;

const routeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const routeFragment = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uProgress) discard;
    float dash = 0.65 + 0.35 * sin(vUv.x * 90.0 - uTime * 5.0);
    float head = smoothstep(uProgress - 0.04, uProgress, vUv.x);
    vec3 col = mix(vec3(0.3, 0.6, 1.0), vec3(0.85, 0.93, 1.0), head) * dash;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

function chevronGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.32);
  s.lineTo(0.26, -0.06);
  s.lineTo(0.12, -0.06);
  s.lineTo(0, 0.12);
  s.lineTo(-0.12, -0.06);
  s.lineTo(-0.26, -0.06);
  s.closePath();
  // Lay flat on the ground plane, pointing along -Z by default.
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, 0);
}

function hash(n: number) {
  const s = Math.sin(n * 91.345) * 47453.5453;
  return s - Math.floor(s);
}

export default function NavScene({ lowPower }: { lowPower: boolean }) {
  const S = NAV.step;
  const half = NAV.blocks * S;
  const route = useMemo(navRoute, []);

  const roads = useMemo(() => {
    const pts: number[] = [];
    for (let k = -NAV.blocks; k <= NAV.blocks; k++) {
      pts.push(k * S, 0.006, -half, k * S, 0.006, half);
      pts.push(-half, 0.006, k * S, half, 0.006, k * S);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [S, half]);

  const buildings = useMemo(() => {
    const items: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let bx = -NAV.blocks; bx < NAV.blocks; bx++)
      for (let bz = -NAV.blocks; bz < NAV.blocks; bz++) {
        const n = (bx + 10) * 31 + (bz + 10) * 7;
        const count = lowPower ? 1 : 1 + Math.floor(hash(n) * 2);
        for (let k = 0; k < count; k++) {
          const w = 0.22 + hash(n + k * 3.1) * 0.3;
          const d = 0.22 + hash(n + k * 5.7) * 0.3;
          items.push({
            x: (bx + 0.5) * S + (hash(n + k * 1.3) - 0.5) * (S - w - 0.18),
            z: (bz + 0.5) * S + (hash(n + k * 2.9) - 0.5) * (S - d - 0.18),
            w,
            d,
            h: 0.08 + Math.pow(hash(n + k * 7.7), 2.2) * 0.75,
          });
        }
      }
    return items;
  }, [S, lowPower]);

  const tube = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < route.pts.length - 1; i++) {
      const [ax, az] = route.pts[i];
      const [bx, bz] = route.pts[i + 1];
      path.add(new THREE.LineCurve3(new THREE.Vector3(ax, 0.06, az), new THREE.Vector3(bx, 0.06, bz)));
    }
    return new THREE.TubeGeometry(path, 240, 0.045, 6, false);
  }, [route]);

  const chevron = useMemo(chevronGeometry, []);
  const routeUniforms = useMemo(() => ({ uProgress: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 } }), []);

  const root = useRef<THREE.Group>(null);
  const city = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<(THREE.Group | null)[]>([]);
  const arrowMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const gps = useRef<THREE.Mesh>(null);
  const acts = useRef({ vis: 0, route: 0, dest: 0 });
  const ready = useRef(false);

  useFrame(() => {
    if (!root.current) return;
    const s = frame.stage;
    const p = presence(s, SCENE, 1.15);
    root.current.visible = p > 0;
    if (!root.current.visible) return;

    if (city.current && !ready.current) {
      const dummy = new THREE.Object3D();
      buildings.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        city.current!.setMatrixAt(i, dummy.matrix);
      });
      city.current.instanceMatrix.needsUpdate = true;
      ready.current = true;
    }

    const a = progress(s, 3.6, 4.36);
    const A = acts.current;
    A.vis = smoothstep(0.4, 0.9, p);
    A.route = smoothstep(0.05, 0.85, a);
    A.dest = smoothstep(0.8, 1, a);
    const t = frame.time;
    routeUniforms.uProgress.value = A.route;
    routeUniforms.uTime.value = t;

    // AR guidance: a chevron leading the route, with two fainter ones ahead.
    arrows.current.forEach((g, k) => {
      if (!g) return;
      const u = Math.min(A.route + k * 0.05, 1);
      const [x, z] = route.at(u);
      const [nx, nz] = route.at(Math.min(u + 0.01, 1));
      g.position.set(x, 0.42 + Math.sin(t * 2 + k) * 0.04 * (frame.reduced ? 0 : 1), z);
      if (Math.hypot(nx - x, nz - z) > 1e-4) g.rotation.y = Math.atan2(-(nx - x), -(nz - z));
      const m = arrowMats.current[k];
      if (m) m.opacity = (k === 0 ? 1 : 0.45 - k * 0.12) * (A.route > 0.01 && A.route < 0.999 ? 1 : k === 0 ? 1 : 0);
    });

    if (gps.current) {
      const pulse = frame.reduced ? 0.5 : (t * 0.6) % 1;
      gps.current.scale.setScalar(1 + pulse * 2.4);
      (gps.current.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * 0.8;
    }
  });

  const v = acts.current;
  const [sx, sz] = route.pts[0];
  const [ex, ez] = route.pts[route.pts.length - 1];
  const [mx, mz] = route.at(0.45);

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[half * 2 + 1.2, half * 2 + 1.2]} />
        <meshStandardMaterial color="#060b17" roughness={1} metalness={0} />
      </mesh>
      <lineSegments geometry={roads}>
        <lineBasicMaterial color="#1f3765" transparent opacity={0.9} />
      </lineSegments>
      <instancedMesh ref={city} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#16223f" metalness={0.35} roughness={0.6} transparent opacity={0.92} />
      </instancedMesh>

      <mesh geometry={tube}>
        <shaderMaterial
          vertexShader={routeVertex}
          fragmentShader={routeFragment}
          uniforms={routeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {[0, 1, 2].map((k) => (
        <group
          key={k}
          ref={(g) => {
            arrows.current[k] = g;
          }}
        >
          <mesh geometry={chevron} scale={k === 0 ? 1.15 : 0.8}>
            <meshStandardMaterial
              ref={(m) => {
                arrowMats.current[k] = m;
              }}
              color="#cfe3ff"
              emissive="#3d8bff"
              emissiveIntensity={1.4}
              transparent
              metalness={0.2}
              roughness={0.3}
            />
          </mesh>
          {k === 0 && <LabelAnchor id="nav-ar" position={[0, 0.45, 0]} visibility={() => v.vis * (v.route > 0.02 ? 1 : 0)} />}
        </group>
      ))}

      {/* GPS fix at the start */}
      <mesh ref={gps} position={[sx, 0.02, sz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.14, 0.18, 40]} />
        <meshBasicMaterial color="#7cb6ff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[sx, 0.1, sz]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color="#e6efff" toneMapped={false} />
      </mesh>
      <LabelAnchor id="nav-gps" position={[sx, 0.5, sz]} visibility={() => v.vis} />
      <LabelAnchor id="nav-route" position={[mx, 0.35, mz]} visibility={() => v.vis * smoothstep(0.3, 0.6, v.route)} />

      {/* Destination */}
      <mesh position={[ex, 0.6, ez]}>
        <cylinderGeometry args={[0.018, 0.018, 1.2, 8]} />
        <meshBasicMaterial color="#7cb6ff" toneMapped={false} />
      </mesh>
      <mesh position={[ex, 1.25, ez]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#cfe3ff" emissive="#3d8bff" emissiveIntensity={1.6} flatShading />
      </mesh>
      <LabelAnchor id="nav-dest" position={[ex, 1.65, ez]} visibility={() => v.vis * (0.45 + 0.55 * v.dest)} />
    </group>
  );
}
