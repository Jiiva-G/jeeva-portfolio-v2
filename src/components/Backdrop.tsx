/**
 * Static background layer. Always present underneath the WebGL canvas; when WebGL is
 * unavailable it also draws a 2D version of the AI core so the page keeps its identity.
 */
export default function Backdrop({ showCore }: { showCore: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_35%,rgba(37,84,190,0.16),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_90%,rgba(20,50,130,0.14),transparent_70%)]" />
      <div className="backdrop-grid absolute inset-0" />

      {showCore && (
        <svg
          className="fallback-core absolute right-[-12rem] top-1/2 h-[46rem] w-[46rem] -translate-y-1/2 opacity-70 max-lg:right-1/2 max-lg:top-[22%] max-lg:h-[30rem] max-lg:w-[30rem] max-lg:translate-x-1/2"
          viewBox="0 0 400 400"
        >
          <defs>
            <radialGradient id="fallback-glow">
              <stop offset="0%" stopColor="#7cb6ff" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#3d8bff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3d8bff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="190" fill="url(#fallback-glow)" />
          <g className="fallback-core__orbits" fill="none" stroke="#4d8dff" strokeOpacity="0.35">
            <ellipse cx="200" cy="200" rx="150" ry="52" transform="rotate(-18 200 200)" />
            <ellipse cx="200" cy="200" rx="128" ry="40" transform="rotate(32 200 200)" />
            <ellipse cx="200" cy="200" rx="170" ry="66" transform="rotate(74 200 200)" strokeOpacity="0.18" />
          </g>
          <circle cx="200" cy="200" r="58" fill="#0b1630" stroke="#7cb6ff" strokeOpacity="0.6" />
          <circle cx="200" cy="200" r="34" fill="#3d8bff" fillOpacity="0.25" />
          {[
            [62, 160],
            [330, 236],
            [258, 92],
            [128, 300],
            [300, 140],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#9cc6ff" />
          ))}
        </svg>
      )}
    </div>
  );
}
