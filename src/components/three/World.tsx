import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { skillGroups } from "@/data/portfolio";
import { SCENE_INVALIDATE, sceneState } from "@/lib/sceneStore";
import { sampleCamera, VIEW_SHIFT } from "./cameraPath";
import type { Formation } from "./formations";
import { frame, presence, progress, smoothstep } from "./frameState";
import { LabelAnchor } from "./Labels";
import AudioScene from "./objects/AudioScene";
import Atmosphere from "./objects/Atmosphere";
import CapabilityHub from "./objects/CapabilityHub";
import GeoScene from "./objects/GeoScene";
import HeroSystem from "./objects/HeroSystem";
import NavScene from "./objects/NavScene";
import ConvergenceScene from "./objects/ConvergenceScene";
import RagPipeline from "./objects/RagPipeline";
import ResumeModule from "./objects/ResumeModule";
import Timeline3D from "./objects/Timeline3D";
import { add, CENTERS, CONVERGENCE } from "./sceneData";
import { createDotTexture } from "./textures";

type Props = {
  formations: Formation[];
  reduced: boolean;
  lowPower: boolean;
  /** Compact layouts stack text under the scene and draw the scene a little quieter. */
  compact: boolean;
  cutoutUrl: string;
  interactive: boolean;
};

const STACK_GROUP_INDEX = new Map(skillGroups.map((g, i) => [`stack-${g.id}`, i]));

