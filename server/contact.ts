// POST /api/contact — server side of the portfolio contact form (runs as a Cloudflare Pages Function).
// Kept outside /functions so it isn't routed itself; functions/api/contact.ts is the thin entry point.
// Everything here is provider-agnostic of the runtime: tests call handleContactRequest with a mocked fetch.

import {
  CONTACT_LIMITS,
  CONTACT_MAX_BODY_BYTES,
  SUBMISSION_ID_PATTERN,
  TURNSTILE_ACTION,
  validateContact,
  isValidEmail,
  type ContactErrorCode,
  type ContactInput,
  type ContactResponse,
  type DeliveryStatus,
  type FieldErrors,
} from "../shared/contact.ts";

export interface ContactEnv {
  /** Secrets — set in Cloudflare Pages as encrypted secrets, never in code. */
  RESEND_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** Plain configuration. */
  TELEGRAM_CHAT_ID?: string;
  CONTACT_TO_EMAIL?: string;
  MAIL_FROM_EMAIL?: string;
  /** Development only: extra comma-separated hostnames / origins / test-key permission (e.g. in .dev.vars). */
  CONTACT_ALLOWED_HOSTNAMES?: string;
  CONTACT_ALLOWED_ORIGINS?: string;
  CONTACT_ALLOW_TURNSTILE_TEST_KEYS?: string;
}

export type ContactDeps = { fetch?: typeof fetch; now?: () => Date; log?: (event: string, details: Record<string, unknown>) => void };

/** Fixed server-side destinations. Env may override them, but a visitor never can. */
export const DEFAULT_TO_EMAIL = "jeevaganesan125@gmail.com";
export const DEFAULT_FROM_EMAIL = "Jeeva Portfolio <contact@notify.jeevag.in>";
/** The production site. Anything else must be allowed explicitly through development configuration. */
export const PRODUCTION_HOSTNAMES = ["jeevag.in"];
export const PRODUCTION_ORIGINS = ["https://jeevag.in"];

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_URL = "https://api.resend.com/emails";
const TELEGRAM_MAX = 4096;
const PROVIDER_TIMEOUT_MS = 10_000;
const ALLOWED_KEYS = new Set(["name", "email", "subject", "message", "website", "turnstileToken", "submissionId"]);

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

const STATUS: Record<ContactErrorCode, number> = {
  method_not_allowed: 405,
  unsupported_media_type: 415,
  payload_too_large: 413,
  forbidden_origin: 403,
  invalid_request: 400,
  invalid_fields: 400,
  captcha_missing: 400,
  captcha_failed: 403,
  captcha_expired: 403,
  unavailable: 503,
  delivery_failed: 502,
};

function json(body: ContactResponse, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

function fail(error: ContactErrorCode, fields?: FieldErrors, extra?: Record<string, string>) {
  return json(fields ? { ok: false, error, fields } : { ok: false, error }, STATUS[error], extra);
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Logs only event names and non-sensitive metadata — never keys, tokens or visitor message content. */
function defaultLog(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...details }));
}

/** Reads at most `limit` bytes; returns null if the body is larger. */
async function readLimited(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(all);
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Verification = { ok: true } | { ok: false; error: "captcha_failed" | "captcha_expired" | "unavailable"; reason: string };

async function verifyTurnstile(token: string, ip: string | null, env: ContactEnv, doFetch: typeof fetch): Promise<Verification> {
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY ?? "", response: token });
  if (ip) form.set("remoteip", ip);
  let result: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[]; metadata?: { result_with_testing_key?: boolean } };
  try {
    const res = await doFetch(SITEVERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    if (!res.ok) return { ok: false, error: "unavailable", reason: `siteverify_http_${res.status}` };
    result = await res.json();
  } catch {
    return { ok: false, error: "unavailable", reason: "siteverify_unreachable" };
  }
  const codes = result["error-codes"] ?? [];
  if (!result.success) {
    // Expired or already-redeemed tokens need a fresh challenge, not a different answer.
    if (codes.includes("timeout-or-duplicate")) return { ok: false, error: "captcha_expired", reason: "timeout-or-duplicate" };
    return { ok: false, error: "captcha_failed", reason: codes.join(",") || "unsuccessful" };
  }
  // Cloudflare's public test keys always pass; they must never be honoured in production.
  if (result.metadata?.result_with_testing_key && env.CONTACT_ALLOW_TURNSTILE_TEST_KEYS !== "true") {
    return { ok: false, error: "captcha_failed", reason: "testing_key_not_allowed" };
  }
  const allowedHosts = new Set([...PRODUCTION_HOSTNAMES, ...list(env.CONTACT_ALLOWED_HOSTNAMES)]);
  if (!result.hostname || !allowedHosts.has(result.hostname.toLowerCase())) {
    return { ok: false, error: "captcha_failed", reason: "hostname_not_allowed" };
  }
  if (result.action && result.action !== TURNSTILE_ACTION) return { ok: false, error: "captcha_failed", reason: "action_mismatch" };
  return { ok: true };
}

