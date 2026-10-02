# Jeeva G — AI/ML Software Developer

A scroll-driven 3D portfolio. Scrolling flies a camera through one continuous 3D world: the portrait core → capability ecosystem → stobay.ai's RAG pipeline → satellite globe and flood-mapping terrain → AR navigation city → real-time audio pipeline → technology constellation → career timeline → back to the core. All real content lives in semantic HTML on top, and works on its own without WebGL.

## Run

```sh
npm install
npm run dev       # http://localhost:8080
npm run build     # production build → dist/
npm run preview   # serve the production build
npm run lint
```

Append `?2d` to the URL to preview the non-WebGL fallback.

## Where things live

| Path | What |
| --- | --- |
| `src/data/portfolio.ts` | **All content** — profile, links, capabilities, systems, stack, experience, education. Edit here; nothing is duplicated elsewhere. |
| `src/components/scenes/` | One component per scene (Hero, Capability, Systems, Stack, Experience, Contact). Each block declares the 3D `stage` it shows. |
| `src/components/three/sceneData.ts` | Where each scene lives in the world and the layout of its objects. |
| `src/components/three/cameraPath.ts` | Camera choreography: keyframes per stage and the off-axis framing beside the text. |
| `src/components/three/formations.ts` | Connective particle formations per stage. |
| `src/components/three/objects/` | One component per 3D environment (portrait core, RAG pipeline, geo, navigation, audio, timeline…). |
| `src/components/three/World.tsx` | Camera rig, particle morphing, lights and scene assembly. |
| `public/profile/` | Portrait (WebP 1024/640 + JPEG fallback). Replace these files to update the photo. |
| `src/components/SceneLayer.tsx` | WebGL detection, lazy loading, error boundary and 2D fallback. |
| `src/hooks/useSceneScroll.ts` | Converts scroll position into the continuous stage value. |

## Behaviour notes

- **Performance** — three.js is code-split and loaded after first paint. Particle count, pixel ratio and antialiasing drop on touch / low-memory devices.
- **Reduced motion** — the canvas renders only on scroll (no idle animation), the custom cursor and parallax are disabled, and CSS / framer-motion animations are minimised.
- **Fallback** — if WebGL is unavailable, fails to load, or the context is lost, a static 2D backdrop replaces it; content and navigation are unaffected.
- **Resume download** — set `profile.resumeUrl` in `src/data/portfolio.ts` to a PDF in `public/` to show a Resume button in the hero.

## Deploy (Netlify)

Build command `npm run build`, publish directory `dist`. `public/_redirects` handles client-side routes and `public/_headers` sets long-lived caching for hashed assets. If the site URL changes, update the canonical / Open Graph URLs in `index.html`, `public/robots.txt` and `public/sitemap.xml`.
