import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { buildFormationsIncrementally, type Formation } from "./formations";
import { LabelContext, OBJECT_LABELS } from "./labelDefs";
import World from "./World";

type Props = {
  compact: boolean;
  reduced: boolean;
  lowPower: boolean;
  interactive: boolean;
  /** Transparent cutout of the portrait for the hero. */
  cutoutUrl: string;
  onReady: () => void;
  onContextLost: () => void;
};

const toneClass = { accent: "scene-label--accent", muted: "scene-label--muted", skill: "scene-label--skill", orbit: "scene-label--orbit", channel: "scene-label--channel" } as const;

/** The fixed, full-screen 3D world. Loaded lazily so three.js never blocks first paint. */
export default function Experience3D({ compact, reduced, lowPower, interactive, cutoutUrl, onReady, onContextLost }: Props) {
  const count = lowPower ? 1000 : 2400;
  // Built in small tasks before the canvas mounts, so start-up never blocks the main thread in one go.
  const [formations, setFormations] = useState<Formation[] | null>(null);
  useEffect(() => buildFormationsIncrementally(count, setFormations), [count]);
  const labels = useMemo(() => (formations ? [...formations.flatMap((f) => f.labels), ...OBJECT_LABELS] : []), [formations]);
  const labelEls = useRef(new Map<string, HTMLElement>());

  const registerLabel = useCallback((id: string, el: HTMLElement | null) => {
    if (el) labelEls.current.set(id, el);
    else labelEls.current.delete(id);
  }, []);

  if (!formations) return null;

  return (
    <>
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <Canvas
          dpr={lowPower ? [1, 1.25] : [1, 1.75]}
          gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
          camera={{ fov: 45, position: [0, 0.2, 9.8], near: 0.1, far: 90 }}
          frameloop={reduced ? "demand" : "always"}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.domElement.addEventListener("webglcontextlost", onContextLost, { once: true });
            requestAnimationFrame(onReady);
          }}
        >
          <LabelContext.Provider value={labelEls.current}>
            <World formations={formations} reduced={reduced} lowPower={lowPower} compact={compact} cutoutUrl={cutoutUrl} interactive={interactive} />
          </LabelContext.Provider>
        </Canvas>
      </div>

      {/* Labels that track objects in the 3D world. Decorative: the same content exists as real text. */}
      {!compact && (
        <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
          {labels.map((label) => (
            <div
              key={label.id}
              ref={(el) => registerLabel(label.id, el)}
              data-label-id={label.id}
              data-label-group={label.group}
              className={`scene-label ${label.tone ? toneClass[label.tone] : ""}`}
              style={{ opacity: 0 }}
            >
              {label.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
