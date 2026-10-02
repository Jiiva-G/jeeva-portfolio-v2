import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneState } from "@/lib/sceneStore";
import { frame, smoothstep } from "../frameState";
import { LabelAnchor } from "../Labels";
import { CENTERS, HERO_ORBITS, HERO_PERSON, heroOrbitPoint, type HeroDomainKind, type HeroOrbit } from "../sceneData";
import { createDotTexture, createGlowTexture } from "../textures";

// ── Person ───────────────────────────────────────────────────────────────────
const personVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Cutout sampled as raw sRGB (toneMapped off) so skin tones stay true. The rim light is derived
// from the alpha gradient, so it hugs the silhouette instead of drawing a frame or halo.
const personFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTexel;
  uniform vec2 uLight;
  uniform float uOpacity;
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float aL = texture2D(uMap, vUv - vec2(uTexel.x * 3.0, 0.0)).a;
    float aR = texture2D(uMap, vUv + vec2(uTexel.x * 3.0, 0.0)).a;
    float aU = texture2D(uMap, vUv + vec2(0.0, uTexel.y * 3.0)).a;
    float aD = texture2D(uMap, vUv - vec2(0.0, uTexel.y * 3.0)).a;
    vec2 grad = vec2(aR - aL, aU - aD);
    float edge = clamp(length(grad) * 1.4, 0.0, 1.0) * c.a;
    float facing = clamp(dot(normalize(-grad + 1e-5), uLight) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(c.rgb, c.rgb * vec3(0.93, 0.98, 1.08), 0.35);
    col += vec3(0.32, 0.56, 1.0) * edge * facing * (0.55 + 0.35 * uHover);
    // The photo ends at the waist: dissolve that edge into the haze.
    float fade = smoothstep(0.0, 0.2, vUv.y);
    float alpha = c.a * fade * uOpacity;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Orbit trails: barely-there paths that only brighten just behind each body ──
const trailVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  varying float vDepth;
  void main() {
    vT = aT;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const trailFragment = /* glsl */ `
  uniform float uHead;
  uniform float uOpacity;
  varying float vT;
  varying float vDepth;
  void main() {
    float d = fract(uHead - vT);
    float trail = exp(-d * 9.0);
    float depthFade = 1.0 - smoothstep(9.0, 15.5, vDepth);
    float a = (0.016 + 0.28 * trail) * depthFade * uOpacity;
    gl_FragColor = vec4(0.47, 0.68, 1.0, a);
  }
`;

const PULSES = 3;
const PULSE_TRAIL = 6;
const PULSE_PERIOD = 6;

type Fade = (base: number) => (m: THREE.Material | null) => void;

/** A small 3D object that reads as a planet from afar and as its domain up close. */
function DomainBody({ kind, size, fade, dot, glow }: { kind: HeroDomainKind; size: number; fade: Fade; dot: THREE.Texture; glow: THREE.Texture }) {
  const spin = useRef<THREE.Group>(null);
  const swarm = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const s = size;

  const geo = useMemo(() => {
    const pts = (n: number, r: number, seed: number) => {
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const th = i * 2.399 + seed;
        arr.set([Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      return g;
    };
    const lines = (segments: [number, number, number][][]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(segments.flat(2), 3));
      return g;
    };
    const tetra: [number, number, number][] = [
      [1, 1, 1],
      [-1, -1, 1],
      [-1, 1, -1],
      [1, -1, -1],
    ].map(([x, y, z]) => [x * s * 0.55, y * s * 0.55, z * s * 0.55]);
    const net: [number, number, number][] = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2;
      return [Math.cos(a) * s * 0.8, Math.sin(a * 2) * s * 0.3, Math.sin(a) * s * 0.8];
    });
    const graticule: [number, number, number][][] = [];
    const R = s * 0.6;
    for (let lat = -1; lat <= 1; lat++) {
      const la = lat * 0.55;
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI * 2;
        const a1 = ((i + 1) / 24) * Math.PI * 2;
        graticule.push([
          [Math.cos(la) * Math.cos(a0) * R, Math.sin(la) * R, Math.cos(la) * Math.sin(a0) * R],
          [Math.cos(la) * Math.cos(a1) * R, Math.sin(la) * R, Math.cos(la) * Math.sin(a1) * R],
        ]);
      }
    }
    for (let m = 0; m < 4; m++) {
      const lo = (m / 4) * Math.PI;
      for (let i = 0; i < 16; i++) {
        const b0 = -Math.PI / 2 + (i / 16) * Math.PI;
        const b1 = -Math.PI / 2 + ((i + 1) / 16) * Math.PI;
        graticule.push([
          [Math.cos(b0) * Math.cos(lo) * R, Math.sin(b0) * R, Math.cos(b0) * Math.sin(lo) * R],
          [Math.cos(b1) * Math.cos(lo) * R, Math.sin(b1) * R, Math.cos(b1) * Math.sin(lo) * R],
        ]);
      }
    }
    return {
      swarm: pts(22, s * 1.05, 0),
      vectors: pts(12, s * 0.45, 1.3),
      tetra,
      tetraLines: lines(tetra.map((p) => [[0, 0, 0], p])),
      net,
      netLines: lines(net.map((p, i) => [p, net[(i + 2) % net.length]]).concat(net.map((p) => [[0, 0, 0], p]))),
      graticule: lines(graticule),
      cube: new THREE.EdgesGeometry(new THREE.BoxGeometry(s * 1.4, s * 1.4, s * 1.4)),
      shell: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(s * 0.82, 1)),
    };
  }, [s]);

  const wave = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#9cc6ff", transparent: true, depthWrite: false }));
    return { geo: g, line };
  }, []);
  useEffect(() => {
    if (kind === "realtime") fade(0.8)(wave.line.material as THREE.Material);
  }, [kind, fade, wave]);

  useFrame(() => {
    const t = frame.time;
    if (spin.current) {
      if (kind === "realtime") {
        // A signal ring reads best facing the viewer: sway instead of spinning edge-on.
        spin.current.rotation.y = Math.sin(t * 0.35) * 0.45;
        spin.current.rotation.z = t * 0.15;
      } else {
        spin.current.rotation.y = t * 0.28;
        spin.current.rotation.x = Math.sin(t * 0.2) * 0.25;
      }
    }
    if (swarm.current) swarm.current.rotation.y = -t * 0.6;
    if (kind === "realtime") {
      const arr = wave.geo.attributes.position.array as Float32Array;
      for (let i = 0; i < 32; i++) {
        const x = (i / 31 - 0.5) * s * 1.2;
        const env = Math.cos((i / 31 - 0.5) * Math.PI);
        arr.set([x, Math.sin(i * 0.9 - t * 3) * s * 0.28 * env, 0], i * 3);
      }
      wave.geo.attributes.position.needsUpdate = true;
    }
    if (pulse.current) pulse.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06 * (frame.reduced ? 0 : 1));
  });

  const dark = { color: "#101d3d", metalness: 0.45, roughness: 0.35 };

  return (
    <group>
      <sprite scale={[s * 3.4, s * 3.4, 1]}>
        <spriteMaterial ref={fade(0.22)} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <group ref={spin}>
        {kind === "genai" && (
          <>
            <mesh>
              <icosahedronGeometry args={[s * 0.52, 2]} />
              <meshStandardMaterial ref={fade(1)} {...dark} emissive="#3d8bff" emissiveIntensity={0.38} transparent />
            </mesh>
            <lineSegments geometry={geo.shell}>
              <lineBasicMaterial ref={fade(0.3)} color="#9cc6ff" transparent depthWrite={false} />
            </lineSegments>
            <group ref={swarm}>
              <points geometry={geo.swarm}>
                <pointsMaterial ref={fade(0.9)} map={dot} size={s * 0.16} color="#cfe3ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
              </points>
            </group>
          </>
        )}
        {kind === "rag" && (
          <>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * s * 0.12, k * s * 0.08, k * s * 0.25]} rotation={[0, 0.3, 0]}>
                <boxGeometry args={[s * 0.75, s * 0.95, s * 0.02]} />
                <meshStandardMaterial ref={fade(1)} {...dark} emissive="#2f6fe8" emissiveIntensity={0.45 + (k + 1) * 0.15} transparent />
              </mesh>
            ))}
            <lineSegments geometry={geo.cube}>
              <lineBasicMaterial ref={fade(0.28)} color="#7cb6ff" transparent depthWrite={false} />
            </lineSegments>
            <points geometry={geo.vectors}>
              <pointsMaterial ref={fade(0.9)} map={dot} size={s * 0.14} color="#cfe3ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
            </points>
          </>
        )}
        {kind === "multi" && (
          <>
            <mesh>
              <octahedronGeometry args={[s * 0.32, 0]} />
              <meshStandardMaterial ref={fade(1)} {...dark} emissive="#3d8bff" emissiveIntensity={0.9} flatShading transparent />
            </mesh>
            {geo.tetra.map((p, i) => (
              <mesh key={i} position={p}>
                <sphereGeometry args={[s * 0.11, 12, 12]} />
                <meshStandardMaterial ref={fade(1)} color="#1a2c55" emissive="#7cb6ff" emissiveIntensity={0.7} transparent />
              </mesh>
            ))}
            <lineSegments geometry={geo.tetraLines}>
              <lineBasicMaterial ref={fade(0.45)} color="#7cb6ff" transparent depthWrite={false} />
            </lineSegments>
          </>
        )}
        {kind === "realtime" && (
          <>
            <mesh ref={pulse}>
              <torusGeometry args={[s * 0.7, s * 0.035, 8, 48]} />
              <meshStandardMaterial ref={fade(1)} color="#1a2c55" emissive="#7cb6ff" emissiveIntensity={1.1} transparent />
            </mesh>
            <primitive object={wave.line} />
            <points geometry={wave.geo}>
              <pointsMaterial ref={fade(0.9)} map={dot} size={s * 0.12} color="#cfe3ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
            </points>
          </>
        )}
        {kind === "spatial" && (
          <>
            <mesh>
              <sphereGeometry args={[s * 0.56, 24, 16]} />
              <meshStandardMaterial ref={fade(1)} {...dark} transparent />
            </mesh>
            <lineSegments geometry={geo.graticule}>
              <lineBasicMaterial ref={fade(0.5)} color="#7cb6ff" transparent depthWrite={false} />
            </lineSegments>
            <mesh position={[s * 0.3, s * 0.32, s * 0.35]}>
              <sphereGeometry args={[s * 0.07, 10, 10]} />
              <meshBasicMaterial ref={fade(1)} color="#cfe3ff" transparent toneMapped={false} />
            </mesh>
          </>
        )}
        {kind === "systems" && (
          <>
            {geo.net.map((p, i) => (
              <mesh key={i} position={p}>
                <boxGeometry args={[s * 0.2, s * 0.2, s * 0.2]} />
                <meshStandardMaterial ref={fade(1)} {...dark} emissive="#2f6fe8" emissiveIntensity={0.7} transparent />
              </mesh>
            ))}
            <mesh>
              <boxGeometry args={[s * 0.28, s * 0.28, s * 0.28]} />
              <meshStandardMaterial ref={fade(1)} {...dark} emissive="#7cb6ff" emissiveIntensity={0.9} transparent />
            </mesh>
            <lineSegments geometry={geo.netLines}>
              <lineBasicMaterial ref={fade(0.4)} color="#7cb6ff" transparent depthWrite={false} />
            </lineSegments>
          </>
        )}
      </group>
    </group>
  );
}

