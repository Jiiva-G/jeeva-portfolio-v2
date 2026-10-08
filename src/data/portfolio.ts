// Single source of truth for all portfolio content.
// Everything here is taken from the current resume — do not add claims that aren't in it.

export const profile = {
  name: "Jeeva G",
  shortName: "JEEVA",
  title: "AI/ML Software Developer",
  positioning: "I build AI systems, not just AI models.",
  domains: ["GenAI", "RAG", "Multi-Agent Systems", "Real-Time AI", "Spatial Intelligence"],
  tagline: "Building intelligent systems from AI research to real-world production.",
  portrait: {
    webp: "/profile/jeeva-1024.webp",
    webpSmall: "/profile/jeeva-640.webp",
    jpg: "/profile/jeeva.jpg",
    alt: "Portrait of Jeeva G in a dark suit, arms crossed, smiling",
    width: 974,
    height: 960,
  },
  location: "Madurai, India",
  current: { company: "NeoRains", focus: "stobay.ai" },
  // Public-safe resume (phone number and home address redacted), served from /public.
  // Never point this at the unredacted original.
  resume: { href: "/Jeeva_Ganesan_Resume.pdf", fileName: "Jeeva_Ganesan_Resume.pdf" },
};

export const links = {
  github: "https://github.com/Jiiva-G",
  linkedin: "https://www.linkedin.com/in/jeeva-g-0809162bb/",
  email: "jeevaganesan125@gmail.com",
};

export type SceneId = "intro" | "capabilities" | "systems" | "stack" | "experience" | "contact";

export const scenes: { id: SceneId; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "capabilities", label: "Capabilities" },
  { id: "systems", label: "Systems" },
  { id: "stack", label: "Stack" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Connect" },
];

export const navItems: { label: string; target: SceneId }[] = [
  { label: "Work", target: "capabilities" },
  { label: "Systems", target: "systems" },
  { label: "Experience", target: "experience" },
  { label: "Contact", target: "contact" },
];

export type Capability = {
  id: string;
  index: string;
  title: string;
  summary: string;
  nodes: string[];
  /** Ids of the systems this capability shows up in. */
  appliedIn: string[];
};

export const capabilities: Capability[] = [
  {
    id: "genai",
    index: "01",
    title: "GenAI & LLM Systems",
    summary: "Retrieval pipelines, orchestration and agents that ground LLMs in real business data.",
    nodes: [
      "RAG",
      "Vector Databases",
      "Semantic Embeddings",
      "LLM Orchestration",
      "Prompt Engineering",
      "Fine-tuning",
      "LangChain",
      "CrewAI",
      "Multi-Agent Systems",
    ],
    appliedIn: ["stobay", "spatial"],
  },
  {
    id: "realtime",
    index: "02",
    title: "Real-Time AI",
    summary: "Streaming audio infrastructure and speech recognition that turns live voice into text.",
    nodes: ["ASR / STT", "Whisper", "Sarvam AI", "Real-Time Captioning", "WebSocket", "Audio Streaming"],
    appliedIn: ["realtime-audio"],
  },
  {
    id: "spatial",
    index: "03",
    title: "Spatial & Intelligent Applications",
    summary: "Maps, routing and geospatial data — from campus wayfinding to satellite analysis.",
    nodes: ["AR Navigation", "GPS", "Dijkstra Pathfinding", "Spatial Data", "Maps", "Satellite Imagery", "Geospatial Intelligence"],
    appliedIn: ["ar-nav", "spatial"],
  },
];

export type System = {
  id: string;
  index: string;
  name: string;
  shortName: string;
  kicker: string;
  /** One line for the scene panel; the full description lives in the detail view. */
  summary: string;
  description: string;
  context: string;
  contribution: string[];
  architecture: string[];
  stack: string[];
  role: string;
  /** Formation shown by the 3D scene while this system is in view. */
  stage: number;
};

