import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, ArrowRight, Check, Loader2, X } from "lucide-react";
import { links } from "@/data/portfolio";
import { loadTurnstile, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { cn } from "@/lib/utils";
import { CONTACT_LIMITS, TURNSTILE_ACTION, validateContact, type ContactField, type ContactResponse, type FieldErrors } from "../../shared/contact";
import { ActionButton } from "./primitives";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to refocus on close (Radix only does this for its own Dialog.Trigger). */
  returnFocusTo: HTMLElement | null;
};

type Values = Record<ContactField, string>;
type Status = "idle" | "submitting" | "success" | "error";
type Captcha = "loading" | "ready" | "unavailable";

const EMPTY: Values = { name: "", email: "", subject: "", message: "" };
const ORDER: ContactField[] = ["name", "email", "subject", "message"];

const FIELDS: Record<ContactField, { label: string; type?: string; autoComplete: string; maxLength: number; inputMode?: "email" }> = {
  name: { label: "Name", autoComplete: "name", maxLength: CONTACT_LIMITS.name.max },
  email: { label: "Email", type: "email", autoComplete: "email", maxLength: CONTACT_LIMITS.email.max, inputMode: "email" },
  subject: { label: "Subject", autoComplete: "off", maxLength: CONTACT_LIMITS.subject.max },
  message: { label: "Message", autoComplete: "off", maxLength: CONTACT_LIMITS.message.max },
};

const EMAIL_FALLBACK = "Please email me directly instead.";

function errorMessage(result: ContactResponse | null): string {
  if (!result || result.ok) return `Your message couldn't be sent right now. ${EMAIL_FALLBACK}`;
  switch (result.error) {
    case "invalid_fields":
      return "Check the highlighted fields and try again.";
    case "captcha_missing":
    case "captcha_failed":
      return "The verification didn't pass. Complete it again, then send.";
    case "captcha_expired":
      return "The verification expired and has been refreshed. Send your message again.";
    case "payload_too_large":
      return "Your message is too long. Shorten it and try again.";
    default:
      return `Your message couldn't be sent right now. ${EMAIL_FALLBACK}`;
  }
}