export default function World({ formations, reduced, lowPower, compact, cutoutUrl, interactive }: Props) {
  const { camera, size, invalidate, scene } = useThree();
  const count = formations[0].positions.length / 3;
  const last = formations.length - 1;

  const pointsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(formations[0].positions.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(formations[0].colors.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  }, [formations]);
  const dotTexture = useMemo(createDotTexture, []);
  const pointsMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: lowPower ? 0.075 : 0.06,
        map: dotTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        opacity: compact ? 0.75 : 1,
      }),
    [dotTexture, lowPower, compact],
  );
  const linkLines = useMemo(
    () =>
      formations.map((f, k) => {
        if (!f.links.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(f.links.flat()), 3));
        const line = new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({ color: "#5e9bff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        line.position.set(...CENTERS[k]);
        return line;
      }),
    [formations],
  );

  useEffect(
    () => () => {
      pointsGeo.dispose();
      pointsMat.dispose();
      dotTexture.dispose();
      linkLines.forEach((l) => {
        l?.geometry.dispose();
        (l?.material as THREE.Material | undefined)?.dispose();
      });
    },
    [pointsGeo, pointsMat, dotTexture, linkLines],
  );

  useEffect(() => {
    scene.fog = new THREE.Fog("#05070d", 12, 38);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // Reduced motion renders on demand: wake the canvas on scroll / resize.
  useEffect(() => {
    if (!reduced) return;
    const wake = () => invalidate();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    window.addEventListener(SCENE_INVALIDATE, wake);
    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      window.removeEventListener(SCENE_INVALIDATE, wake);
    };
  }, [reduced, invalidate]);

  const rim = useRef<THREE.PointLight>(null);
  const rig = useRef({ stage: sceneState.stage, colorKey: "", camX: 0, camY: 0 });
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const tmpA = useMemo<[number, number, number]>(() => [0, 0, 0], []);
  const tmpB = useMemo<[number, number, number]>(() => [0, 0, 0], []);

  // Runs before every scene object: advances the clock, the stage and the camera.
  useFrame((state, delta) => {
    const r = rig.current;
    const dt = Math.min(delta, 0.05);
    const target = sceneState.stage;
    r.stage += (target - r.stage) * (1 - Math.exp(-dt * (reduced ? 14 : 2.6)));
    if (Math.abs(target - r.stage) < 1e-4) r.stage = target;
    if (reduced && r.stage !== target) invalidate();

    frame.stage = r.stage;
    frame.time = reduced ? 2.5 : state.clock.elapsedTime;
    frame.reduced = reduced;
    frame.lowPower = lowPower;

    // Camera: travel the choreographed path; pull back on narrow screens so subjects fit.
    sampleCamera(r.stage, camPos, camTarget);
    const aspect = size.width / Math.max(size.height, 1);
    const fitAll = Math.min(Math.max(0.78 / aspect, 1), 1.75);
    // The portrait scenes stay close on narrow screens: the ring may crop, the face must not shrink.
    // Final scene: the convergence core is centred above the closing text on every screen size.
    const finalScene = presence(r.stage, 8);
    // The hero and the final core stay close on narrow screens; conduits may run off-screen, the core must not fade into fog.
    const closeUp = Math.max(presence(r.stage, 0), finalScene);
    const fit = fitAll + (Math.min(fitAll, finalScene > presence(r.stage, 0) ? 1.15 : 1.22) - fitAll) * closeUp;
    // Short desktop screens (e.g. 1280×720): pull back further at the final stage so the core
    // keeps clear space above the closing text without being pushed up under the nav.
    const shortScreen = compact ? 0 : Math.min(Math.max((860 - size.height) / 140, 0), 1) * finalScene;
    // Desktop final stage sits a little further back so the whole core and all six channels stay below the nav.
    const finalPullBack = compact ? 1 : 1 + 0.14 * finalScene;
    camPos.sub(camTarget).multiplyScalar(fit * finalPullBack * (1 + 0.45 * shortScreen)).add(camTarget);
    const parallax = reduced || compact ? 0 : 1;
    r.camX += (sceneState.pointerX * 0.5 * parallax - r.camX) * (1 - Math.exp(-dt * 2.5));
    r.camY += (-sceneState.pointerY * 0.3 * parallax - r.camY) * (1 - Math.exp(-dt * 2.5));
    camera.position.set(camPos.x + r.camX, camPos.y + r.camY, camPos.z);
    camera.lookAt(camTarget);

    // Off-axis framing: subject beside the text on desktop, above it on compact screens.
    const from = Math.min(Math.floor(r.stage), last);
    const to = Math.min(from + 1, last);
    const mix = smoothstep(0.18, 0.82, r.stage - from);
    const shiftX = compact ? 0 : VIEW_SHIFT[from] + (VIEW_SHIFT[to] - VIEW_SHIFT[from]) * mix;
    const baseShiftY = compact ? 0.17 : 0;
    const shiftY = baseShiftY + ((compact ? 0.3 : 0.21) - baseShiftY) * finalScene + 0.085 * shortScreen;
    const cam = camera as THREE.PerspectiveCamera;
    cam.setViewOffset(size.width, size.height, shiftX * size.width, shiftY * size.height, size.width, size.height);
    cam.updateMatrixWorld();

    const ca = CENTERS[from];
    const cb = CENTERS[to];
    rim.current?.position.set(ca[0] + (cb[0] - ca[0]) * mix - 2.5, ca[1] + (cb[1] - ca[1]) * mix + 3, ca[2] + (cb[2] - ca[2]) * mix - 3);

    // ── particles: morph between neighbouring formations in world space ──
    const A = formations[from];
    const B = formations[to];
    const pos = pointsGeo.attributes.position.array as Float32Array;
    const time = frame.time;
    const cA = Math.cos(A.spin * time);
    const sA = Math.sin(A.spin * time);
    const cB = Math.cos(B.spin * time);
    const sB = Math.sin(B.spin * time);
    const drift = reduced ? 0 : 0.02;
    const swirl = Math.sin(mix * Math.PI);
    const toConvergence = from === 7 && to === 8;
    // Streams read through the depth fog during that one transition.
    pointsMat.size = (lowPower ? 0.075 : 0.06) * (toConvergence ? 1 + 0.7 * swirl : 1);

    for (let i = 0; i < count; i++) {
      const j = i * 3;
      tmpA[0] = A.positions[j];
      tmpA[1] = A.positions[j + 1];
      tmpA[2] = A.positions[j + 2];
      tmpB[0] = B.positions[j];
      tmpB[1] = B.positions[j + 1];
      tmpB[2] = B.positions[j + 2];
      A.animate?.(i, time, tmpA);
      B.animate?.(i, time, tmpB);
      const ax = tmpA[0] * cA - tmpA[2] * sA + ca[0];
      const ay = tmpA[1] + ca[1];
      const az = tmpA[0] * sA + tmpA[2] * cA + ca[2];
      const bx = tmpB[0] * cB - tmpB[2] * sB + cb[0];
      const by = tmpB[1] + cb[1];
      const bz = tmpB[0] * sB + tmpB[2] * cB + cb[2];
      if (toConvergence) {
        // Experience → Connect: every particle detaches from the timeline and routes through one of
        // the six channel entrances, so mid-transition the field reads as six forming streams.
        const ch = CONVERGENCE.channels[i % 6].from;
        const jx = (((i * 7919) % 97) / 97 - 0.5) * 0.9;
        const jy = (((i * 104729) % 89) / 89 - 0.5) * 0.9;
        // Bundles form part-way along the journey (in front of the travelling camera), each
        // already offset in its channel's direction, then flow forward into the channels.
        const cx = cb[0] + (ca[0] - cb[0]) * 0.45 + ch[0] * 0.95 + jx;
        const cy = cb[1] + (ca[1] - cb[1]) * 0.45 + ch[1] * 0.95 + jy;
        const cz = cb[2] + (ca[2] - cb[2]) * 0.45 + ch[2] * 0.95 + jx * 0.5;
        // Two legs — timeline → bundle point → channel — staggered per particle, so mid-way the
        // field is six tight funnels streaming forward rather than a diffuse cloud.
        const stagger = ((i * 31) % 100) / 100;
        const m = Math.min(Math.max(mix * 1.4 - stagger * 0.4, 0), 1);
        let px: number, py: number, pz: number;
        if (m < 0.5) {
          const k = smoothstep(0, 1, m / 0.5);
          px = ax + (cx - ax) * k;
          py = ay + (cy - ay) * k;
          pz = az + (cz - az) * k;
        } else {
          const k = smoothstep(0, 1, (m - 0.5) / 0.5);
          px = cx + (bx - cx) * k;
          py = cy + (by - cy) * k;
          pz = cz + (bz - cz) * k;
        }
        pos[j] = px + Math.sin(time * 0.5 + i * 1.7) * drift;
        pos[j + 1] = py + Math.cos(time * 0.4 + i * 1.3) * drift;
        pos[j + 2] = pz;
        continue;
      }
      // Particles stream along a spiral while travelling between scenes.
      const ang = i * 2.399 + mix * 3;
      const radius = swirl * (1.2 + (i % 5) * 0.5);
      pos[j] = ax + (bx - ax) * mix + Math.cos(ang) * radius + Math.sin(time * 0.5 + i * 1.7) * drift;
      pos[j + 1] = ay + (by - ay) * mix + Math.sin(ang) * radius * 0.6 + Math.cos(time * 0.4 + i * 1.3) * drift;
      pos[j + 2] = az + (bz - az) * mix;
    }
    pointsGeo.attributes.position.needsUpdate = true;

    const colorKey = `${from}:${to}:${mix.toFixed(3)}`;
    if (colorKey !== r.colorKey) {
      r.colorKey = colorKey;
      const col = pointsGeo.attributes.color.array as Float32Array;
      for (let j = 0; j < col.length; j++) col[j] = A.colors[j] + (B.colors[j] - A.colors[j]) * mix;
      pointsGeo.attributes.color.needsUpdate = true;
    }

    linkLines.forEach((line, k) => {
      if (!line) return;
      const w = presence(r.stage, k);
      line.visible = w > 0.01;
      (line.material as THREE.LineBasicMaterial).opacity = (k === 0 ? 0.12 : 0.22) * smoothstep(0.3, 1, w);
    });
  }, -2);

  const formationLabelVisibility = (k: number, group?: string) => () => {
    const base = smoothstep(0.55, 0.95, presence(frame.stage, k));
    if (k === 6 && group) {
      // Technology groups light up one after another.
      const gi = STACK_GROUP_INDEX.get(group) ?? 0;
      const a = progress(frame.stage, 5.65, 6.3) * skillGroups.length;
      return base * (0.25 + 0.75 * Math.min(Math.max(a - gi, 0), 1));
    }
    if (k === 1) {
      const a = progress(frame.stage, 0.55, 1.15) * 3;
      return base * Math.min(Math.max(a, 0.2), 1);
    }
    return base;
  };

  return (
    <>
      <ambientLight intensity={0.35} color="#8fa8ff" />
      <hemisphereLight args={["#9fb8ff", "#05070d", 0.4]} />
      <directionalLight position={[6, 10, 8]} intensity={1.6} color="#e3ebff" />
      <pointLight ref={rim} color="#3d8bff" intensity={60} distance={22} decay={1.6} />

      <points geometry={pointsGeo} material={pointsMat} frustumCulled={false} />
      {linkLines.map((l, k) => (l ? <primitive key={k} object={l} /> : null))}
      {formations.map((f, k) =>
        f.labels.map((label) => (
          <LabelAnchor key={label.id} id={label.id} position={add(CENTERS[k], label.position)} visibility={formationLabelVisibility(k, label.group)} />
        )),
      )}

      <Atmosphere lowPower={lowPower} />
      <HeroSystem photoUrl={cutoutUrl} interactive={interactive} compact={compact} />
      <CapabilityHub />
      <RagPipeline />
      <GeoScene lowPower={lowPower} />
      <NavScene lowPower={lowPower} />
      <AudioScene />
      <Timeline3D compact={compact} />
      <ConvergenceScene lowPower={lowPower} />
      {/* Secondary output of the core; compact layouts use the inline resume link instead. */}
      {!compact && <ResumeModule />}
    </>
  );
}