export const systems: System[] = [
  {
    id: "stobay",
    index: "S/01",
    name: "stobay.ai",
    shortName: "stobay.ai",
    kicker: "Enterprise document intelligence",
    summary: "Turning business knowledge into grounded AI experiences across connected workflows.",
    description: "Enterprise AI platform for document-based knowledge and intelligent business conversations.",
    context:
      "stobay.ai is an enterprise AI chatbot platform that powers document-based Q&A for businesses, reachable from the channels teams and customers already use.",
    contribution: [
      "Architected and deployed end-to-end RAG pipelines using vector databases and semantic embedding models.",
      "Engineered the Microsoft Teams app integration via Microsoft Partner Center and Azure Bot Framework, delivering a certified Teams-native AI assistant.",
      "Built Meta (Facebook / Instagram) integrations through the Meta Developer Portal, enabling Instagram DM automation and social-channel AI responses.",
      "Developed LinkedIn data pipelines and integrated LinkedIn Developer Portal APIs for extraction and enrichment workflows.",
      "Implemented web scraping infrastructure with Firecrawl, Bright Data and custom extraction agents to keep knowledge sources enriched.",
      "Designed multi-agent workflows with CrewAI and LangChain for research, summarisation and lead-generation pipelines.",
    ],
    // Public-safe capability flow, not the internal architecture.
    architecture: ["Business knowledge", "Intelligent retrieval", "Contextual reasoning", "AI response"],
    stack: ["RAG", "Vector Databases", "Semantic Retrieval", "LLM Orchestration", "Multi-Agent Workflows", "Enterprise Integrations", "Web Scraping", "Automation"],
    role: "Core contributor · NeoRains",
    stage: 2,
  },
  {
    id: "spatial",
    index: "S/02",
    name: "Autonomous Multi-Agent Spatial Intelligence Platform",
    shortName: "Spatial Intelligence Platform",
    kicker: "Satellite imagery × semantic retrieval",
    summary: "Ask in plain language; agents retrieve satellite data, filter it spatially and map flood-affected regions.",
    description:
      "An AI-driven spatial intelligence platform that combines satellite imagery, semantic retrieval, and geospatial analysis to identify and map flood-affected regions from natural language queries.",
    context:
      "Flood mapping normally means manually locating, filtering and analysing satellite scenes. This platform starts from a plain-language question and orchestrates the whole chain automatically.",
    contribution: [
      "Architected an end-to-end platform that orchestrates SAR and optical satellite imagery analysis to detect, segment and map flood-affected regions from natural language queries.",
      "Designed a spatial hybrid RAG pipeline using Qdrant and PostGIS for dual-vector semantic search combined with geospatial boundary filtering across satellite datasets.",
      "Delivered real-time map tile streaming and automated reporting, using MapLibre GL for dynamic raster visualisation and generating flood dossiers with GeoJSON exports.",
    ],
    architecture: ["Natural language", "Agent", "Satellite data", "Semantic retrieval", "PostGIS filtering", "Spatial analysis", "Map / report"],
    stack: ["Python", "FastAPI", "PostgreSQL", "PostGIS", "Qdrant", "LangGraph", "GDAL", "MapLibre GL", "React"],
    role: "Project",
    stage: 3,
  },
  {
    id: "ar-nav",
    index: "S/03",
    name: "AR Campus Navigation",
    shortName: "AR Campus Navigation",
    kicker: "Camera-based wayfinding",
    summary: "GPS tracking, Dijkstra routing and camera-based AR overlays for indoor and outdoor wayfinding.",
    description:
      "Camera-based AR navigation with real-time GPS tracking, shortest-path routing, device sensors, and directional overlays.",
    context:
      "Finding your way around a large campus — indoors and outdoors — on a mobile device, with directions drawn over the live camera view.",
    contribution: [
      "Developed an interactive campus navigation web app with real-time GPS tracking and shortest-path routing using Dijkstra's algorithm.",
      "Built dynamic map layers with Leaflet.js and the Google Maps API.",
      "Built a camera-based AR module using the device camera feed, sensor fusion and GPS position smoothing for real-time directional overlays.",
    ],
    architecture: ["GPS + sensors", "Position smoothing", "Campus graph", "Dijkstra route", "Map layers", "AR overlay"],
    stack: ["Leaflet.js", "Google Maps API", "GPS", "Dijkstra's Algorithm", "Geolocation", "AR"],
    role: "ABOSS Technologies",
    stage: 4,
  },
  {
    id: "realtime-audio",
    index: "S/04",
    name: "Real-Time Audio & Speech System",
    shortName: "Real-Time Audio & Speech",
    kicker: "Live voice → live captions",
    summary: "Push-to-talk voice streamed over WebSocket, transcoded and transcribed into live captions.",
    description:
      "Real-time communication and speech-to-text infrastructure using WebSocket-based audio streaming, push-to-talk sessions, automated audio transcoding, and live captioning.",
    context: "Live voice communication across many devices, with speech turned into captions as people talk — on web and mobile.",
    contribution: [
      "Implemented real-time audio communication using WebSocket-based Push-to-Talk with multi-device session management and live broadcasting.",
      "Integrated speech-to-text (STT / ASR) with an automated audio transcoding pipeline.",
      "Delivered real-time live captions across web and mobile interfaces.",
    ],
    architecture: ["Push-to-talk", "WebSocket stream", "Session manager", "Transcoding", "ASR / STT", "Live captions"],
    stack: ["WebSocket", "Push-to-Talk", "Audio Streaming", "Audio Transcoding", "ASR / STT", "Live Captioning"],
    role: "ABOSS Technologies",
    stage: 5,
  },
];

