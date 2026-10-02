import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { resumeLink, sceneState } from "@/lib/sceneStore";
import { frame, smoothstep } from "../frameState";
import { CENTERS, CONVERGENCE, type Vec3 } from "../sceneData";
import { createGlowTexture, createLinesTexture } from "../textures";

const SCENE = 8;
const { coreY: CY, radius: R } = CONVERGENCE;
/** Resting place of the module, local to CENTERS[8]: upper right of the core, between channels 05 and 06. */
const POS: Vec3 = [3.0, 1.75, 1.2];
const W = 0.84;
const H = 1.05;
const D = 0.08;
const BASE_ROT_Y = -0.55;

/** Output port on the core's upper ring, facing the module. */
const PORT: Vec3 = (() => {
  const a = Math.atan2(POS[2], POS[0]);
  return [Math.cos(a) * (R + 0.08), CY + 0.8, Math.sin(a) * (R + 0.08)];
})();

const linkVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const linkFragment = /* glsl */ `
  uniform float uTime;
  uniform float uVis;
  uniform float uAct;
  varying float vT;
  void main() {
    // Data flows outward: core → module.
    float flow = pow(fract(vT * 5.0 - uTime * 0.45), 10.0);
    float a = (0.07 + 0.12 * flow + uAct * (0.18 + 0.55 * flow)) * step(vT, uVis) * uVis;
    gl_FragColor = vec4(0.5, 0.72, 1.0, a);
  }
`;

/**
 * Resume Data Module — a secondary output of the System Convergence core. A compact document
 * cartridge served from a port on the core's lower ring. It is decorative: the real download is
 * the HTML link in ContactScene, which this component pins over the cartridge on desktop so that
 * clicking the module clicks the link. Hover/focus of that link sets `sceneState.resume`.
 */
