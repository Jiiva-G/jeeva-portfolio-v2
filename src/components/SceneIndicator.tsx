import { scenes, type SceneId } from "@/data/portfolio";
import { scrollToScene } from "@/lib/sceneStore";
import { cn } from "@/lib/utils";

/** Where-am-I indicator: `03 / SYSTEMS` plus one segment per scene. Desktop only; mobile shows it in the nav pill. */
export default function SceneIndicator({ active }: { active: SceneId }) {
  const index = scenes.findIndex((s) => s.id === active);
  return (
    <nav aria-label="Story progress" className="fixed left-6 top-7 z-40 hidden xl:block">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted" aria-live="polite">
        <span className="text-accent-bright">{String(index + 1).padStart(2, "0")}</span>
        <span className="text-muted/50"> / </span>
        <span className="text-ink">{scenes[index]?.label}</span>
      </p>
      <ol className="mt-2.5 flex gap-1">
        {scenes.map((scene, i) => (
          <li key={scene.id}>
            <button
              type="button"
              onClick={() => scrollToScene(scene.id)}
              aria-label={`${String(i + 1).padStart(2, "0")} — ${scene.label}`}
              aria-current={i === index ? "step" : undefined}
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
    </nav>
  );
}