export type SkillGroup = { id: string; label: string; skills: string[] };

export const skillGroups: SkillGroup[] = [
  { id: "core", label: "Core engineering", skills: ["Python", "FastAPI", "React"] },
  { id: "agents", label: "LLMs & agents", skills: ["LangChain", "LangGraph", "CrewAI", "RAG", "Prompt Engineering", "Fine-tuning"] },
  { id: "data", label: "Retrieval & data", skills: ["Qdrant", "Vector Databases", "Semantic Embeddings", "PostgreSQL", "PostGIS"] },
  { id: "geo", label: "Geospatial", skills: ["GDAL", "MapLibre GL", "Leaflet.js", "Google Maps API", "Geolocation APIs", "KML", "Dijkstra"] },
  { id: "speech", label: "Real-time & speech", skills: ["WebSocket", "WebRTC", "Push-to-Talk", "Whisper", "Sarvam AI (Saaras v3)", "ASR / STT"] },
  {
    id: "integrations",
    label: "Integrations & automation",
    skills: ["Microsoft Teams App", "Azure Bot Framework", "Meta Developer Portal", "Instagram API", "LinkedIn Developer Portal", "Google Cloud Console", "n8n", "Firecrawl", "Bright Data"],
  },
];

export type Role = {
  company: string;
  title: string;
  period: string;
  location: string;
  summary: string;
  focus: string[];
};

export const experience: Role[] = [
  {
    company: "NeoRains",
    title: "AI/ML Software Developer",
    period: "Jan 2026 – Present",
    location: "Madurai, India · On-site",
    summary: "Core contributor to stobay.ai — RAG pipelines, enterprise integrations, multi-agent workflows and client delivery.",
    focus: ["stobay.ai", "RAG systems", "Microsoft Teams", "Meta / Instagram", "LinkedIn data", "Web scraping", "CrewAI", "LangChain", "n8n", "Client delivery"],
  },
  {
    company: "ABOSS Technologies",
    title: "AI/ML Software Developer",
    period: "Aug 2025 – Jan 2026",
    location: "Madurai, India · On-site",
    summary: "AR campus navigation with shortest-path routing, and push-to-talk audio with live speech-to-text captions.",
    focus: ["AR navigation", "GPS", "Dijkstra routing", "WebSocket", "PTT", "Speech-to-text", "Live captioning"],
  },
];

export const education = [
  {
    degree: "M.Sc. Computer Science — AI & ML Specialisation",
    school: "Madurai Kamaraj University",
    period: "2023 – 2025",
    cgpa: "8.7",
  },
  {
    degree: "B.Sc. Computer Science",
    school: "The American College of Arts and Science",
    period: "2019 – 2022",
    cgpa: "7.9",
  },
];
