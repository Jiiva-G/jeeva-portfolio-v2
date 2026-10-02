import { heroPortrait } from "@/lib/heroPortrait";
import { cn } from "@/lib/utils";

/**
 * The real portrait (transparent cutout) as HTML. With WebGL the 3D hero shows the person, so
 * this stays visually hidden but still gives screen readers and search engines the image.
 * Without WebGL it is shown directly, lit by a soft glow — no frame, no card.
 */
export default function Portrait({ visible, className }: { visible: boolean; className?: string }) {
  const img = (
    <picture>
      <source type="image/webp" srcSet={`${heroPortrait.webpSmall} 400w, ${heroPortrait.webp} 598w`} sizes="(max-width: 1023px) 60vw, 30vw" />
      <img
        src={heroPortrait.png}
        alt={heroPortrait.alt}
        width={heroPortrait.width}
        height={heroPortrait.height}
        decoding="async"
        className={visible ? "portrait-frame__img" : undefined}
      />
    </picture>
  );

  if (!visible) return <div className="sr-only">{img}</div>;

  return (
    <figure className={cn("portrait-frame", className)}>
      <span className="portrait-frame__glow" aria-hidden="true" />
      {img}
    </figure>
  );
}
