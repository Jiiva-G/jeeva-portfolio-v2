import * as THREE from "three";

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function radialTexture(size: number, stops: [number, string][]) {
  return canvasTexture(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Soft round sprite for particles. */
export const createDotTexture = () =>
  radialTexture(64, [
    [0, "rgba(255,255,255,1)"],
    [0.25, "rgba(255,255,255,0.85)"],
    [0.6, "rgba(255,255,255,0.18)"],
    [1, "rgba(255,255,255,0)"],
  ]);

/** Wide, faint halo for emissive objects. */
export const createGlowTexture = () =>
  radialTexture(256, [
    [0, "rgba(120,170,255,0.9)"],
    [0.18, "rgba(70,130,255,0.45)"],
    [0.45, "rgba(40,90,220,0.12)"],
    [1, "rgba(20,40,120,0)"],
  ]);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  // Older browsers lack roundRect; square corners are fine there.
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Abstract "text" lines: documents, context and response panels. No real words. */
export function createLinesTexture(seed: number, opts: { rows?: number; accentRows?: number[]; header?: boolean } = {}) {
  const { rows = 9, accentRows = [], header = true } = opts;
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return canvasTexture(256, 320, (ctx) => {
    ctx.fillStyle = "#0b1428";
    ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = "rgba(124,182,255,0.55)";
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, 252, 316, 14);
    ctx.stroke();
    let y = 34;
    if (header) {
      ctx.fillStyle = "rgba(124,182,255,0.9)";
      roundRect(ctx, 22, y - 10, 110, 12, 6);
      ctx.fill();
      y += 30;
    }
    for (let r = 0; r < rows; r++) {
      const w = 120 + rand() * 100;
      ctx.fillStyle = accentRows.includes(r) ? "rgba(90,160,255,0.95)" : "rgba(200,215,245,0.35)";
      roundRect(ctx, 22, y, w, 9, 4.5);
      ctx.fill();
      y += 26;
    }
  });
}

/** Faint grid with a few nodes — layered glass data panels. */
export function createGridTexture(seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return canvasTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(124,182,255,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, 256);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(256, i + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(160,205,255,0.9)";
    for (let n = 0; n < 7; n++) {
      ctx.beginPath();
      ctx.arc(Math.round(rand() * 8) * 32, Math.round(rand() * 8) * 32, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(124,182,255,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 253);
  });
}

/** Push-to-talk device screen. */
export const createDeviceTexture = () =>
  canvasTexture(128, 240, (ctx) => {
    ctx.fillStyle = "#081227";
    ctx.fillRect(0, 0, 128, 240);
    ctx.strokeStyle = "rgba(124,182,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 150, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(61,139,255,0.85)";
    ctx.beginPath();
    ctx.arc(64, 150, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,215,245,0.5)";
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, 24, 40 + i * 18, 80 - i * 18, 7, 3.5);
      ctx.fill();
    }
  });

/** Floor grid that fades out radially — a pad, not a panel. */
export const createFloorTexture = () =>
  canvasTexture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(124,182,255,0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "destination-in";
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