type Props = { photoUrl: string; interactive: boolean; compact: boolean };

/** Hero: the real person at the centre, with domain "worlds" orbiting on separate tilted planes. */
export default function HeroSystem({ photoUrl, interactive, compact }: Props) {
  const orbits = useMemo(() => HERO_ORBITS.filter((o) => !compact || o.compact), [compact]);
  const orbitScale = compact ? 0.82 : 1;
  const W = HERO_PERSON.width;
  const H = HERO_PERSON.height;

  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    new THREE.TextureLoader().load(photoUrl, (t) => {
      if (cancelled) return t.dispose();
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      setTexture(t);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);
  useEffect(() => () => texture?.dispose(), [texture]);

  const dot = useMemo(createDotTexture, []);
  const glow = useMemo(createGlowTexture, []);
  const plane = useMemo(() => new THREE.PlaneGeometry(W, H), [W, H]);
  const personUniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uTexel: { value: new THREE.Vector2(1 / 598, 1 / 920) },
      uLight: { value: new THREE.Vector2(0.6, 0.8) },
      uOpacity: { value: 0 },
      uHover: { value: 0 },
    }),
    [],
  );
  useEffect(() => {
    personUniforms.uMap.value = texture;
    if (texture?.image) personUniforms.uTexel.value.set(1 / texture.image.width, 1 / texture.image.height);
  }, [texture, personUniforms]);

  const trails = useMemo(
    () =>
      orbits.map((o) => {
        const n = 160;
        const pos = new Float32Array((n + 1) * 3);
        const t = new Float32Array(n + 1);
        for (let i = 0; i <= n; i++) {
          pos.set(heroOrbitPoint(o, (i / n) * Math.PI * 2, orbitScale), i * 3);
          t[i] = i / n;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
        const m = new THREE.ShaderMaterial({
          vertexShader: trailVertex,
          fragmentShader: trailFragment,
          uniforms: { uHead: { value: 0 }, uOpacity: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        return new THREE.Line(g, m);
      }),
    [orbits, orbitScale],
  );

  const pulseGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PULSES * PULSE_TRAIL * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PULSES * PULSE_TRAIL * 3), 3));
    return g;
  }, []);
  const pairs = useMemo(() => {
    const p: [number, number][] = [];
    for (let i = 0; i < orbits.length; i++) p.push([i, (i + 2) % orbits.length]);
    return p;
  }, [orbits]);

  useEffect(
    () => () => {
      trails.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
    },
    [trails],
  );

  const root = useRef<THREE.Group>(null);
  const person = useRef<THREE.Group>(null);
  const personMesh = useRef<THREE.Mesh>(null);
  const system = useRef<THREE.Group>(null);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const fades = useRef<{ m: THREE.Material; base: number }[]>([]);
  const fade: Fade = (base) => (m) => {
    if (m && !fades.current.some((f) => f.m === m)) fades.current.push({ m, base });
  };
  const bodyPos = useRef<THREE.Vector3[]>(HERO_ORBITS.map(() => new THREE.Vector3()));
  const labelVis = useRef<number[]>(HERO_ORBITS.map(() => 0));
  const weight = useRef(0);
  const reveal = useRef(0);
  const hoverAmt = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const ctrl = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, delta) => {
    const s = frame.stage;
    const w = 1 - smoothstep(0.08, 0.7, s);
    weight.current = w;
    if (!root.current || !person.current || !system.current) return;
    root.current.visible = w > 0.005;
    if (!root.current.visible) return;

    const dt = Math.min(delta, 0.05);
    const t = frame.time;
    if (texture) reveal.current = Math.min(1, reveal.current + dt * (frame.reduced ? 10 : 0.8));
    const opacity = w * reveal.current;
    root.current.scale.setScalar(0.55 + 0.45 * w);

    let hover = false;
    if (interactive && personMesh.current && w > 0.6 && !frame.reduced) {
      ndc.set(sceneState.pointerX, -sceneState.pointerY);
      raycaster.setFromCamera(ndc, camera);
      hover = raycaster.intersectObject(personMesh.current).length > 0;
    }
    if (interactive && hover !== frame.portraitHover) {
      frame.portraitHover = hover;
      document.documentElement.classList.toggle("cursor-3d", hover);
    }
    hoverAmt.current += ((hover ? 1 : 0) - hoverAmt.current) * (1 - Math.exp(-dt * 5));

    // Very light parallax: the person turns a touch, the orbital system responds a little more.
    const k = 1 - Math.exp(-dt * 2.5);
    const px = frame.reduced ? 0 : sceneState.pointerX;
    const py = frame.reduced ? 0 : sceneState.pointerY;
    person.current.rotation.y += (px * 0.07 - person.current.rotation.y) * k;
    person.current.position.x += (px * 0.06 - person.current.position.x) * k;
    system.current.rotation.x += (py * 0.05 - system.current.rotation.x) * k;
    system.current.rotation.y += (px * 0.08 - system.current.rotation.y) * k;
    personUniforms.uLight.value.set(0.55 + px * 0.45, 0.8 - py * 0.3).normalize();
    personUniforms.uOpacity.value = opacity;
    personUniforms.uHover.value = hoverAmt.current;

    orbits.forEach((o, i) => {
      const a = o.phase + t * o.speed;
      const p = heroOrbitPoint(o, a, orbitScale);
      bodyPos.current[i].set(p[0], p[1], p[2]);
      const b = bodies.current[i];
      if (b) b.position.set(p[0], p[1], p[2]);
      const head = (((a / (Math.PI * 2)) % 1) + 1) % 1;
      const m = trails[i].material as THREE.ShaderMaterial;
      m.uniforms.uHead.value = head;
      m.uniforms.uOpacity.value = opacity;
      // Labels: bright in front, dim behind, hidden when the body is behind the person.
      const behindPerson = p[2] < -0.2 && Math.abs(p[0]) < W * 0.5 && p[1] < HERO_PERSON.y + H * 0.45;
      labelVis.current[i] = behindPerson ? 0 : p[2] < -0.2 ? 0.45 : 0.9;
    });

    fades.current.forEach(({ m, base }) => {
      m.opacity = base * opacity;
    });

    // Data pulses arcing between domains, curving behind the person.
    const pos = pulseGeo.attributes.position.array as Float32Array;
    const col = pulseGeo.attributes.color.array as Float32Array;
    for (let p = 0; p < PULSES; p++) {
      const cycle = (t + p * (PULSE_PERIOD / PULSES)) / PULSE_PERIOD;
      const [ia, ib] = pairs[Math.floor(cycle) % pairs.length];
      const u0 = cycle % 1;
      const A = bodyPos.current[ia];
      const B = bodyPos.current[ib];
      ctrl.set((A.x + B.x) * 0.3, (A.y + B.y) * 0.5 + 0.6, Math.min(A.z, B.z) - 1.6);
      for (let k2 = 0; k2 < PULSE_TRAIL; k2++) {
        const u = Math.min(Math.max(u0 - k2 * 0.025, 0), 1);
        const iu = 1 - u;
        const j = (p * PULSE_TRAIL + k2) * 3;
        pos[j] = iu * iu * A.x + 2 * iu * u * ctrl.x + u * u * B.x;
        pos[j + 1] = iu * iu * A.y + 2 * iu * u * ctrl.y + u * u * B.y;
        pos[j + 2] = iu * iu * A.z + 2 * iu * u * ctrl.z + u * u * B.z;
        const env = Math.sin(Math.PI * u0) * (1 - k2 / PULSE_TRAIL) * opacity * (frame.reduced ? 0 : 1);
        col[j] = 0.55 * env;
        col[j + 1] = 0.75 * env;
        col[j + 2] = 1.0 * env;
      }
    }
    pulseGeo.attributes.position.needsUpdate = true;
    pulseGeo.attributes.color.needsUpdate = true;
  });

  return (
    <group ref={root} position={CENTERS[0]}>
      {/* Atmosphere around the person — light falloff, not a halo. */}
      <sprite position={[0, 0.7, -1.6]} scale={[7.5, 7.5, 1]}>
        <spriteMaterial ref={fade(0.2)} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0, HERO_PERSON.y - H * 0.42, -0.4]} scale={[9, 2.2, 1]}>
        <spriteMaterial ref={fade(0.16)} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <group ref={person} position={[0, HERO_PERSON.y, 0]}>
        <mesh ref={personMesh} geometry={plane}>
          <shaderMaterial vertexShader={personVertex} fragmentShader={personFragment} uniforms={personUniforms} transparent toneMapped={false} />
        </mesh>
      </group>

      <group ref={system}>
        {trails.map((line, i) => (
          <primitive key={orbits[i].id} object={line} />
        ))}
        {orbits.map((o: HeroOrbit, i) => (
          <group
            key={o.id}
            ref={(g) => {
              bodies.current[i] = g;
            }}
          >
            <DomainBody kind={o.kind} size={o.size * (compact ? 0.9 : 1.15)} fade={fade} dot={dot} glow={glow} />
            <LabelAnchor id={o.id} position={[0, o.size * 1.75, 0]} visibility={() => weight.current * reveal.current * labelVis.current[i]} />
          </group>
        ))}
        <points geometry={pulseGeo}>
          <pointsMaterial map={dot} size={0.12} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
    </group>
  );
}
