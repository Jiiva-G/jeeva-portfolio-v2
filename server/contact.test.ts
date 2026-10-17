// Tests for POST /api/contact with every provider mocked. Run: npm run test:contact
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleContactRequest, DEFAULT_FROM_EMAIL, DEFAULT_TO_EMAIL, type ContactEnv } from "./contact.ts";

const ENV: ContactEnv = {
  RESEND_API_KEY: "test-resend-key",
  TELEGRAM_BOT_TOKEN: "test-telegram-token",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  TELEGRAM_CHAT_ID: "12345",
};

const VALID = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "A project idea",
  message: "Hello Jeeva,\nI'd like to talk about an AI system.",
  website: "",
  turnstileToken: "token-abc",
  submissionId: "3f1c2a9e-5b7d-4c11-9a2e-7d6f0b8e1c55",
};

/** Cloudflare's always-pass test site key issues this same token for every challenge. */
const TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** Emulates Resend's idempotency: same key + different body → 409; same key + same body → cached, not re-sent. */
function resendIdempotencyStore() {
  const byKey = new Map<string, string>();
  const store = { sends: 0, conflicts: 0, replays: 0, keys: [] as string[] };
  const handle = (init: RequestInit) => {
    const key = (init.headers as Record<string, string>)["Idempotency-Key"];
    const body = String(init.body);
    store.keys.push(key);
    const prior = byKey.get(key);
    if (prior !== undefined && prior !== body) {
      store.conflicts++;
      return new Response(JSON.stringify({ statusCode: 409, name: "invalid_idempotent_request", message: "key reused for ada@example.com with a modified body" }), { status: 409 });
    }
    if (prior !== undefined) {
      store.replays++;
      return new Response(JSON.stringify({ id: "re_cached" }), { status: 200 });
    }
    byKey.set(key, body);
    store.sends++;
    return new Response(JSON.stringify({ id: `re_${store.sends}` }), { status: 200 });
  };
  return { store, handle };
}

type Call = { url: string; init: RequestInit };
type Scenario = {
  turnstile?: Record<string, unknown> | "http500" | "throw";
  resend?: number | "throw" | ((init: RequestInit) => Response);
  telegram?: number | "throw";
};

/** A fetch that answers like Turnstile, Resend and Telegram, and records every call. */
function mockFetch(s: Scenario = {}) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
      if (s.turnstile === "throw") throw new Error("network");
      if (s.turnstile === "http500") return new Response("err", { status: 500 });
      return Response.json(s.turnstile ?? { success: true, hostname: "jeevag.in", action: "contact", "error-codes": [] });
    }
    if (url === "https://api.resend.com/emails") {
      if (s.resend === "throw") throw new Error("network");
      if (typeof s.resend === "function") return s.resend(init);
      return new Response(JSON.stringify({ id: "re_1" }), { status: s.resend ?? 200 });
    }
    if (url.startsWith("https://api.telegram.org/bot")) {
      if (s.telegram === "throw") throw new Error("network");
      return new Response(JSON.stringify({ ok: true }), { status: s.telegram ?? 200 });
    }
    throw new Error(`unexpected request to ${url}`);
  }) as typeof fetch;
  const to = (prefix: string) => calls.filter((c) => c.url.startsWith(prefix));
  return { fn, calls, siteverify: () => to("https://challenges.cloudflare.com"), resend: () => to("https://api.resend.com"), telegram: () => to("https://api.telegram.org") };
}

function post(body: unknown, opts: { origin?: string | null; type?: string; method?: string; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "Content-Type": opts.type ?? "application/json", ...opts.headers };
  if (opts.origin !== null) headers.Origin = opts.origin ?? "https://jeevag.in";
  const method = opts.method ?? "POST";
  return new Request("https://jeevag.in/api/contact", { method, headers, body: method === "GET" || method === "HEAD" ? undefined : (opts.raw ?? JSON.stringify(body)) });
}

const logs: string[] = [];
const quiet = { log: (event: string, details: Record<string, unknown>) => void logs.push(JSON.stringify({ event, ...details })) };

async function run(req: Request, scenario: Scenario = {}, env: ContactEnv = ENV) {
  const m = mockFetch(scenario);
  const res = await handleContactRequest(req, env, { fetch: m.fn, now: () => new Date("2026-10-15T10:30:00Z"), ...quiet });
  return { res, body: await res.json(), m };
}

