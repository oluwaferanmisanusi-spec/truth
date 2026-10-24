// The API's settings, read from api/.env (template: api/.env.example). Only the API reads it.
// Checked once at start-up: a missing key stops the API with a clear message instead of
// failing on the first request that needs it.
import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  API_PORT: z.coerce.number().int().default(3200),
  /** The website's public address, for links in emails and Paystack's return page. */
  SITE_URL: z.url().default('http://localhost:3100'),
  PAYSTACK_SECRET_KEY: z.string().startsWith('sk_'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(1),
  /** Vercel Cron sends this as a Bearer token to /jobs/…; without it the jobs refuse to run. */
  CRON_SECRET: z.string().min(32).optional(),
  /** Shared with the website (server side only), so it can pass on the visitor's IP. */
  INTERNAL_API_KEY: z.string().min(32).optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`API settings missing or invalid in api/.env: ${missing}`);
  }
  return result.data;
}
