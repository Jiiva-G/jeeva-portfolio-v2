import { scenes, type SceneId } from "@/data/portfolio";
import { scrollToScene } from "@/lib/sceneStore";
import { cn } from "@/lib/utils";

/**
 * Where-am-I indicator: `03 / SYSTEMS` plus one segment per scene. Desktop only; mobile shows it in the nav pill.
 * Visual only: the primary nav already exposes the current scene (aria-current) to keyboard and screen-reader
 * users, so this stays out of the tab order and the accessibility tree instead of announcing every scene change.
 * Past the intro it sits on the same frosted backdrop as the nav pill, so content scrolling beneath it stays clear.
 */
export default function SceneIndicator({ active }: { active: SceneId }) {
  const index = scenes.findIndex((s) => s.id === active);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed left-6 top-7 z-40 -ml-3.5 -mt-2.5 hidden rounded-2xl border px-3.5 py-2.5 transition-[background-color,border-color,box-shadow] duration-500 xl:block",
        index > 0 ? "border-line bg-surface/70 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "border-transparent",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
        <span className="text-accent-bright">{String(index + 1).padStart(2, "0")}</span>
        <span className="text-muted/50"> / </span>
        <span className="text-ink">{scenes[index]?.label}</span>
      </p>
      <ol className="mt-2.5 flex gap-1">
        {scenes.map((scene, i) => (
          <li key={scene.id}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => scrollToScene(scene.id)}
              className="group flex h-4 items-center"
            >
              <span
                className={cn(
                  "block h-[2px] w-4 rounded-full transition-all duration-500",
                  i < index && "bg-accent/50",
                  i === index && "w-7 bg-accent shadow-[0_0_8px_rgba(61,139,255,0.8)]",
                  i > index && "bg-line-strong group-hover:bg-muted",
                )}
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
