import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { heroPortrait } from "@/lib/heroPortrait";
import { useCompactLayout, useFinePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import Backdrop from "./Backdrop";

const Experience3D = lazy(() => import("./three/Experience3D"));

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = { use3D: boolean; lowPower: boolean; onReady: () => void; onFail: () => void };

/** The 3D world when available; otherwise a static 2D backdrop. Content never depends on it. */
export default function SceneLayer({ use3D, lowPower, onReady, onFail }: Props) {
  const compact = useCompactLayout();
  const reduced = useReducedMotion();
  const fine = useFinePointer();

  useEffect(() => {
    if (!use3D) onReady();
  }, [use3D, onReady]);

  return (
    <>
      <Backdrop showCore={!use3D} />
      {use3D && (
        <SceneErrorBoundary onError={onFail}>
          <Suspense fallback={null}>
            <Experience3D
              compact={compact}
              reduced={reduced}
              lowPower={lowPower}
              interactive={fine && !reduced}
              cutoutUrl={lowPower ? heroPortrait.webpSmall : heroPortrait.webp}
              onReady={onReady}
              onContextLost={onFail}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </>
  );
}
