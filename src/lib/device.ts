// Capability checks used to choose between the 3D world and the 2D fallback.

export function supportsWebGL() {
  // `?2d` forces the fallback — handy for testing the non-WebGL experience.
  if (new URLSearchParams(window.location.search).has("2d")) return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function isLowPower() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return coarse || window.innerWidth < 768 || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
}