test("valid submission sends one email and one Telegram message", async () => {
  const { res, body, m } = await run(post(VALID));
  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true, delivery: { email: "sent", telegram: "sent" } });
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");

  const [verify] = m.siteverify();
  const form = new URLSearchParams(String(verify.init.body));
  assert.equal(form.get("secret"), "test-turnstile-secret");
  assert.equal(form.get("response"), "token-abc");

  const [email] = m.resend();
  const payload = JSON.parse(String(email.init.body));
  assert.equal(payload.from, DEFAULT_FROM_EMAIL);
  assert.deepEqual(payload.to, [DEFAULT_TO_EMAIL]);
  assert.equal(payload.reply_to, "ada@example.com");
  assert.equal(payload.subject, "Portfolio contact — A project idea");
  assert.equal(payload.html, undefined, "plain text only");
  assert.match(payload.text, /Name: Ada Lovelace\nEmail: ada@example.com\nSubject: A project idea\nSubmitted: 2026-10-15 10:30 UTC/);
  assert.match(payload.text, /I'd like to talk about an AI system\./);
  assert.equal((email.init.headers as Record<string, string>).Authorization, "Bearer test-resend-key");
  assert.match((email.init.headers as Record<string, string>)["Idempotency-Key"], /^contact-[0-9a-f]{48}$/);

  const [tg] = m.telegram();
  assert.equal(tg.url, "https://api.telegram.org/bottest-telegram-token/sendMessage");
  const msg = JSON.parse(String(tg.init.body));
  assert.equal(msg.chat_id, "12345");
  assert.equal(msg.parse_mode, undefined, "no formatting is interpreted");
  assert.match(msg.text, /^New portfolio contact submission\n\nName: Ada Lovelace\nEmail: ada@example.com\nSubject: A project idea\nSubmitted: 2026-10-15 10:30 UTC\n\nMessage:\nHello Jeeva/);
});

test("recipient and sender come from server config only; env can set them", async () => {
  const { m } = await run(post(VALID), {}, { ...ENV, CONTACT_TO_EMAIL: "inbox@example.org", MAIL_FROM_EMAIL: "Site <a@notify.jeevag.in>" });
  const payload = JSON.parse(String(m.resend()[0].init.body));
  assert.deepEqual(payload.to, ["inbox@example.org"]);
  assert.equal(payload.from, "Site <a@notify.jeevag.in>");
});

test("a visitor cannot add fields such as a recipient", async () => {
  for (const extra of [{ to: "attacker@example.com" }, { recipient: "x@y.z" }, { cc: "a@b.c" }]) {
    const { res, body, m } = await run(post({ ...VALID, ...extra }));
    assert.equal(res.status, 400);
    assert.equal(body.error, "invalid_request");
    assert.equal(m.calls.length, 0);
  }
});

test("missing and invalid fields are rejected with field messages and no provider calls", async () => {
  const cases: [Record<string, string>, string][] = [
    [{ name: "" }, "name"],
    [{ name: "   " }, "name"],
    [{ name: "A\nB" }, "name"],
    [{ name: "x".repeat(101) }, "name"],
    [{ email: "" }, "email"],
    [{ email: "not-an-email" }, "email"],
    [{ email: "a@b" }, "email"],
    [{ email: "a b@example.com" }, "email"],
    [{ subject: "" }, "subject"],
    [{ subject: "Line\nbreak" }, "subject"],
    [{ subject: "s".repeat(151) }, "subject"],
    [{ message: "" }, "message"],
    [{ message: "too short" }, "message"],
    [{ message: "m".repeat(5001) }, "message"],
    [{ message: "bad \u0007 bell character here" }, "message"],
  ];
  for (const [patch, field] of cases) {
    const { res, body, m } = await run(post({ ...VALID, ...patch }));
    assert.equal(res.status, 400, JSON.stringify(patch).slice(0, 60));
    assert.equal(body.error, "invalid_fields");
    assert.ok(body.fields[field], `${field} error for ${JSON.stringify(patch).slice(0, 40)}`);
    assert.equal(m.calls.length, 0);
  }
  // Absent keys and non-string values.
  const { name: _omit, ...noName } = VALID;
  assert.equal((await run(post(noName))).body.error, "invalid_fields");
  assert.equal((await run(post({ ...VALID, name: 42 }))).body.error, "invalid_request");
  assert.equal((await run(post([VALID]))).body.error, "invalid_request");
  assert.equal((await run(post(null, { raw: "{not json" }))).body.error, "invalid_request");
});