/** Contact form in a dialog. Posts to /api/contact, which verifies Turnstile and delivers the message. */
export default function ContactDialog({ open, onOpenChange, returnFocusTo }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<Captcha>(TURNSTILE_SITE_KEY ? "loading" : "unavailable");
  const [widgetHost, setWidgetHost] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const inFlight = useRef(false);
  /**
   * Identifies one logical submission. Kept while the visitor retries the same, unchanged message (so
   * the server's email idempotency key matches and it can't be sent twice); cleared after success or
   * any edit, so a new message always gets a new one.
   */
  const submissionId = useRef<string | null>(null);
  const inputs = useRef<Partial<Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const successHeading = useRef<HTMLHeadingElement>(null);
  /** Field to focus once the next render has committed (fields are read-only while sending). */
  const [focusField, setFocusField] = useState<ContactField | null>(null);

  // A fresh visit to the dialog starts clean (a draft in progress is kept).
  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setStatus((s) => (s === "success" || s === "error" ? "idle" : s));
  }, [open]);

  // Render the Turnstile widget whenever its container is on screen; remove it when it leaves.
  useEffect(() => {
    if (!widgetHost || !TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    setCaptcha("loading");
    setToken(null);
    loadTurnstile()
      .then((ts) => {
        if (cancelled) return;
        widgetId.current = ts.render(widgetHost, {
          sitekey: TURNSTILE_SITE_KEY,
          action: TURNSTILE_ACTION,
          theme: "dark",
          size: "flexible",
          appearance: "always",
          "refresh-expired": "auto",
          "response-field": false,
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(null),
          "timeout-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
        setCaptcha("ready");
      })
      .catch(() => {
        if (!cancelled) setCaptcha("unavailable");
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [widgetHost]);

  /** Tokens are single-use: after any submission attempt, ask Turnstile for a new one. */
  const freshChallenge = useCallback(() => {
    setToken(null);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const focusFirstInvalid = (errs: FieldErrors) => setFocusField(ORDER.find((f) => errs[f]) ?? null);

  useEffect(() => {
    if (!focusField) return;
    inputs.current[focusField]?.focus();
    setFocusField(null);
  }, [focusField]);

  const update = (field: ContactField, value: string) => {
    submissionId.current = null;
    setValues((v) => ({ ...v, [field]: value }));
    // Once a field has been flagged, re-check it as the visitor fixes it.
    if (errors[field]) {
      const { errors: next } = validateContact({ ...values, [field]: value });
      setErrors((e) => ({ ...e, [field]: next[field] }));
    }
  };

  const onBlurField = (field: ContactField) => {
    if (!values[field]) return; // don't scold empty fields just for being passed through
    const { errors: next } = validateContact(values);
    setErrors((e) => ({ ...e, [field]: next[field] }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const { values: clean, errors: errs } = validateContact(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setNotice("Check the highlighted fields and try again.");
      focusFirstInvalid(errs);
      return;
    }
    if (captcha === "unavailable") {
      setNotice(`The form isn't available right now. ${EMAIL_FALLBACK}`);
      return;
    }
    if (!token) {
      setNotice("Complete the verification below, then send your message.");
      return;
    }

    inFlight.current = true;
    submissionId.current ??= crypto.randomUUID();
    setStatus("submitting");
    setNotice(null);
    let result: ContactResponse | null = null;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clean, website, turnstileToken: token, submissionId: submissionId.current }),
        signal: AbortSignal.timeout(25_000),
      });
      result = (await res.json().catch(() => null)) as ContactResponse | null;
    } catch {
      result = null;
    }
    inFlight.current = false;
    freshChallenge();

    if (result?.ok) {
      submissionId.current = null;
      setSentTo(clean.email);
      setValues(EMPTY);
      setWebsite("");
      setErrors({});
      setStatus("success");
      return;
    }
    setStatus("error");
    if (result && !result.ok && result.error === "invalid_fields" && result.fields) {
      setErrors(result.fields);
      focusFirstInvalid(result.fields);
    }
    setNotice(errorMessage(result));
  };

  // Move focus to the confirmation so it's announced and keyboard users aren't left on a removed button.
  useEffect(() => {
    if (status === "success") successHeading.current?.focus();
  }, [status]);

  const submitting = status === "submitting";
  const liveText = submitting ? "Sending your message…" : status === "success" ? "Message sent." : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[80] bg-[rgba(3,5,10,0.6)] backdrop-blur-md" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (status === "success" ? successHeading.current : inputs.current.name)?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusTo?.focus({ preventScroll: true });
          }}
          className="dialog-content fixed inset-x-3 top-3 z-[90] mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-xl flex-col overflow-hidden rounded-[1.6rem] border border-line-strong bg-surface/95 shadow-[0_40px_140px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(61,139,255,0.08)] focus:outline-none sm:inset-x-6 sm:bottom-auto sm:top-1/2 sm:max-h-[92vh] sm:-translate-y-1/2"
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <div className="dialog-stage relative flex items-start justify-between gap-4 border-b border-line px-6 pb-6 pt-6 sm:px-9 sm:pt-8">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                  <span className="text-accent-bright">//</span> Contact
                </p>
                <Dialog.Title className="mt-3 text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2rem]">Get in touch</Dialog.Title>
                <Dialog.Description className="mt-2.5 max-w-[30rem] text-[14.5px] leading-relaxed text-muted">
                  Tell me about your project, role or idea. I&rsquo;ll reply to the email you give.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface/60 text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-ink"
                aria-label="Close contact form"
              >
                <X size={16} />
              </Dialog.Close>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {liveText}
            </p>

            {status === "success" ? (
              <div className="px-6 py-8 sm:px-9">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent-bright" aria-hidden="true">
                    <Check size={16} />
                  </span>
                  <h3 ref={successHeading} tabIndex={-1} className="text-[1.2rem] font-semibold tracking-[-0.01em] text-ink outline-none">
                    Message sent
                  </h3>
                </div>
                <p className="mt-3 max-w-[30rem] text-[14.5px] leading-relaxed text-muted">
                  Thanks — your message reached me. I&rsquo;ll reply to <span className="text-ink">{sentTo}</span>.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Dialog.Close asChild>
                    <ActionButton variant="primary">Close</ActionButton>
                  </Dialog.Close>
                  <ActionButton onClick={() => setStatus("idle")}>Send another message</ActionButton>
                </div>
              </div>
            ) : (
              <form noValidate onSubmit={submit} className="space-y-5 px-6 py-7 sm:px-9" aria-busy={submitting}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {(["name", "email"] as const).map((field) => (
                    <Field key={field} field={field} value={values[field]} error={errors[field]} busy={submitting} onChange={update} onBlur={onBlurField} inputRef={(el) => (inputs.current[field] = el)} />
                  ))}
                </div>
                <Field field="subject" value={values.subject} error={errors.subject} busy={submitting} onChange={update} onBlur={onBlurField} inputRef={(el) => (inputs.current.subject = el)} />
                <Field field="message" value={values.message} error={errors.message} busy={submitting} onChange={update} onBlur={onBlurField} inputRef={(el) => (inputs.current.message = el)} multiline />

                {/* Honeypot: hidden from people and assistive technology; bots that fill it are discarded. */}
                <div className="contact-hp" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>

                <div>
                  <div
                    ref={setWidgetHost}
                    className="contact-turnstile"
                    aria-label="Verification"
                    role="group"
                    data-state={captcha === "ready" ? (token ? "verified" : "pending") : captcha}
                  />
                  {captcha === "loading" && TURNSTILE_SITE_KEY && <p className="mt-2 font-mono text-[11px] text-muted">Loading verification…</p>}
                  {captcha === "unavailable" && (
                    <p className="mt-2 text-[13px] text-muted">
                      The form isn&rsquo;t available right now. Email me directly at{" "}
                      <a className="text-ink underline decoration-accent/50 underline-offset-4" href={`mailto:${links.email}`}>
                        {links.email}
                      </a>
                      .
                    </p>
                  )}
                </div>

                {notice && (
                  <div role="alert" className="flex gap-2.5 rounded-xl border border-[#ff9b9b]/30 bg-[#ff9b9b]/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-[#ffc4c4]">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      {notice}{" "}
                      {status === "error" && (
                        <a className="text-ink underline decoration-accent/50 underline-offset-4" href={`mailto:${links.email}`}>
                          {links.email}
                        </a>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  {/* Not `disabled` while sending, so keyboard focus stays on it; the in-flight guard blocks repeats. */}
                  <ActionButton type="submit" variant="primary" aria-disabled={submitting} className={cn(submitting && "cursor-progress opacity-80")}>
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="contact-spinner" aria-hidden="true" /> Sending…
                      </>
                    ) : (
                      <>
                        Send message <ArrowRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </ActionButton>
                  <p className="font-mono text-[11px] text-muted">
                    Prefer email?{" "}
                    <a className="text-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent" href={`mailto:${links.email}`}>
                      {links.email}
                    </a>
                  </p>
                </div>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  field,
  value,
  error,
  busy,
  multiline,
  onChange,
  onBlur,
  inputRef,
}: {
  field: ContactField;
  value: string;
  error?: string;
  /** While sending: read-only (not disabled), so focus and the visitor's place are kept. */
  busy: boolean;
  multiline?: boolean;
  onChange: (field: ContactField, value: string) => void;
  onBlur: (field: ContactField) => void;
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const spec = FIELDS[field];
  const id = `contact-${field}`;
  const describedBy = [error && `${id}-error`, multiline && `${id}-count`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: field,
    value,
    required: true,
    readOnly: busy,
    maxLength: spec.maxLength,
    autoComplete: spec.autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: cn("contact-input", error && "contact-input--invalid"),
    onBlur: () => onBlur(field),
  };
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/85">
          {spec.label}
        </label>
        {multiline && (
          <span id={`${id}-count`} className="font-mono text-[10.5px] text-muted">
            {value.length} / {spec.maxLength}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea ref={inputRef} rows={6} {...common} onChange={(e) => onChange(field, e.target.value)} />
      ) : (
        <input ref={inputRef} type={spec.type ?? "text"} inputMode={spec.inputMode} {...common} onChange={(e) => onChange(field, e.target.value)} />
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#ffb3b3]">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
