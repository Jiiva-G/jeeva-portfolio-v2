// Contact form rules shared by the browser (instant feedback) and the Pages Function (enforcement).
// Plain TypeScript with no imports so both Vite and Node's type stripping can load it.

export const CONTACT_LIMITS = {
  name: { min: 1, max: 100 },
  email: { max: 254 },
  subject: { min: 1, max: 150 },
  message: { min: 10, max: 5000 },
  /** Turnstile tokens are at most 2048 characters. */
  turnstileToken: { max: 2048 },
  website: { max: 200 },
} as const;

/** Largest accepted request body, in bytes (the fields above, JSON-encoded, with headroom). */
export const CONTACT_MAX_BODY_BYTES = 16 * 1024;

/** The Turnstile action the widget is rendered with and the server expects back. */
export const TURNSTILE_ACTION = "contact";

/**
 * One logical submission (the browser makes a random UUID per message and keeps it for retries of the
 * same, unchanged message). The server derives the email idempotency key from it plus the content.
 */
export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export type ContactField = "name" | "email" | "subject" | "message";

export type ContactInput = { name: string; email: string; subject: string; message: string };

export type FieldErrors = Partial<Record<ContactField, string>>;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
// C0/C1 control characters other than tab and newline (which only the message may contain).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
// Line breaks, tabs and the Unicode line/paragraph separators (single-line fields only).
const LINE_BREAK = new RegExp(`[\\r\\n\\t${String.fromCharCode(0x2028, 0x2029)}]`);

export function isValidEmail(value: string) {
  return value.length <= CONTACT_LIMITS.email.max && EMAIL.test(value);
}

/** Trims and normalises line endings; returns the cleaned values and any field errors. */
export function validateContact(raw: Record<ContactField, string>): { values: ContactInput; errors: FieldErrors } {
  const values: ContactInput = {
    name: raw.name.trim(),
    email: raw.email.trim(),
    subject: raw.subject.trim(),
    message: raw.message.replace(/\r\n?/g, "\n").trim(),
  };
  const errors: FieldErrors = {};

  if (!values.name) errors.name = "Enter your name.";
  else if (values.name.length > CONTACT_LIMITS.name.max) errors.name = `Use ${CONTACT_LIMITS.name.max} characters or fewer.`;
  else if (CONTROL.test(values.name) || LINE_BREAK.test(values.name)) errors.name = "Use letters, numbers and punctuation only.";

  if (!values.email) errors.email = "Enter your email address.";
  else if (!isValidEmail(values.email)) errors.email = "Enter a valid email address, like name@example.com.";

  if (!values.subject) errors.subject = "Enter a subject.";
  else if (values.subject.length > CONTACT_LIMITS.subject.max) errors.subject = `Use ${CONTACT_LIMITS.subject.max} characters or fewer.`;
  else if (CONTROL.test(values.subject) || LINE_BREAK.test(values.subject)) errors.subject = "Keep the subject on one line.";

  if (!values.message) errors.message = "Enter a message.";
  else if (values.message.length < CONTACT_LIMITS.message.min) errors.message = `Write at least ${CONTACT_LIMITS.message.min} characters.`;
  else if (values.message.length > CONTACT_LIMITS.message.max) errors.message = `Use ${CONTACT_LIMITS.message.max} characters or fewer.`;
  else if (CONTROL.test(values.message)) errors.message = "Remove unsupported control characters.";

  return { values, errors };
}

/** Error codes the endpoint returns (`{ ok: false, error }`). The browser maps them to messages. */
export type ContactErrorCode =
  | "method_not_allowed"
  | "unsupported_media_type"
  | "payload_too_large"
  | "forbidden_origin"
  | "invalid_request"
  | "invalid_fields"
  | "captcha_missing"
  | "captcha_failed"
  | "captcha_expired"
  | "unavailable"
  | "delivery_failed";

export type DeliveryStatus = "sent" | "failed";

export type ContactResponse =
  | { ok: true; delivery: { email: DeliveryStatus; telegram: DeliveryStatus } }
  | { ok: false; error: ContactErrorCode; fields?: FieldErrors };
