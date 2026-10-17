// Cloudflare Turnstile, loaded on demand (only when the contact form opens) in explicit-render mode.
// The widget only collects a token; the server verifies it — the widget alone is not spam protection.

export type TurnstileOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  appearance?: "always" | "execute" | "interaction-only";
  "refresh-expired"?: "auto" | "manual" | "never";
  "response-field"?: boolean;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
};

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Public site key, baked in at build time. Empty when the build wasn't configured for the form. */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

let pending: Promise<TurnstileApi> | null = null;

export function loadTurnstile(timeoutMs = 15_000): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;
  pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    const fail = (reason: string) => {
      clearTimeout(timer);
      pending = null;
      script.remove();
      reject(new Error(reason));
    };
    const timer = window.setTimeout(() => fail("Turnstile timed out"), timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail("Turnstile unavailable");
    };
    script.onerror = () => fail("Turnstile failed to load");
    document.head.appendChild(script);
  });
  return pending;
}
