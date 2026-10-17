/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Cloudflare Turnstile site key (build-time). Set in Cloudflare Pages build variables; see .env.example. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