test("whitespace is trimmed before sending", async () => {
  const { m } = await run(post({ ...VALID, name: "  Ada  ", email: "  ada@example.com ", subject: " Hi there " }));
  const payload = JSON.parse(String(m.resend()[0].init.body));
  assert.equal(payload.reply_to, "ada@example.com");
  assert.equal(payload.subject, "Portfolio contact — Hi there");
  assert.match(payload.text, /Name: Ada\n/);
});

test("oversized bodies are rejected before parsing (declared and streamed)", async () => {
  const big = JSON.stringify({ ...VALID, message: "m".repeat(20_000) });
  const declared = await run(post(null, { raw: big }));
  assert.equal(declared.res.status, 413);
  assert.equal(declared.body.error, "payload_too_large");
  // No Content-Length: the stream itself is cut off.
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(big));
      c.close();
    },
  });
  const req = new Request("https://jeevag.in/api/contact", { method: "POST", headers: { Origin: "https://jeevag.in", "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
  const streamed = await run(req);
  assert.equal(streamed.res.status, 413);
  assert.equal(streamed.m.calls.length, 0);
});

test("missing Turnstile token", async () => {
  const { res, body, m } = await run(post({ ...VALID, turnstileToken: "" }));
  assert.equal(res.status, 400);
  assert.equal(body.error, "captcha_missing");
  assert.equal(m.calls.length, 0);
  const { turnstileToken: _t, ...none } = VALID;
  assert.equal((await run(post(none))).body.error, "captcha_missing");
});

test("failed Turnstile verification sends nothing", async () => {
  const { res, body, m } = await run(post(VALID), { turnstile: { success: false, "error-codes": ["invalid-input-response"] } });
  assert.equal(res.status, 403);
  assert.equal(body.error, "captcha_failed");
  assert.equal(m.resend().length + m.telegram().length, 0);
});

test("expired or duplicate Turnstile token asks for a fresh challenge", async () => {
  const { res, body, m } = await run(post(VALID), { turnstile: { success: false, "error-codes": ["timeout-or-duplicate"] } });
  assert.equal(res.status, 403);
  assert.equal(body.error, "captcha_expired");
  assert.equal(m.resend().length + m.telegram().length, 0);
});

test("unexpected Turnstile hostname is rejected; dev hostnames only via explicit config", async () => {
  for (const hostname of ["evil.example", "jeevag.in.evil.example", "jeeva-portfolio-v2.pages.dev", undefined]) {
    const { res, body, m } = await run(post(VALID), { turnstile: { success: true, hostname, action: "contact" } });
    assert.equal(res.status, 403, String(hostname));
    assert.equal(body.error, "captcha_failed");
    assert.equal(m.resend().length, 0);
  }
  const dev = await run(post(VALID), { turnstile: { success: true, hostname: "localhost", action: "contact" } }, { ...ENV, CONTACT_ALLOWED_HOSTNAMES: "localhost" });
  assert.equal(dev.res.status, 200);
});

test("Cloudflare test keys are refused unless explicitly allowed for development", async () => {
  const testing = { success: true, hostname: "example.com", "error-codes": [], metadata: { result_with_testing_key: true } };
  const prod = await run(post(VALID), { turnstile: testing }, { ...ENV, CONTACT_ALLOWED_HOSTNAMES: "example.com" });
  assert.equal(prod.res.status, 403);
  assert.equal(prod.body.error, "captcha_failed");
  const dev = await run(post(VALID), { turnstile: testing }, { ...ENV, CONTACT_ALLOWED_HOSTNAMES: "example.com", CONTACT_ALLOW_TURNSTILE_TEST_KEYS: "true" });
  assert.equal(dev.res.status, 200);
});

test("wrong Turnstile action is rejected", async () => {
  const { body } = await run(post(VALID), { turnstile: { success: true, hostname: "jeevag.in", action: "login" } });
  assert.equal(body.error, "captcha_failed");
});

test("siteverify outage returns a generic unavailable error", async () => {
  for (const turnstile of ["http500", "throw"] as const) {
    const { res, body, m } = await run(post(VALID), { turnstile });
    assert.equal(res.status, 503);
    assert.equal(body.error, "unavailable");
    assert.equal(m.resend().length, 0);
  }
});

test("Resend failure with Telegram success is reported per channel as received", async () => {
  for (const resend of [500, 422, "throw"] as const) {
    const { res, body } = await run(post(VALID), { resend });
    assert.equal(res.status, 200);
    assert.deepEqual(body, { ok: true, delivery: { email: "failed", telegram: "sent" } });
  }
});

test("Telegram failure with email success is reported per channel as received", async () => {
  for (const telegram of [400, 401, "throw"] as const) {
    const { res, body } = await run(post(VALID), { telegram });
    assert.equal(res.status, 200);
    assert.deepEqual(body, { ok: true, delivery: { email: "sent", telegram: "failed" } });
  }
});

test("both channels failing returns delivery_failed (no false success)", async () => {
  const { res, body } = await run(post(VALID), { resend: 500, telegram: 500 });
  assert.equal(res.status, 502);
  assert.deepEqual(body, { ok: false, error: "delivery_failed" });
});

test("honeypot submissions look successful but send nothing", async () => {
  const { res, body, m } = await run(post({ ...VALID, website: "https://spam.example" }));
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(m.calls.length, 0, "no Turnstile, email or Telegram calls");
});

test("origin checks", async () => {
  for (const origin of [null, "https://evil.example", "http://jeevag.in", "https://jeeva-portfolio-v2.pages.dev", "null"]) {
    const { res, body, m } = await run(post(VALID, { origin }));
    assert.equal(res.status, 403, String(origin));
    assert.equal(body.error, "forbidden_origin");
    assert.equal(m.calls.length, 0);
  }
  const crossSite = await run(post(VALID, { headers: { "Sec-Fetch-Site": "cross-site" } }));
  assert.equal(crossSite.res.status, 403);
  const sameOrigin = await run(post(VALID, { headers: { "Sec-Fetch-Site": "same-origin" } }));
  assert.equal(sameOrigin.res.status, 200);
  const dev = await run(post(VALID, { origin: "http://localhost:8788" }), { turnstile: { success: true, hostname: "localhost", action: "contact" } }, { ...ENV, CONTACT_ALLOWED_ORIGINS: "http://localhost:8788", CONTACT_ALLOWED_HOSTNAMES: "localhost" });
  assert.equal(dev.res.status, 200);
});

test("HTTP method and content-type checks", async () => {
  for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
    const { res, body } = await run(post(VALID, { method }));
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get("Allow"), "POST");
    assert.equal(body.error, "method_not_allowed");
  }
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "application/jsonp"]) {
    const { res, body } = await run(post(VALID, { type }));
    assert.equal(res.status, 415, type);
    assert.equal(body.error, "unsupported_media_type");
  }
  assert.equal((await run(post(VALID, { type: "application/json; charset=utf-8" }))).res.status, 200);
});

