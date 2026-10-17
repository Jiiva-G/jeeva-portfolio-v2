// Cloudflare Pages Function: POST /api/contact. All logic lives in server/contact.ts.
import { handleContactRequest, type ContactEnv } from "../../server/contact.ts";

export const onRequest = (context: { request: Request; env: ContactEnv }) => handleContactRequest(context.request, context.env);
