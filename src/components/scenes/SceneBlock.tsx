import type { ReactNode } from "react";
import type { SceneId } from "@/data/portfolio";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  scene: SceneId;
  /** 3D formation shown while this block is centred in the viewport. */
  stage: number;
  /** Which side the text sits on (desktop). The 3D subject is framed on the other side. */
  align?: "left" | "right" | "center";
  as?: "section" | "div";
  labelledBy?: string;
  className?: string;
  panelClassName?: string;
  /** Rendered outside the text panel (e.g. the 2D portrait fallback). */
  aside?: ReactNode;
  children: ReactNode;
};

export default function SceneBlock({ id, scene, stage, align = "left", as: Tag = "section", labelledBy, className, panelClassName, aside, children }: Props) {
  return (
    <Tag
      id={id}
      data-scene={scene}
      data-stage={stage}
      // Focusable so in-page navigation can move keyboard focus here.
      tabIndex={-1}
      aria-labelledby={labelledBy}
      className={cn(
        "relative flex min-h-[100svh] items-center outline-none",
        // On compact screens the 3D subject is framed in the top of the viewport; text sits below it.
        "max-lg:items-end max-lg:pt-[44svh]",
        className,
      )}
    >
      {/* A soft scrim on the text side keeps copy legible over the scene without boxing it in. */}
      {align !== "center" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 hidden w-[52%] from-bg/75 via-bg/30 to-transparent lg:block",
            align === "left" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l",
          )}
        />
      )}
      {aside}
      <div className="relative mx-auto w-full max-w-[84rem] px-5 py-16 sm:px-8 lg:px-16 lg:py-28">
        <div
          className={cn(
            "scene-panel w-full lg:max-w-[33rem]",
            align === "right" && "lg:ml-auto",
            align === "center" && "mx-auto text-center lg:max-w-[48rem]",
            panelClassName,
          )}
        >
          {children}
        </div>
      </div>
    </Tag>
  );
}