test("missing server secrets give a generic error without leaking which", async () => {
  const { res, body, m } = await run(post(VALID), {}, { ...ENV, TURNSTILE_SECRET_KEY: undefined });
  assert.equal(res.status, 503);
  assert.deepEqual(body, { ok: false, error: "unavailable" });
  assert.equal(m.calls.length, 0);
  assert.equal(JSON.stringify(body).includes("TURNSTILE"), false);
});

test("logs never contain secrets, tokens or the visitor's message", async () => {
  logs.length = 0;
  await run(post(VALID));
  await run(post(VALID), { resend: 500 });
  await run(post(VALID), { turnstile: { success: false, "error-codes": ["invalid-input-response"] } });
  const all = logs.join("\n");
  for (const secret of ["test-resend-key", "test-telegram-token", "test-turnstile-secret", "token-abc", "I'd like to talk", "ada@example.com"]) {
    assert.equal(all.includes(secret), false, `log leaked ${secret}`);
  }
});

test("responses never echo provider errors", async () => {
  const { body } = await run(post(VALID), { resend: 500, telegram: 500 });
  assert.equal(JSON.stringify(body).includes("re_"), false);
  assert.deepEqual(Object.keys(body).sort(), ["error", "ok"]);
});

test("long messages are truncated for Telegram but sent in full by email", async () => {
  const message = "x".repeat(4990);
  const { m } = await run(post({ ...VALID, message }));
  const tg = JSON.parse(String(m.telegram()[0].init.body)).text as string;
  assert.ok(tg.length <= 4096, `telegram text ${tg.length}`);
  assert.match(tg, /truncated/);
  assert.ok(JSON.parse(String(m.resend()[0].init.body)).text.includes(message));
});

// ── Idempotency (regression: test keys always issue the same Turnstile token) ──