export default function ResumeModule() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const faceMat = useRef<THREE.MeshBasicMaterial>(null);
  const glassMat = useRef<THREE.MeshStandardMaterial>(null);
  const chipMat = useRef<THREE.MeshBasicMaterial>(null);
  const portMat = useRef<THREE.MeshBasicMaterial>(null);
  const scan = useRef<THREE.Mesh>(null);
  const scanMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const state = useRef({ act: 0 });

  const parts = useMemo(() => {
    const box = new THREE.BoxGeometry(W + 0.06, H + 0.06, D);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: "#5e8fe0", transparent: true, depthWrite: false }),
    );
    // Connection: a gentle curve from the core's output port to the module's spine.
    const start = new THREE.Vector3(...PORT);
    const end = new THREE.Vector3(POS[0] - (W / 2) * Math.cos(BASE_ROT_Y) - 0.08, POS[1], POS[2] + (W / 2) * Math.sin(BASE_ROT_Y));
    const ctrl = new THREE.Vector3(start.x * 1.7, end.y + 0.15, start.z * 1.7);
    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
    const pts = curve.getPoints(64);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setAttribute("aT", new THREE.Float32BufferAttribute(pts.map((_, i) => i / 64), 1));
    const link = new THREE.Line(
      g,
      new THREE.ShaderMaterial({
        vertexShader: linkVertex,
        fragmentShader: linkFragment,
        uniforms: { uTime: { value: 0 }, uVis: { value: 0 }, uAct: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const portRot = new THREE.Object3D();
    portRot.position.set(...PORT);
    portRot.lookAt(PORT[0] * 2, PORT[1], PORT[2] * 2);
    return { box, edges, link, portRot: portRot.rotation.clone() };
  }, []);
  const pinMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2a4a8a", toneMapped: false }), []);
  const doc = useMemo(() => createLinesTexture(41, { rows: 8, accentRows: [0] }), []);
  const glow = useMemo(createGlowTexture, []);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), corners: Array.from({ length: 8 }, () => new THREE.Vector3()) }), []);

  useFrame(({ camera, size }, delta) => {
    const s = state.current;
    const t = frame.time;
    // Served by the core once it has assembled.
    const vis = smoothstep(7.72, 7.98, frame.stage);
    if (root.current) root.current.visible = vis > 0.005;
    const target = sceneState.resume && vis > 0.5 ? 1 : 0;
    s.act = frame.reduced ? target : s.act + (target - s.act) * (1 - Math.exp(-Math.min(delta, 0.05) * 5));
    const a = s.act;

    const lm = parts.link.material as THREE.ShaderMaterial;
    lm.uniforms.uTime.value = t;
    lm.uniforms.uVis.value = vis;
    lm.uniforms.uAct.value = a;
    (parts.edges.material as THREE.LineBasicMaterial).opacity = vis * (0.32 + 0.4 * a);
    if (portMat.current) portMat.current.color.setRGB(0.15 + 0.45 * a, 0.3 + 0.45 * a, 0.7 + 0.3 * a);

    if (body.current) {
      // Emerges from the core's port, then rests; hover/focus turns it toward the viewer.
      const e = vis * vis * (3 - 2 * vis);
      const bob = frame.reduced ? 0 : Math.sin(t * 0.7) * 0.035;
      body.current.position.set(
        POS[0] + (PORT[0] - POS[0]) * (1 - e) * 0.4,
        POS[1] + (PORT[1] - POS[1]) * (1 - e) * 0.4 + bob,
        POS[2] + (PORT[2] - POS[2]) * (1 - e) * 0.4 + 0.14 * a,
      );
      body.current.rotation.set(-0.06 + 0.04 * a, BASE_ROT_Y + 0.28 * a, 0.02);
      body.current.scale.setScalar(Math.max(e, 0.001));
    }
    const lit = 0.5 + 0.5 * a;
    faceMat.current?.color.setScalar(lit);
    if (faceMat.current) faceMat.current.opacity = vis;
    if (glassMat.current) glassMat.current.opacity = vis * (0.07 + 0.05 * a);
    if (chipMat.current) chipMat.current.color.setRGB(0.18 + 0.3 * a, 0.36 + 0.36 * a, 0.75 + 0.25 * a);
    pinMat.color.setRGB(0.12 + 0.5 * a, 0.22 + 0.55 * a, 0.45 + 0.5 * a);
    if (glowMat.current) glowMat.current.opacity = vis * (0.05 + 0.1 * a);
    if (scan.current && scanMat.current) {
      // A scan line sweeps the document while active; static when motion is reduced.
      const p = frame.reduced ? 0.35 : (t * 0.6) % 1;
      scan.current.position.y = H / 2 - p * H;
      scanMat.current.opacity = vis * a * (frame.reduced ? 0.45 : 0.85 * Math.sin(p * Math.PI));
    }

    pinLink(vis, camera, size);
  });

  /** Moves the real download link over the cartridge so the module itself is the click/focus target. */
  function pinLink(vis: number, camera: THREE.Camera, size: { width: number; height: number }) {
    const el = resumeLink.el;
    if (!el || !body.current) return;
    body.current.updateMatrixWorld();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      behind = false;
    tmp.corners.forEach((c, i) => {
      c.set(i & 1 ? (W + 0.06) / 2 : -(W + 0.06) / 2, i & 2 ? (H + 0.06) / 2 : -(H + 0.06) / 2, i & 4 ? D / 2 : -D / 2)
        .applyMatrix4(body.current!.matrixWorld)
        .project(camera);
      if (c.z > 1) behind = true;
      const x = (c.x * 0.5 + 0.5) * size.width;
      const y = (-c.y * 0.5 + 0.5) * size.height;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    const shown = vis > 0.02 && !behind && maxX > 0 && minX < size.width && maxY > 0 && minY < size.height;
    const visibility = shown ? "visible" : "hidden";
    if (el.style.visibility !== visibility) el.style.visibility = visibility;
    if (!shown) return;
    const transform = `translate3d(${minX.toFixed(1)}px, ${minY.toFixed(1)}px, 0)`;
    if (el.style.transform !== transform) el.style.transform = transform;
    el.style.setProperty("--hit-w", `${(maxX - minX).toFixed(1)}px`);
    el.style.setProperty("--hit-h", `${(maxY - minY).toFixed(1)}px`);
    const opacity = vis.toFixed(2);
    if (el.style.opacity !== opacity) el.style.opacity = opacity;
  }

  return (
    <group ref={root} position={CENTERS[SCENE]}>
      <primitive object={parts.link} />

      {/* Output port on the core's lower ring */}
      <group position={PORT} rotation={parts.portRot}>
        <mesh>
          <boxGeometry args={[0.2, 0.12, 0.1]} />
          <meshStandardMaterial color="#16223f" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.052]}>
          <planeGeometry args={[0.13, 0.035]} />
          <meshBasicMaterial ref={portMat} color="#264a8f" toneMapped={false} />
        </mesh>
      </group>

      <group ref={body} position={POS}>
        <sprite position={[0, 0, -0.25]} scale={[1.7, 1.7, 1]}>
          <spriteMaterial ref={glowMat} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>

        {/* Cartridge shell */}
        <mesh geometry={parts.box}>
          <meshStandardMaterial color="#121c34" metalness={0.6} roughness={0.35} />
        </mesh>
        <primitive object={parts.edges} />

        {/* Document face: abstract lines, same vocabulary as the RAG document sheets */}
        <mesh position={[0, 0, D / 2 + 0.002]}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial ref={faceMat} map={doc} transparent toneMapped={false} />
        </mesh>
        {/* Glass cover */}
        <mesh position={[0, 0, D / 2 + 0.014]}>
          <planeGeometry args={[W + 0.04, H + 0.04]} />
          <meshStandardMaterial ref={glassMat} color="#9cc6ff" transparent depthWrite={false} metalness={0.2} roughness={0.05} />
        </mesh>
        {/* Format chip, top right */}
        <mesh position={[W / 2 - 0.1, H / 2 - 0.07, D / 2 + 0.008]}>
          <planeGeometry args={[0.14, 0.05]} />
          <meshBasicMaterial ref={chipMat} color="#2e5cbf" toneMapped={false} />
        </mesh>
        {/* Scan line */}
        <mesh ref={scan} position={[0, 0, D / 2 + 0.02]}>
          <planeGeometry args={[W + 0.02, 0.012]} />
          <meshBasicMaterial ref={scanMat} color="#bcd8ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>

        {/* Spine connector facing the core, with contact pins */}
        <mesh position={[-(W + 0.06) / 2 - 0.025, 0, 0]}>
          <boxGeometry args={[0.05, 0.34, D * 0.8]} />
          <meshStandardMaterial color="#1a2a4f" metalness={0.5} roughness={0.35} />
        </mesh>
        {[-0.1, 0, 0.1].map((y) => (
          <mesh key={y} position={[-(W + 0.06) / 2 - 0.052, y, 0]} material={pinMat}>
            <boxGeometry args={[0.012, 0.045, 0.03]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