function formatTime(date: Date) {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

type Delivery = { status: DeliveryStatus; /** Provider HTTP status and error name/code, for logs only. */ detail?: Record<string, unknown> };

/** Reads a provider's error name/code from its JSON error body. Never returns the free-text message. */
async function errorDetail(res: Response, field: "name" | "error_code") {
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const value = body?.[field];
  return { httpStatus: res.status, ...(typeof value === "string" || typeof value === "number" ? { [field]: value } : {}) };
}

async function sendEmail(input: ContactInput, submittedAt: Date, idempotencyKey: string, env: ContactEnv, doFetch: typeof fetch): Promise<Delivery> {
  if (!env.RESEND_API_KEY) return { status: "failed", detail: { reason: "not_configured" } };
  const to = env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO_EMAIL;
  const from = env.MAIL_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  // Plain text only: visitor content is never interpreted as HTML.
  const text = [
    "New message from the portfolio contact form.",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    `Submitted: ${formatTime(submittedAt)}`,
    "",
    "Message:",
    input.message,
    "",
    "—",
    "Reply to this email to answer the sender directly.",
  ].join("\n");
  try {
    const res = await doFetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], reply_to: input.email, subject: `Portfolio contact — ${input.subject}`, text }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    return res.ok ? { status: "sent" } : { status: "failed", detail: await errorDetail(res, "name") };
  } catch {
    return { status: "failed", detail: { reason: "unreachable" } };
  }
}

async function sendTelegram(input: ContactInput, submittedAt: Date, env: ContactEnv, doFetch: typeof fetch): Promise<Delivery> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { status: "failed", detail: { reason: "not_configured" } };
  const head = [
    "New portfolio contact submission",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    `Submitted: ${formatTime(submittedAt)}`,
    "",
    "Message:",
    "",
  ].join("\n");
  const room = TELEGRAM_MAX - head.length - 40;
  const message = input.message.length > room ? `${input.message.slice(0, room)}\n… (truncated — full text in the email)` : input.message;
  try {
    const res = await doFetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No parse_mode: everything the visitor typed is shown as literal text, never as formatting.
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: head + message, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    return res.ok ? { status: "sent" } : { status: "failed", detail: await errorDetail(res, "error_code") };
  } catch {
    return { status: "failed", detail: { reason: "unreachable" } };
  }
}

export async function handleContactRequest(request: Request, env: ContactEnv, deps: ContactDeps = {}): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? defaultLog;

  if (request.method !== "POST") return fail("method_not_allowed", undefined, { Allow: "POST" });

  // Same-origin only: browsers always send Origin on POST.
  const origin = request.headers.get("Origin")?.toLowerCase();
  const allowedOrigins = new Set([...PRODUCTION_ORIGINS, ...list(env.CONTACT_ALLOWED_ORIGINS)]);
  if (!origin || !allowedOrigins.has(origin)) return fail("forbidden_origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") return fail("forbidden_origin");

  const type = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(\s*;|$)/i.test(type)) return fail("unsupported_media_type");

  let text: string | null;
  try {
    text = await readLimited(request, CONTACT_MAX_BODY_BYTES);
  } catch {
    return fail("invalid_request");
  }
  if (text === null) return fail("payload_too_large");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("invalid_request");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("invalid_request");
  const fields = body as Record<string, unknown>;
  // Only the expected fields, all strings. In particular there is no way to supply a recipient.
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_KEYS.has(key) || typeof value !== "string") return fail("invalid_request");
  }
  const str = (key: string) => (typeof fields[key] === "string" ? (fields[key] as string) : "");

  // Honeypot: real visitors never see or fill this field. Answer like a success and send nothing.
  const website = str("website");
  if (website.length > CONTACT_LIMITS.website.max) return fail("invalid_request");
  if (website.trim()) {
    log("contact_honeypot", {});
    return json({ ok: true, delivery: { email: "sent", telegram: "sent" } }, 200);
  }

  const { values, errors } = validateContact({ name: str("name"), email: str("email"), subject: str("subject"), message: str("message") });
  if (Object.keys(errors).length) return fail("invalid_fields", errors);

  const submissionId = str("submissionId");
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) return fail("invalid_request");

  const token = str("turnstileToken").trim();
  if (!token) return fail("captcha_missing");
  if (token.length > CONTACT_LIMITS.turnstileToken.max) return fail("captcha_failed");

  const missing = ["TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((k) => !env[k as keyof ContactEnv]);
  const toEmail = env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO_EMAIL;
  if (!env.TURNSTILE_SECRET_KEY || (!env.RESEND_API_KEY && !env.TELEGRAM_BOT_TOKEN) || !isValidEmail(toEmail)) {
    log("contact_misconfigured", { missing });
    return fail("unavailable");
  }
  if (missing.length) log("contact_partially_configured", { missing });

  const verification = await verifyTurnstile(token, request.headers.get("CF-Connecting-IP"), env, doFetch);
  if (!verification.ok) {
    log("contact_turnstile_rejected", { reason: verification.reason });
    return fail(verification.error);
  }

  const submittedAt = now();
  // One key per logical submission: a retry of the same message (same submission ID, same content)
  // reuses it, so Resend won't send it twice; a new submission gets a new one. Not derived from the
  // Turnstile token — test keys always issue the same dummy token, which made every message collide.
  const idempotencyKey = `contact-${(await sha256Hex(`${submissionId}\n${JSON.stringify(values)}`)).slice(0, 48)}`;
  const [emailResult, telegramResult] = await Promise.all([
    sendEmail(values, submittedAt, idempotencyKey, env, doFetch),
    sendTelegram(values, submittedAt, env, doFetch),
  ]);
  const email = emailResult.status;
  const telegram = telegramResult.status;
  log("contact_delivery", {
    email,
    telegram,
    ...(emailResult.detail ? { emailError: emailResult.detail } : {}),
    ...(telegramResult.detail ? { telegramError: telegramResult.detail } : {}),
  });

  // Either channel carries the full message to Jeeva, so one success means it arrived: report it
  // honestly per channel, and don't invite a resubmission that would duplicate it.
  if (email === "failed" && telegram === "failed") return fail("delivery_failed");
  return json({ ok: true, delivery: { email, telegram } }, 200);
}
