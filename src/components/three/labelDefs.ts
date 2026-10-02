import { createContext } from "react";
import type { SceneLabel } from "./formations";
import { AUDIO, CONVERGENCE, GEO, HERO_ORBITS, RAG_STEPS, TIMELINE, add, type Vec3 } from "./sceneData";

/** Labels attached to meshes (formation labels are added alongside these). */
export const OBJECT_LABELS: SceneLabel[] = [
  ...HERO_ORBITS.map((o) => ({ id: o.id, text: o.text, position: [0, 0, 0] as Vec3, tone: "orbit" as const })),
  ...RAG_STEPS.map((s) => ({ id: s.id, text: s.text, position: add(s.pos, [0, 0.8, 0]) })),
  { id: "geo-query", text: "Natural-language query", position: add(GEO.query, [0, 0.55, 0]) },
  { id: "geo-satellite", text: "SAR + optical imagery", position: [0, 0, 0] },
  { id: "geo-layer-retrieval", text: "Semantic retrieval", position: [0, 0, 0] },
  { id: "geo-layer-postgis", text: "PostGIS filter", position: [0, 0, 0] },
  { id: "geo-flood", text: "Flood extent", position: [0, 0, 0], tone: "accent" },
  { id: "geo-report", text: "Map · GeoJSON report", position: [0, 0, 0] },
  { id: "nav-gps", text: "GPS position", position: [0, 0, 0] },
  { id: "nav-route", text: "Dijkstra shortest path", position: [0, 0, 0] },
  { id: "nav-ar", text: "AR guidance", position: [0, 0, 0], tone: "accent" },
  { id: "nav-dest", text: "Destination", position: [0, 0, 0] },
  { id: "audio-voice", text: "Voice · push-to-talk", position: add(AUDIO.device, [0, 1.15, 0]) },
  { id: "audio-stream", text: "WebSocket stream", position: [-2.1, 0.95, 0] },
  { id: "audio-asr", text: "ASR / STT", position: add(AUDIO.asr, [0, 1.05, 0]), tone: "accent" },
  { id: "audio-captions", text: "Live captions", position: add(AUDIO.caption, [0, 0.85, 0]) },
  { id: "audio-devices", text: "Multi-device session", position: add(AUDIO.listeners[0], [0, 0.75, 0]) },
  ...CONVERGENCE.channels.map((c) => ({ id: c.id, text: `${c.index} · ${c.text}`, position: [0, 0, 0] as Vec3, tone: "channel" as const })),
  ...TIMELINE.map((n) => ({ id: n.id, text: n.text, position: add(n.pos, [0, 0.95, 0]), tone: (n.latest ? "accent" : "muted") as SceneLabel["tone"] })),
];

export const LabelContext = createContext<Map<string, HTMLElement>>(new Map());
