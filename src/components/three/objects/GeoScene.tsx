import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame, presence, progress, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { add, CENTERS, GEO, type Vec3 } from "../sceneData";
import { createGridTexture, createLinesTexture } from "../textures";

const SCENE = 3;
const SPIN = 0.12; // matches the globe particle formation

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => valueNoise(x, y) * 0.55 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.15;

/** River valley centre line across the tile (local x → z). */
const valley = (x: number) => Math.sin(x * 1.25 + 0.4) * 0.45;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const onSphere = (lat: number, lon: number, r: number) =>
  new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon));

export default function GeoScene({ lowPower }: { lowPower: boolean }) {
  const size = GEO.tile.size;

  const terrain = useMemo(() => {
    const seg = lowPower ? 48 : 96;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#0d1d3a");
    const high = new THREE.Color("#3b4d70");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dz = z - valley(x);
      const h = fbm(x * 0.9 + 3, z * 0.9 + 7) * 0.55 - 0.42 * Math.exp(-(dz * dz) / 0.18);
      pos.setY(i, h);
      c.copy(low).lerp(high, Math.min(Math.max((h + 0.3) / 0.75, 0), 1));
      c.offsetHSL(0, 0, (hash(x * 9, z * 9) - 0.5) * 0.04);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [lowPower, size]);

  const boundary = useMemo(() => {
    const top: THREE.Vector3[] = [];
    const bottom: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -1.35 + (i / 40) * 2.7;
      const w = 0.5 * Math.sin((i / 40) * Math.PI) + 0.08;
      top.push(new THREE.Vector3(x, 0, valley(x) - w));
      bottom.unshift(new THREE.Vector3(x, 0, valley(x) + w));
    }
    const pts = [...top, ...bottom, top[0]];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const graticule = useMemo(() => {
    const r = GEO.radius * 1.004;
    const pts: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const la = (lat * Math.PI) / 180;
      for (let i = 0; i < 64; i++) {
        const a = onSphere(la, (i / 64) * Math.PI * 2, r);
        const b = onSphere(la, ((i + 1) / 64) * Math.PI * 2, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const lo = (lon * Math.PI) / 180;
      for (let i = 0; i < 32; i++) {
        const a = onSphere(-Math.PI / 2 + (i / 32) * Math.PI, lo, r);
        const b = onSphere(-Math.PI / 2 + ((i + 1) / 32) * Math.PI, lo, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const textures = useMemo(
    () => ({
      query: createLinesTexture(41, { rows: 1, header: false, accentRows: [0] }),
      layerA: createGridTexture(51),
      layerB: createGridTexture(57),
      report: createLinesTexture(63, { rows: 7, accentRows: [0, 3] }),
    }),
    [],
  );

  const beams = useMemo(() => {
    const make = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color: "#7cb6ff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      return new THREE.LineSegments(g, m);
    };
    return { scan: make(), link: make() };
  }, []);

  const root = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Group>(null);
  const satellite = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const boundaryMat = useRef<THREE.LineBasicMaterial>(null);
  const layerMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const reportMat = useRef<THREE.MeshBasicMaterial>(null);
  const queryMat = useRef<THREE.MeshBasicMaterial>(null);
  const acts = useRef({ vis: 0, query: 0, sat: 0, retrieval: 0, postgis: 0, flood: 0, report: 0 });
  const regionLocal = useMemo(() => onSphere(GEO.region.lat, GEO.region.lon, GEO.radius * 1.02), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const orbit = useMemo(() => new THREE.Vector3(), []);
  const tileCenter = useMemo(() => new THREE.Vector3(...GEO.tile.center), []);

  useFrame(() => {
    const s = frame.stage;
    const p = presence(s, SCENE, 1.15);
    if (!root.current || !globe.current || !satellite.current) return;
    root.current.visible = p > 0;
    if (!root.current.visible) return;

    const a = progress(s, 2.6, 3.42);
    const A = acts.current;
    A.vis = smoothstep(0.4, 0.9, p);
    A.query = smoothstep(0, 0.12, a);
    A.sat = smoothstep(0.08, 0.3, a);
    A.retrieval = smoothstep(0.3, 0.5, a);
    A.postgis = smoothstep(0.45, 0.65, a);
    A.flood = smoothstep(0.55, 0.85, a);
    A.report = smoothstep(0.8, 1, a);
    const t = frame.time;

    globe.current.rotation.y = -SPIN * t;
    const u = frame.reduced ? 0.9 : t * 0.28;
    orbit.set(Math.cos(u) * 2.55, 0, Math.sin(u) * 2.55).applyAxisAngle(X_AXIS, 0.32);
    satellite.current.position.copy(orbit);
    satellite.current.lookAt(0, 0, 0);

    // Scan beam from the satellite to the region of interest (which turns with the globe).
    tmp.copy(regionLocal).applyAxisAngle(Y_AXIS, -SPIN * t);
    const scan = beams.scan.geometry.attributes.position.array as Float32Array;
    scan.set([orbit.x, orbit.y, orbit.z, tmp.x, tmp.y, tmp.z]);
    beams.scan.geometry.attributes.position.needsUpdate = true;
    (beams.scan.material as THREE.LineBasicMaterial).opacity = A.sat * 0.8;
    const link = beams.link.geometry.attributes.position.array as Float32Array;
    link.set([tmp.x, tmp.y, tmp.z, tileCenter.x, tileCenter.y + 0.6, tileCenter.z]);
    beams.link.geometry.attributes.position.needsUpdate = true;
    (beams.link.material as THREE.LineBasicMaterial).opacity = A.retrieval * 0.5;

    if (water.current) {
      water.current.position.y = -0.46 + A.flood * 0.3;
      (water.current.material as THREE.MeshStandardMaterial).opacity = 0.1 + A.flood * 0.45;
    }
    if (boundaryMat.current) boundaryMat.current.opacity = A.flood;
    if (layerMats.current[0]) layerMats.current[0].opacity = A.retrieval * 0.55;
    if (layerMats.current[1]) layerMats.current[1].opacity = A.postgis * 0.55;
    if (reportMat.current) reportMat.current.opacity = A.report;
    if (queryMat.current) queryMat.current.opacity = 0.3 + A.query * 0.7;
  });

  const v = acts.current;
  const tile = GEO.tile.center;
  const reportPos: Vec3 = add(tile, [-2.4, 1.0, -0.4]);

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <group ref={globe}>
        <mesh>
          <sphereGeometry args={[GEO.radius, lowPower ? 40 : 64, lowPower ? 40 : 64]} />
          <meshStandardMaterial color="#0a1630" roughness={0.85} metalness={0.15} />
        </mesh>
        <lineSegments geometry={graticule}>
          <lineBasicMaterial color="#4d8dff" transparent opacity={0.18} depthWrite={false} />
        </lineSegments>
      </group>

      <group ref={satellite}>
        <mesh>
          <boxGeometry args={[0.14, 0.1, 0.18]} />
          <meshStandardMaterial color="#9aa8c4" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.22, 0, 0]}>
            <boxGeometry args={[0.26, 0.01, 0.12]} />
            <meshStandardMaterial color="#123a8a" emissive="#2a6cff" emissiveIntensity={0.6} metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        <LabelAnchor id="geo-satellite" position={[0, 0.3, 0]} visibility={() => v.vis * v.sat} />
      </group>
      <primitive object={beams.scan} />
      <primitive object={beams.link} />

      {/* Natural-language query */}
      <mesh position={GEO.query} rotation={[0, 0.25, 0]}>
        <planeGeometry args={[1.7, 0.36]} />
        <meshBasicMaterial ref={queryMat} map={textures.query} transparent toneMapped={false} />
      </mesh>
      <LabelAnchor id="geo-query" position={add(GEO.query, [0, 0.5, 0])} visibility={() => v.vis * (0.4 + 0.6 * v.query)} />

      {/* Terrain tile pulled from the region */}
      <group position={tile}>
        <mesh geometry={terrain}>
          <meshStandardMaterial vertexColors roughness={0.95} metalness={0.05} />
        </mesh>
        <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size * 0.985, size * 0.985]} />
          <meshStandardMaterial color="#123c8c" emissive="#1f5fff" emissiveIntensity={0.32} transparent roughness={0.25} metalness={0.3} />
        </mesh>
        <lineLoop geometry={boundary} position={[0, -0.12, 0]}>
          <lineBasicMaterial ref={boundaryMat} color="#cfe3ff" transparent depthWrite={false} />
        </lineLoop>
        {[0.95, 1.55].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size * (0.85 - i * 0.12), size * (0.85 - i * 0.12)]} />
            <meshBasicMaterial
              ref={(m) => {
                layerMats.current[i] = m;
              }}
              map={i === 0 ? textures.layerA : textures.layerB}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
        <LabelAnchor id="geo-layer-retrieval" position={[-size * 0.42, 0.95, 0]} visibility={() => v.vis * v.retrieval} />
        <LabelAnchor id="geo-layer-postgis" position={[-size * 0.36, 1.55, 0]} visibility={() => v.vis * v.postgis} />
        <LabelAnchor id="geo-flood" position={[0.1, 0.25, valley(0.1)]} visibility={() => v.vis * v.flood} />
      </group>

      <mesh position={reportPos} rotation={[0, 0.45, 0]}>
        <planeGeometry args={[1.05, 1.25]} />
        <meshBasicMaterial ref={reportMat} map={textures.report} transparent toneMapped={false} />
      </mesh>
      <LabelAnchor id="geo-report" position={add(reportPos, [0, 0.85, 0])} visibility={() => v.vis * v.report} />
    </group>
  );
}
