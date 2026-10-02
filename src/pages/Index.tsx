import { useCallback, useState } from "react";
import CustomCursor from "@/components/CustomCursor";
import LoadingScreen from "@/components/LoadingScreen";
import Navbar from "@/components/Navbar";
import SceneIndicator from "@/components/SceneIndicator";
import SceneLayer from "@/components/SceneLayer";
import { isLowPower, supportsWebGL } from "@/lib/device";
import CapabilityScene from "@/components/scenes/CapabilityScene";
import ContactScene from "@/components/scenes/ContactScene";
import ExperienceScene from "@/components/scenes/ExperienceScene";
import HeroScene from "@/components/scenes/HeroScene";
import StackScene from "@/components/scenes/StackScene";
import SystemsScene from "@/components/scenes/SystemsScene";
import { useFinePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import { usePointerTracking, useSceneScroll } from "@/hooks/useSceneScroll";

const Index = () => {
  const active = useSceneScroll();
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  usePointerTracking(fine && !reduced);

  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);

  // The 3D world and the HTML layer each stand alone; the HTML portrait appears when 3D can't run.
  const [webgl] = useState(supportsWebGL);
  const [lowPower] = useState(isLowPower);
  const [failed, setFailed] = useState(false);
  const onSceneFail = useCallback(() => setFailed(true), []);
  const use3D = webgl && !failed;

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <SceneLayer use3D={use3D} lowPower={lowPower} onReady={onSceneReady} onFail={onSceneFail} />
      <LoadingScreen ready={sceneReady} />
      <Navbar active={active} />
      <SceneIndicator active={active} />
      <CustomCursor />

      <main id="main" className="relative z-10">
        <HeroScene started={sceneReady} has3D={use3D} />
        <CapabilityScene />
        <SystemsScene />
        <StackScene />
        <ExperienceScene />
        <ContactScene has3D={use3D} />
      </main>
    </>
  );
};

export default Index;