test("regression: two different messages with the same Turnstile test token are both emailed, with distinct keys", async () => {
  const { store, handle } = resendIdempotencyStore();
  const first = await run(post({ ...VALID, turnstileToken: TEST_TOKEN, submissionId: "11111111-1111-4111-8111-111111111111", message: "First message about a project." }), { resend: handle });
  const second = await run(post({ ...VALID, turnstileToken: TEST_TOKEN, submissionId: "22222222-2222-4222-8222-222222222222", subject: "Another idea", message: "Second, different message." }), { resend: handle });
  assert.deepEqual(first.body, { ok: true, delivery: { email: "sent", telegram: "sent" } });
  assert.deepEqual(second.body, { ok: true, delivery: { email: "sent", telegram: "sent" } });
  assert.equal(store.sends, 2, "both emails sent");
  assert.equal(store.conflicts, 0, "no 409 invalid_idempotent_request");
  assert.notEqual(store.keys[0], store.keys[1], "distinct idempotency keys");
  for (const key of store.keys) assert.match(key, /^contact-[0-9a-f]{48}$/);
});

test("the idempotency key no longer depends on the Turnstile token", async () => {
  const keys: string[] = [];
  const capture = (init: RequestInit) => {
    keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
    return new Response("{}", { status: 200 });
  };
  await run(post({ ...VALID, turnstileToken: "token-one" }), { resend: capture });
  await run(post({ ...VALID, turnstileToken: "token-two" }), { resend: capture });
  assert.equal(keys[0], keys[1], "same submission + same content → same key, whatever the token");
});

test("a retry of the same logical submission reuses its key and is not emailed twice", async () => {
  const { store, handle } = resendIdempotencyStore();
  const a = await run(post({ ...VALID, turnstileToken: "token-first-attempt" }), { resend: handle });
  const b = await run(post({ ...VALID, turnstileToken: "token-retry" }), { resend: handle });
  assert.equal(a.body.ok, true);
  assert.equal(b.body.ok, true);
  assert.equal(store.keys[0], store.keys[1]);
  assert.equal(store.sends, 1, "Resend sends it once");
  assert.equal(store.replays, 1, "the retry is answered from Resend's idempotency cache");
});

test("a reused submission ID with changed content still gets a new key (no 409)", async () => {
  const { store, handle } = resendIdempotencyStore();
  await run(post(VALID), { resend: handle });
  const edited = await run(post({ ...VALID, message: "Edited before resending, so this is new content." }), { resend: handle });
  assert.equal(edited.body.delivery.email, "sent");
  assert.equal(store.conflicts, 0);
  assert.notEqual(store.keys[0], store.keys[1]);
});

test("submission ID is required and well-formed", async () => {
  const { submissionId: _omit, ...none } = VALID;
  const cases: [string, Record<string, string>][] = [
    ["missing", none],
    ["empty", { ...VALID, submissionId: "" }],
    ["too short", { ...VALID, submissionId: "short" }],
    ["bad characters", { ...VALID, submissionId: "has spaces in it here!" }],
    ["too long", { ...VALID, submissionId: "x".repeat(65) }],
  ];
  for (const [label, body] of cases) {
    const { res, body: out, m } = await run(post(body));
    assert.equal(res.status, 400, label);
    assert.equal(out.error, "invalid_request");
    assert.equal(m.calls.length, 0);
  }
});

test("a Resend 409 is logged with status and error name only, and reported per channel", async () => {
  logs.length = 0;
  const { handle } = resendIdempotencyStore();
  // Reproduce the old bug: an earlier, different email already used the key this request will get.
  const COLLIDING = "contact-collision";
  handle({ body: "an earlier, different email", headers: { "Idempotency-Key": COLLIDING } });
  const conflict = await run(post({ ...VALID, message: "Different content." }), {
    resend: (init) => handle({ ...init, headers: { ...(init.headers as Record<string, string>), "Idempotency-Key": COLLIDING } }),
  });
  assert.deepEqual(conflict.body, { ok: true, delivery: { email: "failed", telegram: "sent" } });
  const line = logs.find((l) => l.includes('"email":"failed"'));
  assert.ok(line, "delivery logged");
  assert.deepEqual(JSON.parse(line).emailError, { httpStatus: 409, name: "invalid_idempotent_request" });
  for (const secret of ["test-resend-key", "ada@example.com", "Different content", "modified body"]) assert.equal(line.includes(secret), false, `log leaked ${secret}`);
});
